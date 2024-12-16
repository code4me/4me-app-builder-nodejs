'use strict';

const app = require('../app');
const event = require('../../events/typeform.event.json');

const SecretsHelper = require('../../../../library/helpers/secrets_helper');
jest.mock('../../../../library/helpers/secrets_helper');

const Js4meHelper = require('../../../../library/helpers/js_4me_helper');
jest.mock('../../../../library/helpers/js_4me_helper');

const TypeformHelper = require('../typeform_helper');
jest.mock('../typeform_helper');

const NotesHelper = require('../notes_helper');
jest.mock('../notes_helper');

const InstanceHelper = require('../instance_helper');
const LambdaContextMocker = require('../../../../library/aws/secrets-lambda/tests/lambda_context_mocker');
jest.mock('../instance_helper');

const context = {invokedFunctionArn: 'arn:aws:lambda:eu-west-1:123456789012:function:app-builder-aws-s3-IntegrationFunction-1URR7LBIEMI4E'};

process.env.PARAM_BOOTSTRAP_APP = 'my-app';
process.env.PARAM_BOOTSTRAP_ACCOUNT = 'test-provider';
process.env.PARAM_4ME_DOMAIN = '4me-test-domain';
process.env.PARAM_OFFERING_REFERENCE = 'typeform';

it('handles receiving form filled event', async () => {
  const providerAccessToken = {access_token: 'howard.tanner'};
  const customerAccessToken = {access_token: 'foo.bar'};
  const customerSecrets = {
    typeform_secret: '12345',
    application: {
      client_id: 'a',
      client_secret: 'secret',
    },
  };
  const lambdaContextMocker = new LambdaContextMocker('test-account', customerSecrets);

  const config = {
    formUrl: 'https://mysite.typeform.com/to/u6nXL7',
    requestId: 80247,
  };

  SecretsHelper.mockImplementation(() => {
    return {
      getSecrets: lambdaContextMocker.mockedGetSecrets,
    };
  });

  Js4meHelper.mockImplementationOnce(() => {
    return {
      getToken: async () => customerAccessToken,
    };
  }).mockImplementationOnce(() => {
    return {
      getToken: async () => providerAccessToken,
    };
  });

  InstanceHelper.mockImplementation(() => {
    return {
      retrieveInstance: async (js4meHelper, token, reference, customerAccount) => {
        expect(js4meHelper).not.toBeNull();
        expect(token).toBe(providerAccessToken);
        expect(reference).toBe(process.env.PARAM_OFFERING_REFERENCE);
        expect(customerAccount).toBe('test-account');
        return config;
      }
    };
  });

  let actualBody, actualSig, actualSecret = null;
  let actualFormResponse = null;
  const expectedNote = 'converted form response';

  TypeformHelper.mockImplementation(() => {
    return {
      isMessageValid: (secret, expectedSig, body) => {
        actualBody = body;
        actualSig = expectedSig;
        actualSecret = secret;
        return true;
      },
      convertResponseToNote: (formResponse) => {
        actualFormResponse = formResponse;
        return expectedNote;
      },
    };
  });

  NotesHelper.mockImplementation(() => {
    return {
      addNote: async (js4meHelper, token, requestId, note) => {
        expect(js4meHelper).not.toBeNull();
        expect(token).toBe(customerAccessToken);
        expect(requestId).toEqual(config.requestId);
        expect(note).toEqual(expectedNote);
        return {request: {id: "abc"}};
      },
    };
  });

  expect(await app.lambdaHandler(event, context))
    .toEqual({
               'statusCode': 200,
               'body': JSON.stringify({
                                        message: 'Thanks for 01F0KGZX8T5N8THAFESVJRHBH2',
                                      })
             });

  const expectedAppName = `${process.env.PARAM_BOOTSTRAP_APP}/${process.env.PARAM_OFFERING_REFERENCE}`;
  expect(SecretsHelper).toHaveBeenCalledWith(null, process.env.PARAM_4ME_DOMAIN, expectedAppName);
  expect(SecretsHelper).toHaveBeenCalledWith(null, process.env.PARAM_4ME_DOMAIN, expectedAppName);
  lambdaContextMocker.checkCustomerAndProvider4meHelperCreated();
  expect(actualSecret).toBe(customerSecrets.typeform_secret);
  expect(actualBody).toEqual(event.body);
  expect(actualSig).toEqual(event.headers['Typeform-Signature']);
  expect(actualFormResponse).toEqual(JSON.parse(event.body).form_response);
});

it('rejects message with incorrect hash', async () => {
  const customerSecrets = {
    typeform_secret: '123',
    application: {
      client_id: 'a',
      client_secret: 'secret',
    },
  };
  const lambdaContextMocker = new LambdaContextMocker('test-account', customerSecrets);

  SecretsHelper.mockImplementation(() => {
    return {
      getSecrets: lambdaContextMocker.mockedGetSecrets,
    };
  });

  let actualBody, actualSig, actualSecret = null;
  TypeformHelper.mockImplementation(() => {
    return {
      isMessageValid: (secret, expectedSig, body) => {
        actualBody = body;
        actualSig = expectedSig;
        actualSecret = secret;
        return false;
      },
    };
  });

  expect(await app.lambdaHandler(event, context))
    .toEqual({
               'statusCode': 400,
               'body': JSON.stringify({
                                        message: 'Bad signature',
                                      })
             });

  const expectedAppName = `${process.env.PARAM_BOOTSTRAP_APP}/${process.env.PARAM_OFFERING_REFERENCE}`;
  expect(SecretsHelper).toHaveBeenCalledWith(null, process.env.PARAM_4ME_DOMAIN, expectedAppName);
  lambdaContextMocker.checkCustomerAndProvider4meHelperCreated();
  expect(actualSecret).toBe(customerSecrets.typeform_secret);
  expect(actualBody).toEqual(event.body);
  expect(actualSig).toEqual(event.headers['Typeform-Signature']);
  expect(NotesHelper).not.toBeCalled();
});
