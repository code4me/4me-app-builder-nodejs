const Js4meInstallationHandler = require('../../../library/helpers/js_4me_installation_handler');
const LansweeperLambdaHandler = require('./lansweeper_lambda_handler')
const InstanceHelper = require('./instance_helper');
const crypto = require('crypto');
const LansweeperIntegration = require('./lansweeper_integration');
const LansweeperAuthorizationError = require('./errors/lansweeper_authorization_error');
const Js4meAuthorizationError = require('../../../library/helpers/errors/js_4me_authorization_error');

async function findConfigurationItem(js4meHelper, accessToken, arn) {
  const filter = {systemID: {values: [arn]}};
  const result = await js4meHelper.getGraphQLQuery('Configuration item',
                                                   accessToken, `
       query($filter: ConfigurationItemFilter) {
         configurationItems(first: 1, filter: $filter ) {
           nodes { id customFields { id value } }
         }
       }`,
                                                   {
                                                     filter: filter,
                                                   });
  if (result.error) {
    console.error('%j', result);
    return result;
  } else {
    const nodes = result.configurationItems.nodes;
    if (!nodes || nodes.length === 0) {
      return {error: 'No lambda CI found'};
    }
    return nodes[0];
  }
}

async function getLambdaUrl(provider4meHelper, accessToken, lambdaArn) {
  const lambdaCi = await findConfigurationItem(provider4meHelper, accessToken, lambdaArn);
  if (lambdaCi.error) {
    return lambdaCi;
  }
  const apiUrlField = lambdaCi.customFields.find(f => f.id === 'api_url');
  if (!apiUrlField) {
    return {error: 'No api_url found'};
  }
  const lambdaUrl = apiUrlField.value;
  if (!lambdaUrl) {
    return {error: 'No api_url value found'};
  }
  return lambdaUrl;
}

async function updateLansweeperCallbackURL(callbackSecret, options) {
  const provider4meHelper = options.lambda4meContext.providerContext.js4meHelper;
  const accessToken = await provider4meHelper.getToken();

  const customerContext = options.lambda4meContext.customerContext;
  const customerAccount = customerContext.account;
  const offeringReference = options.lambda4meContext.offeringReference;

  const instanceHelper = new InstanceHelper();
  let config = await instanceHelper.retrieveInstanceWithRetry(provider4meHelper,
                                                              accessToken,
                                                              offeringReference,
                                                              customerAccount);

  if (config.error) {
    console.log('Unable to query instance. Too quick after app offering installation?');
    return config;
  }

  let instanceInput = null;
  if (config.connectionStatus !== 'pending_callback_url') {
    instanceInput = await getInvalidCurrentAuthorizationInput(customerContext, config.clientID);
    if (!instanceInput.suspended) {
      return config;
    }
  }

  if (!instanceInput || !instanceInput.suspensionComment) {
    const lambdaArn = options.lambdaAwsContext.invokedFunctionArn;
    instanceInput = await getPendingAuthorizationInput(lambdaArn, provider4meHelper, accessToken, customerAccount, callbackSecret);
  }
  if (instanceInput.error) {
    return instanceInput;
  }

  // update customer app instance in 4me
  const updateCustomFields = await instanceHelper.updateAppInstance(provider4meHelper, accessToken, {id: config.instanceId, ...instanceInput});
  if (updateCustomFields.error) {
    console.error('Unable to set app instance custom fields %s:\n%j', instanceInput, updateCustomFields.error);
    return {error: 'Unable to set app instance custom fields'};
  }

  return updateCustomFields;
}

async function getInvalidCurrentAuthorizationInput(customerContext, clientID) {
  try {
    const clientSecret = customerContext.secrets.secrets.client_secret;
    const refreshToken = customerContext.secrets.refresh_token;

    const integration = new LansweeperIntegration(clientID, clientSecret, refreshToken, customerContext.js4meHelper);
    const valid = await integration.validateCredentials();
    return {suspended: !valid};
  } catch (error) {
    if (error instanceof LansweeperAuthorizationError) {
      // lansweeper credentials not OK, act as if we did not have them already: suspend instance and await auth
      return {suspended: true};
    } else if (error instanceof Js4meAuthorizationError) {
      // unable to access customer account
      return {
        suspended: true,
        suspensionComment: `Unable to connect to customer account. Please rotate the token and unsuspend.`,
      }
    } else {
      console.error(`Unable to verify credentials: ${error}`);
      // unable to verify credentials, assume they are still valid. They will be checked on next sync.
      return {suspended: false};
    }
  }
}

async function getPendingAuthorizationInput(lambdaArn, provider4meHelper, accessToken, customerAccount, callbackSecret) {
  // determine public URL of lambda for the callback URI
  const lambdaUrl = await getLambdaUrl(provider4meHelper, accessToken, lambdaArn);
  if (lambdaUrl.error) {
    return lambdaUrl;
  }

  return {
    suspended: true,
    suspensionComment: 'Awaiting authorization from Lansweeper',
    customFields: [
      {
        id: 'callback_url',
        value: `${lambdaUrl}${customerAccount}/${callbackSecret}`,
      },
      {
        id: 'connection_status',
        value: 'pending_authorization',
      }
    ]
  }
}

async function generateCustomerSecret(options) {
  const customerContext = options.lambda4meContext.customerContext;

  const callbackSecret = crypto.randomBytes(16).toString('hex');
  // store generated secret so we can verify callback
  const secretsHelper = customerContext.secretsHelper;
  const secretsAccountKey = customerContext.secretsAccountKey;
  return await secretsHelper.updateSecrets(secretsAccountKey, {callback_secret: callbackSecret});
}

async function handleInstallationChanged(handler, data, options) {
  let callbackSecret;
  const secrets = options.lambda4meContext.customerContext.secrets;
  if (secrets.callback_secret) {
    console.log('Lansweeper callback URI already set');
    callbackSecret = secrets.callback_secret;
  } else {
    const awsResult = await generateCustomerSecret(options);
    callbackSecret = awsResult.secrets.callback_secret;
    if (!callbackSecret) {
      return {error: 'Unable to store Lansweeper callback secret'};
    }
  }
  const createResult = await updateLansweeperCallbackURL(callbackSecret, options);
  if (createResult.error) {
    console.error('unable to update Lansweeper callback URL\n%j', createResult.error);

    return handler.unknownError('Unable to update Lansweeper callback URL');
  }

  return handler.respondWith('OK');
}

async function handleAny(event, context) {
  console.log('received:\n%j', event);
  const options = {
    applicationName: process.env.PARAM_BOOTSTRAP_APP,
    providerAccount: process.env.PARAM_BOOTSTRAP_ACCOUNT,
    env4me: process.env.PARAM_4ME_DOMAIN,
    offeringReference: process.env.PARAM_OFFERING_REFERENCE,
    refreshQueueUrl: process.env.REFRESH_QUEUE_URL,
  };
  if (event.source === 'aws.secretsmanager') {
    // no verification of message required, as event.source is set by AWS
    const handler = new Js4meInstallationHandler(handleInstallationChanged, options);
    return await handler.handle(event, context);
  } else {
    const handler = new LansweeperLambdaHandler(options);
    if (event.source === 'aws.events') {
      return await handler.handleScheduledEvent(event, context);
    } else if (event.Records) {
      return await handler.handleSQSEvent(event, context);
    } else {
      return await handler.handleHTTPEvent(event, context);
    }
  }
}

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */
exports.lambdaHandler = async (event, context) => {
  const resultEvent = await handleAny(event, context);

  if (resultEvent.statusCode !== 200 && resultEvent.statusCode !== 302) {
    console.error('%j', resultEvent);
  } else {
    console.info('%j', resultEvent);
  }
  return resultEvent;
};
