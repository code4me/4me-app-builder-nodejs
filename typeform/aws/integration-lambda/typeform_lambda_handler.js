'use strict';

const NotesHelper = require('./notes_helper')
const InstanceHelper = require('./instance_helper');
const Lambda4meContextHelper = require('../../../library/helpers/lambda_4me_context_helper');
const TypeformHelper = require('./typeform_helper');

class TypeformLambdaHandler {
  constructor(options) {
    this.lambda4meContextHelper = new Lambda4meContextHelper(options);
    this.typeformHelper = new TypeformHelper();
  }

  async handle(event, context) {
    if (event.httpMethod !== 'POST') {
      return this.respondWith('Method not allowed. Use POST instead.', 405)
    }

    const customerAccount = event.queryStringParameters.account;
    if (!customerAccount || customerAccount === '') {
      return this.badRequest('Missing account parameter');
    }
    const lambda4meContext = await this.lambda4meContextHelper.assemble(customerAccount);
    const customerContext = lambda4meContext.customerContext;
    if (!customerContext || !customerContext.secrets) {
      console.error('No customer secrets. Got %j', lambda4meContext);
      return this.unknownError('Unable to gather customer context');
    }

    const typeformSecret = customerContext.secrets.typeform_secret;
    if (!typeformSecret) {
      return this.unknownError('Unable to verify message');
    }

    if (!this.isMessageValid(event, typeformSecret)) {
      return this.badRequest('Bad signature');
    }

    // successful
    const body = JSON.parse(event.body);
    const eventId = body.event_id
    const eventType = body.event_type
    if (eventType === 'form_response') {
      return await this.handleFormResponse(lambda4meContext, eventId, body.form_response);
    } else {
      return this.badRequest(`Unsupported event_type: ${eventType}`);
    }
  }

  async handleFormResponse(lambda4meContext, eventId, formResponse) {
    const requestId = await this.findRequestId(lambda4meContext);
    if (requestId.error) {
      return this.unknownError('Unable to find request id');
    }
    const note = this.typeformHelper.convertResponseToNote(formResponse);

    const customer4meHelper = lambda4meContext.customerContext.js4meHelper;
    const customerToken = await customer4meHelper.getToken();
    const notesHelper = new NotesHelper();
    const result = await notesHelper.addNote(customer4meHelper, customerToken, requestId, note);
    if (!result || result.error) {
      return this.unknownError('Unable to add note');
    }

    return this.respondWith(`Thanks for ${eventId}`, 200);
  }

  async findRequestId(lambda4meContext) {
    const provider4meHelper = lambda4meContext.providerContext.js4meHelper;
    const providerToken = await provider4meHelper.getToken();

    const customerAccount = lambda4meContext.customerContext.account;
    const instanceHelper = new InstanceHelper();
    const integrationReference = lambda4meContext.integrationReference;
    const config = await instanceHelper.retrieveInstance(provider4meHelper,
                                                         providerToken,
                                                         integrationReference,
                                                         customerAccount);
    if (config.error || !config.requestId) {
      this.error('Unable to determine request to work with. Got config: %j', config);
      return {error: 'Unable to process event. Configuration error.'};
    }
    return config.requestId;
  }

  isMessageValid(event, secret) {
    const expectedSig = event.headers['Typeform-Signature'];
    return this.typeformHelper.isMessageValid(secret, expectedSig, event.body);
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

module.exports = TypeformLambdaHandler;