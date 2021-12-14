'use strict';

const app = require('../app');

const SecretsHelper = require('../../../../library/helpers/secrets_helper');
jest.mock('../../../../library/helpers/secrets_helper');

const Js4meHelper = require('../../../../library/helpers/js_4me_helper');
jest.mock('../../../../library/helpers/js_4me_helper');

const InstanceHelper = require('../instance_helper');
jest.mock('../instance_helper');

const LansweeperClient = require('../lansweeper_client');
jest.mock('../lansweeper_client');

const LansweeperIntegration = require('../lansweeper_integration');
jest.mock('../lansweeper_integration');

const LambdaContextMocker = require('../../../../library/aws/secrets-lambda/tests/lambda_context_mocker');
const LansweeperAuthorizationError = require('../errors/lansweeper_authorization_error');
const Js4meAuthorizationError = require('../../../../library/helpers/errors/js_4me_authorization_error');

const context = {invokedFunctionArn: 'arn:aws:lambda:eu-west-1:123456789012:function:app-builder-aws-s3-IntegrationFunction-1URR7LBIEMI4E'};
const ciProductData = require('./lambda-ci-data.json');
const event = require('../../events/secret-update.event.json');
const providerAccessToken = {access_token: 'howard.tanner'};
const expectedInstanceId = 'fuydjhdf';

process.env.PARAM_BOOTSTRAP_APP = 'my-app';
process.env.PARAM_BOOTSTRAP_ACCOUNT = 'test-provider';
process.env.PARAM_4ME_DOMAIN = '4me-test-domain';
process.env.PARAM_OFFERING_REFERENCE = 'my-lansweeper';

describe('known app_instance', () => {
  it('handles event and sets callbackURL in the app instance when status is pending_callback_url', async () => {
    const updateAppInstance = async (js4meHelper, accessToken, instanceInput) => {
      expect(instanceInput.id).toBe(expectedInstanceId);
      expect(instanceInput.suspended).toBe(true);
      expect(instanceInput.suspensionComment).toBe('Awaiting authorization from Lansweeper');
      expect(instanceInput.customFields).not.toBeUndefined();
      return {instanceId: instanceInput.id};
    };

    await validateHandling('pending_callback_url', updateAppInstance);

    expect(LansweeperIntegration).not.toBeCalled();
    expect(LansweeperClient).not.toBeCalled();
  });

  it('does nothing when status is success and credentials are valid', async () => {
    const updateAppInstance = jest.fn();
    const validateCredentials = setupCredentialValidation(async () => true);

    await validateHandling('success', updateAppInstance);

    expect(validateCredentials).toBeCalled();
    expect(updateAppInstance).not.toBeCalled();
    expect(LansweeperClient).not.toBeCalled();
  });

  it('does nothing when status is success and credentials cannot be checked', async () => {
    const validateCredentials = setupCredentialValidation(async () => {
      throw new Error('oops')
    });
    const updateAppInstance = jest.fn();

    await validateHandling('success', updateAppInstance);

    expect(validateCredentials).toBeCalled();
    expect(updateAppInstance).not.toBeCalled();
    expect(LansweeperClient).not.toBeCalled();
  });

  it('handles event and sets callbackURL when Lansweeper credentials are invalid', async () => {
    const validateCredentials = setupCredentialValidation(async () => {
      throw new LansweeperAuthorizationError('no')
    });
    const updateAppInstance = async (js4meHelper, accessToken, instanceInput) => {
      expect(instanceInput.id).toBe(expectedInstanceId);
      expect(instanceInput.suspended).toBe(true);
      expect(instanceInput.suspensionComment).toBe('Awaiting authorization from Lansweeper');
      expect(instanceInput.customFields).not.toBeUndefined();
      return {instanceId: instanceInput.id};
    };

    await validateHandling('success', updateAppInstance);

    expect(validateCredentials).toBeCalled();
    expect(LansweeperClient).not.toBeCalled();
  });

  it('handles event and suspends if customer account credentials are invalid', async () => {
    const validateCredentials = setupCredentialValidation(async () => {
      throw new Js4meAuthorizationError('no')
    });
    const updateAppInstance = async (js4meHelper, accessToken, instanceInput) => {
      expect(instanceInput.id).toBe(expectedInstanceId);
      expect(instanceInput.suspended).toBe(true);
      expect(instanceInput.suspensionComment).toBe(
        'Unable to connect to customer account. Please rotate the token and unsuspend.');
      expect(instanceInput.customFields).toBeUndefined();
      return {instanceId: instanceInput.id};
    };

    await validateHandling('success', updateAppInstance);

    expect(validateCredentials).toBeCalled();
    expect(LansweeperClient).not.toBeCalled();
  });

  async function validateHandling(connectionStatus, updateAppInstance) {
    const config = {
      instanceId: expectedInstanceId,
      connectionStatus: connectionStatus,
    };
    const lambdaContextMocker = await setupSecretsHelper();

    Js4meHelper.mockImplementationOnce(() => ({
      getToken: async () => customerAccessToken,
    })).mockImplementationOnce(() => ({
      getToken: async () => providerAccessToken,
      getGraphQLQuery: async (_, token) => {
        expect(token).toBe(providerAccessToken);
        return ciProductData;
      },
    }));

    InstanceHelper.mockImplementation(() => ({
      retrieveInstanceWithRetry: async (js4meHelper, token, reference, customerAccount) => {
        expect(js4meHelper).not.toBeNull();
        expect(token).toBe(providerAccessToken);
        expect(reference).toBe(process.env.PARAM_OFFERING_REFERENCE);
        expect(customerAccount).toBe('test-account');
        return config;
      },
      updateAppInstance: updateAppInstance,
    }));

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
  }

  function setupCredentialValidation(impl) {
    const validateCredentials = jest.fn(impl);
    LansweeperIntegration.mockImplementation(() => ({
      validateCredentials: validateCredentials,
    }));
    return validateCredentials;
  }
});

it('does not continue if no app instance is found', async () => {
  const event = require('../../events/secret-create.event.json');
  const lambdaContextMocker = await setupSecretsHelper();

  Js4meHelper.mockImplementation(() => {
    return {
      getToken: async () => providerAccessToken,
      getGraphQLQuery: async () => ciProductData,
    };
  });

  InstanceHelper.mockImplementation(() => {
    return {
      retrieveInstanceWithRetry: async (js4meHelper, token, reference, customerAccount) => {
        return {"error": "Unable to query 'get app instance details'"};
      },
      updateAppInstance: async (js4meHelper, accessToken, instanceInput) => {
        fail('updateAppInstance should not be called, since no instanceId is known...');
      },
    };
  });

  expect(await app.lambdaHandler(event, context))
    .toEqual({
               'statusCode': 500,
               'body': JSON.stringify({
                                        message: 'Unable to update Lansweeper callback URL',
                                      })
             });

  const expectedAppName = `${process.env.PARAM_BOOTSTRAP_APP}/${process.env.PARAM_OFFERING_REFERENCE}`;
  expect(SecretsHelper).toHaveBeenCalledWith(null, process.env.PARAM_4ME_DOMAIN, expectedAppName);
  lambdaContextMocker.checkCustomerAndProvider4meHelperCreated();
  expect(LansweeperClient.mock.calls.length).toBe(0);
});

async function setupSecretsHelper() {
  const customerSecrets = {
    application: {
      client_id: 'a',
      client_secret: 'secret',
    },
    secrets: {
      client_secret: '12345',
    },
  };
  const lambdaContextMocker = new LambdaContextMocker('test-account', customerSecrets);

  SecretsHelper.mockImplementation(() => {
    return {
      getSecrets: lambdaContextMocker.mockedGetSecrets,
      updateSecrets: async (_, secrets) => {
        expect(secrets.callback_secret).not.toBeNull();
        return {secrets: secrets};
      },
    };
  });
  return lambdaContextMocker;
}
