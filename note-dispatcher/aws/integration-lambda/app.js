const Js4meWebhookLambdaHandler = require('../../../library/helpers/js_4me_webhook_lambda_handler');
const FunTranslationsHelper = require('./fun_translations_helper')
const ExternalStoreHelper = require("./external_store_helper");

async function handleRequestNoteAdded(handler, data, options) {
  const delivery = options.delivery;
  try {
    // handler.log('(%s) received event', delivery);
    // handler.log('(%s) data: %j', delivery, data);
    // handler.log('(%s) secrets: %j', delivery, options.lambda4meContext.customerContext.secrets);

    if (data && data.payload) {
      const text = data.payload.text;
      const url = data.payload.url;
      if (text && url) {
        handler.log('(%s) will translate: %s', delivery, text);
        const translationsHelper = new FunTranslationsHelper();
        const response = await translationsHelper.getRandomTranslation(text);

        handler.log('(%s) storing at %s\n%j', delivery, url, response);
        const result = {input: data, translationResponse: response};

        const externalStoreHelper = new ExternalStoreHelper();
        const postResponse = await externalStoreHelper.store(url, result);
        if (!postResponse.error) {
          return handler.respondWith('note-dispatcher event handling complete');
        }
        handler.error('(%s) error storing response\n%j', delivery, postResponse);
      } else {
        handler.error('(%s) no text or url in\n%j', delivery, data.payload);
      }
    } else {
      handler.error('(%s) no payload in\n%j', delivery, data);
    }
  } catch (error) {
    handler.error('(%s) note-dispatcher event handling failed', delivery);
    handler.error(error);
  }
  return handler.unknownError('Unable to process note-dispatcher event');
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
  console.log('received:\n%j', event);
  const options = {
    applicationName: process.env.PARAM_BOOTSTRAP_APP,
    env4me: process.env.PARAM_4ME_DOMAIN,
    offeringReference: process.env.PARAM_OFFERING_REFERENCE,
  };
  const handler = new Js4meWebhookLambdaHandler(handleRequestNoteAdded, options);
  return await handler.handleCustomerEvent(event, context);
};
