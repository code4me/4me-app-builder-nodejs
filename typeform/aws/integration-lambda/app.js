const Js4meInstallationHandler = require('../../../library/helpers/js_4me_installation_handler');
const TypeformLambdaHandler = require('./typeform_lambda_handler')
const TypeformClient = require('./typeform_client');
const InstanceHelper = require('./instance_helper');
const crypto = require('crypto');

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

async function createTypeformWebhook(options) {
  const provider4meHelper = options.lambda4meContext.providerContext.js4meHelper;
  const accessToken = await provider4meHelper.getToken();

  // determine public URL of lambda to be called by typeform
  const lambdaArn = options.lambdaAwsContext.invokedFunctionArn;
  const lambdaUrl = await getLambdaUrl(provider4meHelper, accessToken, lambdaArn);
  if (lambdaUrl.error) {
    return lambdaUrl;
  }

  const customerContext = options.lambda4meContext.customerContext;
  const customerAccount = customerContext.account;
  const offeringReference = options.lambda4meContext.offeringReference;
  const description = `instance of ${offeringReference} for ${customerAccount}`;

  // find which form to create webhook for
  const instanceHelper = new InstanceHelper();
  let config = await instanceHelper.retrieveInstanceWithRetry(provider4meHelper,
                                                              accessToken,
                                                              offeringReference,
                                                              customerAccount);

  if (config.error) {
    console.log('Unable to query instance. Too quick after app offering installation?');
    return config;
  }

  const formId = extractFormId(config.formUrl);
  if (!formId) {
    await suspendInstance(instanceHelper, provider4meHelper, accessToken, description,
                          config.instanceId, 'Please fill Form ID.');
    return {error: 'No Typeform form ID known'};
  }

  // find customer's Typeform token
  const instanceSecretFields = customerContext.secrets.secrets;
  if (!instanceSecretFields || !instanceSecretFields.typeform_token) {
    await suspendInstance(instanceHelper, provider4meHelper, accessToken, description,
                          config.instanceId, 'Please fill Typeform token.');
    return {error: 'No Typeform token available'};
  }
  const typeformToken = instanceSecretFields.typeform_token;

  // generate secret with which Typeform will sign messages
  const typeformSecret = crypto.randomBytes(64).toString('hex');

  // upsert typeform webhook
  const typeformClient = new TypeformClient(typeformToken);
  const typeformWebhookUri = `${lambdaUrl}?account=${customerAccount}`;
  const createResult = await typeformClient.createWebhook(formId,
                                                          '4me-webhook',
                                                          typeformSecret,
                                                          typeformWebhookUri);
  if (createResult.error) {
    await suspendInstance(instanceHelper, provider4meHelper, accessToken, description,
                          config.instanceId,
                          'Error creating Typeform webhook. ' +
                            'Please check the Typeform token and Form ID.');
    return {error: 'Unable to create Typeform webhook'};
  }

  // store generated secret so we can verify messages
  const secretsHelper = customerContext.secretsHelper;
  const secretsAccountKey = customerContext.secretsAccountKey;
  const awsResult = await secretsHelper.updateSecrets(secretsAccountKey, {typeform_secret: typeformSecret});
  if (awsResult.secrets.typeform_secret) {
    if (config.suspended) {
      const unsuspendResult = await instanceHelper.unsuspendInstance(provider4meHelper,
                                                                     accessToken,
                                                                     description,
                                                                     config.instanceId);
      if (!unsuspendResult.error) {
        console.info('Unsuspended %s', description);
      }
    } else {
      console.info('%s was not suspended', description);
    }
  } else {
    await suspendInstance(instanceHelper, provider4meHelper, accessToken, description,
                          config.instanceId, 'Internal error in integration.');
    return {error: 'Unable to store Typeform webhook secret'};
  }

  return awsResult;
}

function extractFormId(formUrl) {
  if (formUrl) {
    const parts = formUrl.split('/');
    return parts[parts.length - 1];
  }
}

async function suspendInstance(instanceHelper, provider4meHelper, accessToken,
                               description, instanceId, comment) {
  const suspendResult = await instanceHelper.suspendInstance(provider4meHelper,
                                                             accessToken,
                                                             description,
                                                             instanceId,
                                                             comment);
  if (!suspendResult.error) {
    console.info('Suspended %s', description);
  }
}

async function handleInstallationChanged(handler, data, options) {
  const secrets = options.lambda4meContext.customerContext.secrets;
  if (secrets.typeform_secret) {
    console.log('No need to update Typeform webhook');
  } else {
    const createResult = await createTypeformWebhook(options);
    if (createResult.error) {
      console.error('unable to create typeform webhook\n%j', createResult.error);

      return handler.unknownError('Unable to create Typeform webhook');
    }
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
  };
  if (event.source === 'aws.secretsmanager') {
    // no verification of message required, as event.source is set by AWS
    const handler = new Js4meInstallationHandler(handleInstallationChanged, options);
    return await handler.handle(event, context);
  } else {
    const handler = new TypeformLambdaHandler(options);
    return await handler.handle(event, context);
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

  if (resultEvent.statusCode !== 200) {
    console.error('%j', resultEvent);
  } else {
    console.info('%j', resultEvent);
  }
  return resultEvent;
};
