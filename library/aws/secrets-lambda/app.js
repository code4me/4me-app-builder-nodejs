const Js4meWebhookLambdaHandler = require('../../helpers/js_4me_webhook_lambda_handler');
const SecretsHelper = require('../../helpers/secrets_helper');

async function handleAppInstanceSecretsUpdate(handler, data, options) {
    try {
        handler.log('(%s) Updating secrets', options.delivery);
        const customerAccount = data.payload.customer_account_id;
        const offeringRef = data.payload.app_offering.reference;
        const enabled_references = process.env.PARAM_ENABLED_OFFERINGS ? process.env.PARAM_ENABLED_OFFERINGS.split(',') : null;
        if (enabled_references && enabled_references[0] !== '*' && enabled_references.indexOf(offeringRef) < 0) {
            handler.log('Handling of secrets limited to app_references: %j', enabled_references);
            return handler.respondWith(`No action for app_reference: ${offeringRef}`);
        }
        const env4me = options.lambda4meContext.env4me;
        const secretsApplicationName = `${options.lambda4meContext.applicationName}/${offeringRef}`;
        const secretsAccountKey = `instances/${customerAccount}`;
        const integrationSecretsHelper = new SecretsHelper(null, env4me, secretsApplicationName);

        const newSecrets = {};
        if (data.payload.application) {
            newSecrets.application = data.payload.application;
        }
        if (data.payload.policy) {
            newSecrets.policy = data.payload.policy;
        }
        if (data.payload.secrets) {
            newSecrets.secrets = data.payload.secrets;
        }
        const result = await integrationSecretsHelper.upsertSecret(secretsAccountKey, newSecrets);
        if (!result.secrets) {
            return handler.unknownError('Unable to store secrets');
        }
        return handler.respondWith('Secrets stored');
    } catch (error) {
        handler.error('(%s) Error updating secrets', options.delivery);
        handler.error(error);
    }
    return handler.respondWith('Unable to process secrets', 500);
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
    const handler = new Js4meWebhookLambdaHandler(handleAppInstanceSecretsUpdate, {
        applicationName: process.env.PARAM_BOOTSTRAP_APP,
        env4me: process.env.PARAM_4ME_DOMAIN,
        providerAccount: process.env.PARAM_BOOTSTRAP_ACCOUNT,
    });
    return await handler.handleProviderEvent(event, context);
};
