'use strict';

const Lambda4meContextHelper = require('./lambda_4me_context_helper');

class Js4meInstallationHandler {
  constructor(customHandler, options) {
    this.lambda4meContextHelper = new Lambda4meContextHelper(options);
    this.customHandler = customHandler;
  }

  async handle(event, context) {
    if (!event.detail || !event.detail.requestParameters
      || (!event.detail.requestParameters.secretId && !event.detail.requestParameters.name)) {
      return this.respondWith('Missing detail.requestParameters.secretId/name value', 400)
    }

    const secretId = event.detail.requestParameters.secretId || event.detail.requestParameters.name;
    const matches = secretId.match(/\/instances\/(.*)$/)
    if (!matches || matches.size < 2) {
      // not an installation secret, simply ignore
      return this.respondWith(`Installation account not found in ${secretId}`, 200)
    }

    const offeringReference = this.lambda4meContextHelper.offeringReference;
    if (offeringReference && secretId.indexOf(offeringReference) === -1) {
      // secrets manager call for other application than current offering
      return this.respondWith(`Current offering ${offeringReference} not found in ${secretId}`, 200)
    }

    const account = matches[1];
    const newInstallation = event.detail.eventName === 'CreateSecret';
    console.log('%s installation for account %s', newInstallation ? 'New' : 'Updated', account);

    const lambda4meContext = await this.lambda4meContextHelper.assemble(account);
    if (!lambda4meContext.customerContext) {
      return this.unknownError('Unable to gather customer context');
    }
    if (!lambda4meContext.providerContext) {
      return this.unknownError('Unable to gather provider context');
    }

    const options = {
      lambdaAwsContext: context,
      lambda4meContext: lambda4meContext,
      delivery: 'secrets-manager',
    };

    const data = {
      newInstallation: newInstallation,
    }
    return await this.customHandler(this, data, options);
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
module.exports = Js4meInstallationHandler;