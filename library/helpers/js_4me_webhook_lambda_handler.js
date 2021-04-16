'use strict';

const axios = require('axios');
const Lambda4meContextHelper = require("./lambda_4me_context_helper");
const Js4meHelper = require("./js_4me_helper");

class Js4meWebhookLambdaHandler {
  constructor(customHandler, options) {
    this.lambda4meContextHelper = new Lambda4meContextHelper(options);
    this.providerAccount = this.isBlank(options.providerAccount) ? null : options.providerAccount;
    this.customHandler = customHandler;
  }

  async handleCustomerEvent(event, context) {
    if (event.httpMethod !== 'POST') {
      return this.respondWith('Method not allowed. Use POST instead.', 405);
    }

    const options = await this.createOptions(event, context);
    const lambda4meContext = options.lambda4meContext;
    if (!lambda4meContext.customerContext) {
      return this.respondWith('Unable to determine customer context', 400);
    }
    return await this.verifyAndForward(lambda4meContext.customerContext, event.body, options);
  }

  async handleProviderEvent(event, context) {
    if (event.httpMethod !== 'POST') {
      return this.respondWith('Method not allowed. Use POST instead.', 405);
    }

    const options = await this.createOptions(event, context);
    const lambda4meContext = options.lambda4meContext;
    if (!lambda4meContext.providerContext) {
      return this.respondWith('Unable to determine provider context', 400);
    }
    return await this.verifyAndForward(lambda4meContext.providerContext, event.body, options);
  }

  async verifyAndForward(currentContext, rawBody, options) {
    const body = JSON.parse(rawBody);
    if (!body.jwt) {
      return this.badRequest('Expected jwt in body');
    }

    const data = await currentContext.js4meHelper.get4meData(body.jwt);
    if (data.error) {
      this.error('(%s) Incorrect request: %s\n%j', options.delivery, data.error.message, body);
      return this.badRequest(`Bad JWT - (${options.delivery}) Incorrect request: ${data.error.message}\n${lambda4meContext.env4me} - ${currentContext.account}`);
    }
    this.log('parsed jwt: %j', data);

    const triggeredEvent = data.event;

    this.log('triggered event %j', triggeredEvent);
    if (triggeredEvent === 'webhook.verify') {
      return await this.handleWebhookVerify(data, options);
    }

    return await this.customHandler(this, data, options);
  }

  async createOptions(event, context) {
    let customerAccount;
    if ((event.queryStringParameters || {}).account) {
      customerAccount = event.queryStringParameters.account;
    } else if ((event.pathParameters || {}).account) {
      customerAccount = event.pathParameters.account;
    }

    let lambda4meContext;
    if (customerAccount && this.providerAccount) {
      lambda4meContext = await this.lambda4meContextHelper.assemble(customerAccount);
    } else if (this.providerAccount) {
      lambda4meContext = await this.lambda4meContextHelper.assembleProviderOnly();
    } else if (customerAccount) {
      lambda4meContext = await this.lambda4meContextHelper.assembleCustomerOnly(customerAccount);
    }

    const delivery = event.headers[Js4meHelper.DELIVERY_HEADER];

    return {
      lambdaAwsContext: context,
      lambda4meContext: lambda4meContext,
      delivery: delivery,
    }
  }

  async handleWebhookVerify(data, options) {
    try {
      const callback = data.payload.callback;
      this.log('(%s) Verifying webhook: %s', options.delivery, callback);
      const response = await axios.get(callback);
      if (response.status === 200) {
        return this.respondWith('Webhook verified');
      } else {
        this.error('(%s) Webhook verification failed for %s\n%j', options.delivery, callback, response);
      }
    } catch (error) {
      this.error('(%s) Error verifying webhook', options.delivery);
      this.error(error);
    }

    return this.unknownError('Unable to verify webhook');
  }

  isBlank(value) {
    return !value || value.replace(/&nbsp;/g, "").replace(/&#160;/g, "").match(/^\s*$/) !== null;
  }

  // helper method that can be used in the lambda's

  respondWith(message, code = 200) {
    return {
      'statusCode': code,
      'body': JSON.stringify({ message: message })
    }
  }

  badRequest(message) {
    return this.respondWith(message, 400);
  }

  unknownError(message) {
    return this.respondWith(message, 500);
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
module.exports = Js4meWebhookLambdaHandler;