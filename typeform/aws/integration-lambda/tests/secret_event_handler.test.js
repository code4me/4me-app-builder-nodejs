'use strict';

const app = require('../app');

const SecretsHelper = require('../../../../library/helpers/secrets_helper');
jest.mock('../../../../library/helpers/secrets_helper');

const Js4meHelper = require('../../../../library/helpers/js_4me_helper');
jest.mock('../../../../library/helpers/js_4me_helper');

const InstanceHelper = require("../instance_helper");
jest.mock('../instance_helper');

const TypeformClient = require("../typeform_client");
jest.mock('../typeform_client');

const crypto = require('crypto');

const context = {invokedFunctionArn: 'arn:aws:lambda:eu-west-1:123456789012:function:app-builder-aws-s3-IntegrationFunction-1URR7LBIEMI4E'};

const ciProductData = require('./lambda-ci-data.json');
const LambdaContextMocker = require("../../../../library/aws/secrets-lambda/tests/lambda_context_mocker");

process.env.PARAM_BOOTSTRAP_APP = 'my-app';
process.env.PARAM_BOOTSTRAP_ACCOUNT = 'test-provider';
process.env.PARAM_4ME_DOMAIN = '4me-test-domain';
process.env.PARAM_OFFERING_REFERENCE = 'my-typeform';

it('handles event when typeform secret is present', async () => {
  const event = require('../../events/secret-update.event.json');
  const customerSecrets = {
    typeform_secret: '12345',
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

  expect(await app.lambdaHandler(event, context))
    .toEqual({
               'statusCode': 200,
               'body': JSON.stringify({
                                        message: 'OK',
                                      })
             });

  const expectedAppName = `${process.env.PARAM_BOOTSTRAP_APP}/${process.env.PARAM_OFFERING_REFERENCE}`;
  expect(SecretsHelper).toHaveBeenCalledWith(null, process.env.PARAM_4ME_DOMAIN, expectedAppName);
  lambdaContextMocker.checkCustomerAndProvider4meHelperCreated();
  expect(InstanceHelper).not.toBeCalled();
  expect(TypeformClient).not.toBeCalled();
});

it('handles initial secrets, no typeform secret yet', async () => {
  const event = require('../../events/secret-create.event.json');
  const providerAccessToken = {access_token: 'howard.tanner'};
  const customerAccessToken = {access_token: 'foo.bar'};
  const customerSecrets = {
    application: {
      client_id: 'a',
      client_secret: 'secret',
    },
    secrets: {
      typeform_token: 'my-typeform-token',
    },
  };
  const lambdaContextMocker = new LambdaContextMocker('test-account', customerSecrets);
  const expectedInstanceId = 'fuydjhdf';
  const config = {
    instanceId: expectedInstanceId,
    suspended: true,
    formUrl: 'https://mysite.typeform.com/to/u6nXL7',
    requestId: 80247,
  };

  const bufferFromMock = Buffer.from('fake-random');
  const randomBytesMock = jest.spyOn(crypto, 'randomBytes')
    .mockImplementationOnce(() => bufferFromMock);

  let generatedSecrets = null;
  SecretsHelper.mockImplementation(() => {
    return {
      getSecrets: lambdaContextMocker.mockedGetSecrets,
      updateSecrets: async (secretsAccountKey, newSecrets) => {
        expect(secretsAccountKey).toBe('instances/test-account');
        generatedSecrets = newSecrets;
        return {secrets: {...customerSecrets, ...newSecrets}};
      },
    };
  });

  Js4meHelper.mockImplementationOnce(() => {
    return {
      getToken: async () => customerAccessToken,
    };
  }).mockImplementationOnce(() => {
    return {
      getToken: async () => providerAccessToken,
      getGraphQLQuery: async (_, token) => {
        expect(token).toBe(providerAccessToken);
        return ciProductData;
      },
    };
  });

  let unsuspendCalled = false;
  InstanceHelper.mockImplementation(() => {
    return {
      retrieveInstanceWithRetry: async (js4meHelper, token, reference, customerAccount) => {
        expect(js4meHelper).not.toBeNull();
        expect(token).toBe(providerAccessToken);
        expect(reference).toBe(process.env.PARAM_OFFERING_REFERENCE);
        expect(customerAccount).toBe('test-account');
        return config;
      },
      unsuspendInstance: async (js4meHelper, accessToken, description, instanceId) => {
        unsuspendCalled = true;
        expect(instanceId).toBe(expectedInstanceId);
        return {instanceId: instanceId};
      },
    };
  });

  TypeformClient.mockImplementation(() => {
    return {
      createWebhook: async (formId, tag, typeformSecret, typeformWebhookUri) => {
        expect(formId).toBe('u6nXL7');
        expect(tag).toBe('4me-webhook');
        expect(typeformSecret).toBe(bufferFromMock.toString('hex'));
        expect(typeformWebhookUri)
          .toBe('https://sadasda.execute-api.eu-west-1.amazonaws.com/Prod/integration/?account=test-account');
        return {};
      }
    };
  });

  expect(await app.lambdaHandler(event, context))
    .toEqual({
               'statusCode': 200,
               'body': JSON.stringify({
                                        message: 'OK',
                                      })
             });

  const expectedAppName = `${process.env.PARAM_BOOTSTRAP_APP}/${process.env.PARAM_OFFERING_REFERENCE}`;
  expect(SecretsHelper).toHaveBeenCalledWith(null, process.env.PARAM_4ME_DOMAIN, expectedAppName);
  lambdaContextMocker.checkCustomerAndProvider4meHelperCreated();
  expect(Js4meHelper.mock.calls.length).toBe(2);
  expect(randomBytesMock).toBeCalledWith(64);
  expect(generatedSecrets.typeform_secret).toBe(bufferFromMock.toString('hex'));
  expect(TypeformClient).toBeCalledWith('my-typeform-token');
  expect(unsuspendCalled).toBe(true);
});

it('does not continue if no app instance is found', async () => {
  const event = require('../../events/secret-create.event.json');
  const accessToken = {access_token: 'howard.tanner'};
  const customerSecrets = {
    application: {
      client_id: 'a',
      client_secret: 'secret',
    },
    secrets: {
      typeform_token: 'my-typeform-token',
    },
  };
  const lambdaContextMocker = new LambdaContextMocker('test-account', customerSecrets);

  SecretsHelper.mockImplementation(() => {
    return {
      getSecrets: lambdaContextMocker.mockedGetSecrets,
    };
  });

  Js4meHelper.mockImplementation(() => {
    return {
      getToken: async () => accessToken,
      getGraphQLQuery: async () => ciProductData,
    };
  });

  InstanceHelper.mockImplementation(() => {
    return {
      retrieveInstanceWithRetry: async (js4meHelper, token, reference, customerAccount) => {
        return {"error": "Unable to query 'get app instance details'"};
      },
      suspendInstance: async (js4meHelper, accessToken, description, instanceId, suspensionComment) => {
        fail('suspendInstance should not be called, since no instanceId is known...');
      },
    };
  });

  expect(await app.lambdaHandler(event, context))
    .toEqual({
               'statusCode': 500,
               'body': JSON.stringify({
                                        message: 'Unable to create Typeform webhook',
                                      })
             });

  const expectedAppName = `${process.env.PARAM_BOOTSTRAP_APP}/${process.env.PARAM_OFFERING_REFERENCE}`;
  expect(SecretsHelper).toHaveBeenCalledWith(null, process.env.PARAM_4ME_DOMAIN, expectedAppName);
  lambdaContextMocker.checkCustomerAndProvider4meHelperCreated();
  expect(TypeformClient.mock.calls.length).toBe(0);
});

it('does not store secrets if typeform call fails', async () => {
  const event = require('../../events/secret-create.event.json');
  const accessToken = {access_token: 'howard.tanner'};
  const customerSecrets = {
    application: {
      client_id: 'a',
      client_secret: 'secret',
    },
    secrets: {
      typeform_token: 'my-typeform-token',
    },
  };
  const lambdaContextMocker = new LambdaContextMocker('test-account', customerSecrets);
  const config = {
    formUrl: 'https://mysite.typeform.com/to/u6nXL7',
    requestId: 80247,
  };

  const bufferFromMock = Buffer.from('fake-random2');
  jest.spyOn(crypto, 'randomBytes')
    .mockImplementationOnce(() => bufferFromMock);

  let generatedSecrets = null;
  SecretsHelper.mockImplementation(() => {
    return {
      getSecrets: lambdaContextMocker.mockedGetSecrets,
      updateSecrets: async (secretsAccountKey, newSecrets) => {
        generatedSecrets = newSecrets;
        return {secrets: {...customerSecrets, ...newSecrets}};
      }
    };
  });

  Js4meHelper.mockImplementation(() => {
    return {
      getToken: async () => accessToken,
      getGraphQLQuery: async () => ciProductData,
    };
  });

  let actualSuspensionComment = null;
  InstanceHelper.mockImplementation(() => {
    return {
      retrieveInstanceWithRetry: async (js4meHelper, token, reference, customerAccount) => {
        return config;
      },
      suspendInstance: async (js4meHelper, accessToken, description, instanceId, suspensionComment) => {
        actualSuspensionComment = suspensionComment;
        return {instanceId: instanceId};
      },
    };
  });

  TypeformClient.mockImplementation(() => {
    return {
      createWebhook: async (formId, tag, typeformSecret, typeformWebhookUri) => {
        return {error: 'failed'};
      }
    };
  });

  expect(await app.lambdaHandler(event, context))
    .toEqual({
               'statusCode': 500,
               'body': JSON.stringify({
                                        message: 'Unable to create Typeform webhook',
                                      })
             });

  const expectedAppName = `${process.env.PARAM_BOOTSTRAP_APP}/${process.env.PARAM_OFFERING_REFERENCE}`;
  expect(SecretsHelper).toHaveBeenCalledWith(null, process.env.PARAM_4ME_DOMAIN, expectedAppName);
  lambdaContextMocker.checkCustomerAndProvider4meHelperCreated();
  expect(TypeformClient).toBeCalledWith('my-typeform-token');
  expect(generatedSecrets).toBeNull();
  expect(actualSuspensionComment).toBe('Error creating Typeform webhook. Please check the Typeform token and Form ID.');
});
