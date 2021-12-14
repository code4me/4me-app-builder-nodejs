'use strict';

const Lambda4meContextHelper = require('../../../library/helpers/lambda_4me_context_helper');
const TimeHelper = require('../../../library/helpers/time_helper');
const InstanceHelper = require('./instance_helper');
const LansweeperApiHelper = require('./lansweeper_api_helper');
const LansweeperIntegration = require('./lansweeper_integration');
const Timer = require('./timer');
const SQSHelper = require('./sqs_helper');
const LansweeperAuthorizationError = require('./errors/lansweeper_authorization_error');
const Js4meAuthorizationError = require('../../../library/helpers/errors/js_4me_authorization_error');

class LansweeperLambdaHandler {
  constructor(options) {
    this.lambda4meContextHelper = new Lambda4meContextHelper(options);
    this.refreshQueueUrl = options.refreshQueueUrl;
    this.timeHelper = new TimeHelper();
  }

  async handleScheduledEvent(event, context) {
    const lambda4meContext = await this.lambda4meContextHelper.assembleProviderOnly();
    if (!lambda4meContext.providerContext) {
      return this.unknownError('Configuration error, unable to query 4me');
    }

    const provider4meHelper = lambda4meContext.providerContext.js4meHelper;
    const instanceHelper = new InstanceHelper();
    const offeringReference = lambda4meContext.offeringReference;
    const endDate = new Date(this.timeHelper.getMsSinceEpoch() - LansweeperLambdaHandler.SYNC_INTERVAL * 60 * 60 * 1000);
    this.log(`Querying with end date: ${this.timeHelper.formatDateTime(endDate)}`);
    const accounts = await instanceHelper.retrieveAccountsLastSyncedBefore(provider4meHelper,
                                                                           offeringReference,
                                                                           endDate);
    if (accounts.error) {
      this.error('Unable to query accounts to sync: %j', accounts);
      return this.badRequest('Unable to process event.');
    }

    let successCount = 0;
    for (const customerAccount of accounts) {
      const messageId = await this.sendRefreshMessage(customerAccount);
      if (messageId.error) {
        this.error(`Customer account ${customerAccount}: %j`, messageId.error);
      } else {
        successCount++;
      }
    }
    return this.respondWith(`Triggered refresh of ${successCount} accounts`);
  }

  async handleSQSEvent(event, context) {
    let handledCount = 0;
    for (const record of event.Records) {
      const result = await this.handleSQSRecord(record);

      if (result && result.statusCode === 200) {
        handledCount++;
      } else {
        console.error(`Error handling refresh message ${record.messageId}, body: '${record.body}'. Message will be dropped.`)
      }
    }

    return this.respondWith({
                              recordCount: event.Records.length,
                              successCount: handledCount,
                            });
  }

  async handleSQSRecord(record) {
    let result = null;

    const customerAccount = record.body;
    try {
      const lambda4meContext = await this.assembleContext(customerAccount);
      if (lambda4meContext) {
        result = await this.performUpload(lambda4meContext);
        this.log(`Result for ${customerAccount}:\n%j`, result);
      }
    } catch (e) {
      // we will swallow the error to prevent SQS redelivery, to retry a new message must be sent.
      if (!e.isLogged) {
        // exception was not thrown by us after logging the problem: log exception and stack trace
        console.error(e);
      }
    }

    return result;
  }

  async handleHTTPEvent(event, context) {
    const proxyParams = event.pathParameters.proxy.split('/');
    const customerAccount = proxyParams[0];

    const lambda4meContext = await this.assembleContext(customerAccount);
    if (!lambda4meContext) {
      return this.badRequest('Unauthorized');
    }

    const customerContext = lambda4meContext.customerContext;
    if (event.httpMethod === 'GET') {
      const providedCallbackSecret = proxyParams[1];

      const callbackSecret = customerContext.secrets.callback_secret;
      if (!callbackSecret || callbackSecret !== providedCallbackSecret) {
        console.log('Callback secret not matched');
        return this.badRequest('Unauthorized');
      }

      if (event.queryStringParameters.refresh) {
        return await this.performUpload(lambda4meContext);
      }

      const code = event.queryStringParameters.code;
      if (!code) {
        console.log('No code in request');
        return this.badRequest('Unauthorized');
      }

      return await this.handleLansweeperAuthentication(event, lambda4meContext, code);
    }
  }

  async assembleContext(customerAccount) {
    if (!customerAccount || customerAccount === '') {
      console.log('No customer account');
      return null;
    }

    const lambda4meContext = await this.lambda4meContextHelper.assemble(customerAccount);
    const customerContext = lambda4meContext.customerContext;
    if (!customerContext || !customerContext.secrets) {
      console.error('No customer secrets. Got %j', lambda4meContext);
      return null;
    }
    return lambda4meContext;
  }

  async performUpload(lambda4meContext) {
    const customerContext = lambda4meContext.customerContext;
    if (!customerContext.secrets.refresh_token) {
      console.log('No refresh token available');
      return this.badRequest('Unauthorized');
    }

    const config = await this.appInstanceConfig(lambda4meContext);

    const timer = new Timer();
    const storeStart = await this.updateInstanceConfig(lambda4meContext, {
      id: config.instanceId,
      customFields: [{id: 'sync_start_at', value: this.timeHelper.formatDateTime(timer.startTime)}],
    });
    if (storeStart.error) {
      console.error('Unable to store start time:\n%j', storeStart.error);
      return this.unknownError('Connection error, please try again later.');
    }

    const clientID = config.clientID;
    const clientSecret = customerContext.secrets.secrets.client_secret;
    const refreshToken = customerContext.secrets.refresh_token;

    let networkedAssetsOnly = true;
    if (config.importType === 'all') {
      networkedAssetsOnly = undefined;
    } else if (config.importType === 'no_ip_only') {
      networkedAssetsOnly = false;
    }

    let updatedCisPerSite;
    try {
      const integration = new LansweeperIntegration(clientID, clientSecret, refreshToken, customerContext.js4meHelper);
      updatedCisPerSite = await integration.processSites(networkedAssetsOnly);
    } catch (error) {
      if (error instanceof LansweeperAuthorizationError) {
        return await this.suspendUnauthorizedInstance(lambda4meContext, config, error);
      } else if (error instanceof Js4meAuthorizationError) {
        return await this.suspendUnauthorized4meInstance(lambda4meContext, config, error);
      } else {
        throw error;
      }
    }

    timer.stop();
    const endStart = await this.updateInstanceConfig(lambda4meContext, {
      id: config.instanceId,
      customFields: [
        {id: 'sync_end_at', value: this.timeHelper.formatDateTime(timer.endTime)},
        {id: 'sync_duration', value: timer.getDurationInSeconds().toString()},
        {id: 'sync_duration_text', value: this.timeHelper.secondsToDurationText(timer.getDurationInSeconds())},
        {id: 'sync_summary', value: this.formatSummary(updatedCisPerSite)},
      ],
    });
    if (endStart.error) {
      console.error('Unable to store end time:\n%j', endStart.error);
      return this.unknownError('Connection error, please try again later.');
    }

    return this.respondWith(updatedCisPerSite);
  }

  formatSummary(object) {
    const json = JSON.stringify(object, null, 2);
    return '```\n' + json + '\n```\n';
  }

  async suspendUnauthorizedInstance(lambda4meContext, config, error) {
    const suspend = await this.updateInstanceConfig(lambda4meContext, {
      id: config.instanceId,
      suspended: true,
      suspensionComment: `Unable to connect to Lansweeper: ${error.message}`,
    });
    if (suspend.error) {
      console.error('Unable to suspend unauthorized instance:\n%j', suspend.error);
      return this.unknownError('Connection error, please try again later.');
    }
    return this.badRequest('Unable to connect to Lansweeper, suspended instance.')
  }

  async suspendUnauthorized4meInstance(lambda4meContext, config, error) {
    const suspend = await this.updateInstanceConfig(lambda4meContext, {
      id: config.instanceId,
      suspended: true,
      suspensionComment: `Unable to connect to customer account. Please rotate the token and unsuspend.`,
    });
    if (suspend.error) {
      console.error('Unable to suspend unauthorized instance:\n%j', suspend.error);
      return this.unknownError('Connection error, please try again later.');
    }
    return this.badRequest('Unable to connect to customer account, suspended instance.')
  }

  async handleLansweeperAuthentication(event, lambda4meContext, code) {
    const config = await this.appInstanceConfig(lambda4meContext);

    const customerContext = lambda4meContext.customerContext;

    const clientID = config.clientID;
    const clientSecret = customerContext.secrets.secrets.client_secret;
    const callbackURL = `https://${event.headers.Host}${event.requestContext.path}`;
    const refreshToken = await this.getRefreshToken(clientID, clientSecret, code, callbackURL);
    if (!refreshToken) {
      return this.badRequest('Unauthorized');
    }
    const secretsHelper = customerContext.secretsHelper;
    const secretsAccountKey = customerContext.secretsAccountKey;
    const awsResult = await secretsHelper.updateSecrets(secretsAccountKey, {refresh_token: refreshToken});
    if (!awsResult.secrets.refresh_token) {
      console.error('Unable to store Lansweeper refresh_token');
      return this.unknownError('Connection error, please try again later.');
    }

    const instanceInput = {
      id: config.instanceId,
      suspended: false,
      customFields: [
        {id: 'connection_status', value: 'success'},
        {id: 'callback_url', value: null},
      ]
    }
    const updateCustomFields = await this.updateInstanceConfig(lambda4meContext, instanceInput);
    if (updateCustomFields.error) {
      console.error('Unable to set app instance custom fields %s:\n%j', instanceInput, updateCustomFields.error);
      return this.unknownError('Connection error, please try again later.');
    }

    const customerAccount = customerContext.account;
    const messageId = await this.sendRefreshMessage(customerAccount);
    if (messageId.error) {
      return this.unknownError(messageId.error);
    }

    const appUrl = `https://${customerAccount}.${lambda4meContext.env4me}/app_instances/${config.instanceId}`;
    return this.redirect(appUrl);
  }

  async sendRefreshMessage(customerAccount) {
    try {
      if (!this.sqsHelper) {
        this.sqsHelper = new SQSHelper(null);
      }
      const data = await this.sqsHelper.sendMessage(this.refreshQueueUrl, customerAccount);
      console.log(`Refresh message sent. MessageId: ${data.MessageId}`);
      return data.MessageId;
    } catch (e) {
      console.error('unable to send refresh message to SQS', e);
      return {error: 'Connection error, please try again later.'};
    }
  }

  async getRefreshToken(clientID, clientSecret, code, callbackURL) {
    const lansweeperApiHelper = new LansweeperApiHelper(clientID, clientSecret, null);
    return await lansweeperApiHelper.getRefreshToken(code, callbackURL);
  }

  async appInstanceConfig(lambda4meContext) {
    const provider4meHelper = lambda4meContext.providerContext.js4meHelper;
    const providerToken = await provider4meHelper.getToken();

    const customerAccount = lambda4meContext.customerContext.account;
    const instanceHelper = new InstanceHelper();
    const offeringReference = lambda4meContext.offeringReference;
    const config = await instanceHelper.retrieveInstance(provider4meHelper,
                                                         providerToken,
                                                         offeringReference,
                                                         customerAccount);
    if (config.error || !config.clientID) {
      this.error('Configuration invalid. Got config: %j', config);
      return {error: 'Unable to process event. Configuration error.'};
    } else {
      this.log(`Customer ${customerAccount} is on appOffering: ${config.appOfferingId}`);
    }
    return config;
  }

  async updateInstanceConfig(lambda4meContext, instanceInput) {
    const provider4meHelper = lambda4meContext.providerContext.js4meHelper;
    const providerToken = await provider4meHelper.getToken();
    const instanceHelper = new InstanceHelper();
    return await instanceHelper.updateAppInstance(provider4meHelper,
                                                  providerToken,
                                                  instanceInput);
  }

  respondWith(message, code = 200) {
    return {
      'statusCode': code,
      'body': JSON.stringify({message: message})
    }
  }

  badRequest(message) {
    return this.respondWith(message, 400);
  }

  unknownError(message) {
    return this.respondWith(message, 500);
  }

  redirect(location) {
    return {
      'statusCode': 302,
      'headers': {
        'Location': location
      }
    }
  }

  log(message, ...data) {
    if (data && data.length > 0) {
      console.log(message, ...data);
    } else {
      console.log(message);
    }
  }

  error(message, ...data) {
    if (data && data.length > 0) {
      console.error(message, ...data);
    } else {
      console.error(message);
    }
  }
}
LansweeperLambdaHandler.SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL, 10) || 8;

module.exports = LansweeperLambdaHandler;