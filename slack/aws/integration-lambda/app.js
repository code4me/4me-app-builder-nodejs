const LambdaHandler = require('./lambda_handler')

/**
 *
 * @param {Object} event    - API Gateway Lambda Proxy Input Format
 *                            https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 *
 * @param {Object} context  - AWS Lambda context object in Node.js
 *                            https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 *
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *                            https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 *
 */
exports.lambdaHandler = async (inputLambdaEvent, lambdaContext) => {
  const handler = new LambdaHandler({
    secretApplicationName: process.env.PARAM_BOOTSTRAP_APP,
    offeringReference: process.env.PARAM_OFFERING_REFERENCE,
    env4me: process.env.PARAM_4ME_DOMAIN,
    provider: process.env.PARAM_BOOTSTRAP_ACCOUNT,
    sqsQueueUrl: process.env.SQS_QUEUE_URL,
  })

  const outputLambdaEvent = await handler.handle(inputLambdaEvent, lambdaContext)

  if (outputLambdaEvent.statusCode !== 200 && outputLambdaEvent.statusCode !== 302) {
    console.error('%j', outputLambdaEvent)
  } else {
    console.info('%j', outputLambdaEvent)
  }

  return outputLambdaEvent
}
