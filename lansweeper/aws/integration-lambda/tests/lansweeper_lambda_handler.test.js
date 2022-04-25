'use strict';

const app = require('../app');
const event = require('../../events/authorize-get.event.json');
const refreshGETEvent = require('../../events/refresh-get.event.json');
const refreshSQSEvent = require('../../events/refresh-sqs.event.json');
const scheduleTriggerEvent = require('../../events/schedule-trigger.event.json');

const SecretsHelper = require('../../../../library/helpers/secrets_helper');
jest.mock('../../../../library/helpers/secrets_helper');

const Js4meHelper = require('../../../../library/helpers/js_4me_helper');
jest.mock('../../../../library/helpers/js_4me_helper');

const TimeHelper = require('../../../../library/helpers/time_helper');
jest.mock('../../../../library/helpers/time_helper');

const InstanceHelper = require('../instance_helper');
const LambdaContextMocker = require('../../../../library/aws/secrets-lambda/tests/lambda_context_mocker');
jest.mock('../instance_helper');

const LansweeperIntegration = require('../lansweeper_integration');
jest.mock('../lansweeper_integration');

const Timer = require('../timer');
jest.mock('../timer');

const SQSHelper = require('../../../../library/helpers/sqs_helper');
jest.mock('../../../../library/helpers/sqs_helper');

const axios = require('axios')
const LoggedError = require('../../../../library/helpers/errors/logged_error');
const LansweeperAuthorizationError = require('../errors/lansweeper_authorization_error');
const Js4meAuthorizationError = require('../../../../library/helpers/errors/js_4me_authorization_error');
jest.mock('axios');

const context = {invokedFunctionArn: 'arn:aws:lambda:eu-west-1:123456789012:function:app-builder-aws-s3-IntegrationFunction-1URR7LBIEMI4E'};

process.env.PARAM_BOOTSTRAP_APP = 'my-app';
process.env.PARAM_BOOTSTRAP_ACCOUNT = 'test-provider';
process.env.PARAM_4ME_DOMAIN = '4me-test-domain';
process.env.PARAM_OFFERING_REFERENCE = 'my-lansweeper';
process.env.REFRESH_QUEUE_URL = 'sql-url';

it('handles scheduled event', async () => {
  const lambdaContextMocker = new LambdaContextMocker();
  SecretsHelper.mockImplementation(() => {
    return {
      getSecrets: lambdaContextMocker.mockedGetSecrets,
    };
  });

  TimeHelper.mockImplementation(() => {
    return {
      getMsSinceEpoch: () => 1000000,
      formatDateTime: () => 'formatted end date',
    }
  });

  InstanceHelper.mockImplementation(() => {
    return {
      retrieveAccountsLastSyncedBefore: async (js4meHelper, reference, endDate) => {
        expect(js4meHelper).not.toBeNull();
        expect(reference).toBe(process.env.PARAM_OFFERING_REFERENCE);
        expect(endDate.getTime()).toEqual(1000000 - (8 * 60 * 60 * 1000));
        return ['wdc', 'wna-it'];
      },
    };
  });

  const sendMessageMock = jest.fn()
    .mockImplementation(async (url, body) => {
      return {MessageId: 'message id1'};
    });
  SQSHelper.mockImplementationOnce(() => ({
    sendMessage: sendMessageMock,
  }));

  expect(await app.lambdaHandler(scheduleTriggerEvent, context))
    .toEqual({
               'statusCode': 200,
               'body': JSON.stringify({
                                        message: 'Triggered refresh of 2 accounts',
                                      })
             });
  lambdaContextMocker.checkProvider4meHelperCreated();
  expect(sendMessageMock).toHaveBeenNthCalledWith(1, 'sql-url', 'wdc');
  expect(sendMessageMock).toHaveBeenNthCalledWith(2, 'sql-url', 'wna-it');
});

it('handles authorize event and retrieves Lansweeper refresh token', async () => {
  const providerAccessToken = {access_token: 'howard.tanner'};
  const customerAccessToken = {access_token: 'foo.bar'};
  const customerSecrets = {
    application: {
      client_id: 'a',
      client_secret: 'secret',
    },
    secrets: {
      client_secret: 'X6PCsPGl',
    },
    callback_secret: '7c5c9d3yyyyyfd7',
  };
  const lambdaContextMocker = new LambdaContextMocker('test-account', customerSecrets);

  const expectedInstanceId = 'NG1lLmNvbS9BcHBJbnN0YW5jZS82'; // '4me.com/AppInstance/6'
  const config = {
    instanceId: expectedInstanceId,
    clientID: '12345',
    callbackURL: 'https://lambda.aws.com/lansweeper',
  };

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
      },
      updateAppInstance: async (js4meHelper, accessToken, instanceInput) => {
        expect(instanceInput.id).toBe(expectedInstanceId);
        expect(instanceInput.suspended).toBe(false);
        console.log(instanceInput.customFields);
        expect(instanceInput.customFields[0]).toEqual({id: 'connection_status', value: 'success'});
        expect(instanceInput.customFields[1]).toEqual({id: 'callback_url', value: null});
        return {instanceId: instanceInput.id};
      },
    };
  });

  axios.create.mockImplementation(() => {
    return {
      post: async (path, data) => {
        expect(path).toBe('/token');
        expect(data.client_id).toBe('12345');
        expect(data.client_secret).toBe('X6PCsPGl');
        expect(data.grant_type).toBe('authorization_code');
        expect(data.code).toBe('b4652da8ecc1d0e7');
        expect(data.redirect_uri).toBe(
          'https://gt0ead5in8.execute-api.eu-west-1.amazonaws.com/Prod/integration/test-account/7c5c9d3yyyyyfd7');
        return {
          status: 200,
          data: {
            refresh_token: 'A9B8C7',
          },
        };
      }
    }
  });

  SecretsHelper.mockImplementation(() => {
    return {
      getSecrets: lambdaContextMocker.mockedGetSecrets,
      updateSecrets: async (_, secrets) => {
        expect(secrets.refresh_token).toBe('A9B8C7');
        return {secrets: secrets};
      },
    };
  });

  const sendMessageMock = jest.fn()
    .mockImplementationOnce(async (url, body) => {
      return {MessageId: 'message id'};
    });
  SQSHelper.mockImplementationOnce(() => {
    return {
      sendMessage: sendMessageMock,
    };
  });


  expect(await app.lambdaHandler(event, context))
    .toEqual({
               'statusCode': 302,
               'headers': {
                 'Location': 'https://test-account.4me-test-domain/app_instances/NG1lLmNvbS9BcHBJbnN0YW5jZS82',
               }
             });

  const expectedAppName = `${process.env.PARAM_BOOTSTRAP_APP}/${process.env.PARAM_OFFERING_REFERENCE}`;
  expect(SecretsHelper).toHaveBeenCalledWith(null, process.env.PARAM_4ME_DOMAIN, expectedAppName);
  expect(sendMessageMock).toHaveBeenCalledWith('sql-url', 'test-account');
  lambdaContextMocker.checkCustomerAndProvider4meHelperCreated();
});

it('handles validates the callback secret', async () => {
  const providerAccessToken = {access_token: 'howard.tanner'};
  const customerAccessToken = {access_token: 'foo.bar'};
  const customerSecrets = {
    application: {
      client_id: 'a',
      client_secret: 'secret',
    },
    secrets: {
      client_secret: 'X6PCsPGl',
    },
    callback_secret: 'something else',
  };
  const lambdaContextMocker = new LambdaContextMocker('test-account', customerSecrets);

  const expectedInstanceId = 'NG1lLmNvbS9BcHBJbnN0YW5jZS82'; // '4me.com/AppInstance/6'
  const config = {
    instanceId: expectedInstanceId,
    clientID: '12345',
    callbackURL: 'https://lambda.aws.com/lansweeper',
  };

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
      },
    };
  });

  SecretsHelper.mockImplementation(() => {
    return {
      getSecrets: lambdaContextMocker.mockedGetSecrets,
    };
  });

  expect(await app.lambdaHandler(event, context))
    .toEqual({
               'statusCode': 400,
               'body': "{\"message\":\"Unauthorized\"}"
             });

  const expectedAppName = `${process.env.PARAM_BOOTSTRAP_APP}/${process.env.PARAM_OFFERING_REFERENCE}`;
  expect(SecretsHelper).toHaveBeenCalledWith(null, process.env.PARAM_4ME_DOMAIN, expectedAppName);
  lambdaContextMocker.checkCustomerAndProvider4meHelperCreated();
});

it('handles refresh GET call', async () => {
  const handlerResult = await checkRefreshEvent(refreshGETEvent,
                                                'test-account-get',
                                                {},
                                                true);

  expect(handlerResult).toEqual({
                                  'statusCode': 200,
                                  'body': "{\"message\":{\"site1\":1,\"site2\":0}}",
                                });
});

it('handles refresh SQS call without importType', async () => {
  const handlerResult = await checkRefreshEvent(refreshSQSEvent,
                                                'test-account-sqs',
                                                {},
                                                true);

  expect(handlerResult).toEqual({
                                  'statusCode': 200,
                                  'body': "{\"message\":{\"recordCount\":1,\"successCount\":1}}",
                                });
});

it('handles refresh SQS with importType ipOnly', async () => {
  const handlerResult = await checkRefreshEvent(refreshSQSEvent,
                                                'test-account-sqs',
                                                {importType: "ip_only"},
                                                true);

  expect(handlerResult).toEqual({
                                  'statusCode': 200,
                                  'body': "{\"message\":{\"recordCount\":1,\"successCount\":1}}",
                                });
});

it('handles refresh SQS with importType all', async () => {
  const handlerResult = await checkRefreshEvent(refreshSQSEvent,
                                                'test-account-sqs',
                                                {importType: "all"},
                                                undefined);

  expect(handlerResult).toEqual({
                                  'statusCode': 200,
                                  'body': "{\"message\":{\"recordCount\":1,\"successCount\":1}}",
                                });
});

it('handles refresh SQS with importType no_ip_only', async () => {
  const handlerResult = await checkRefreshEvent(refreshSQSEvent,
                                                'test-account-sqs',
                                                {importType: "no_ip_only"},
                                                false);

  expect(handlerResult).toEqual({
                                  'statusCode': 200,
                                  'body': "{\"message\":{\"recordCount\":1,\"successCount\":1}}",
                                });
});

describe('handling of errors', () => {
  it('drops SQS record with error, logging error if it was not logged previously', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error');
    const errorThrown = new Error('Error from external code');

    await checkErrorInSQSHandling(errorThrown);

    expect(consoleErrorSpy).toHaveBeenCalledWith(errorThrown);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error handling refresh message 63e062a9-362a-4a75-9cdc-e1bbe7b788d7, body: 'test-account-sqs'. Message will be dropped.");
  });

  it('drops SQS record with error, not logging error if it was logged previously', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error');
    const errorThrown = new LoggedError('Error that was logged by us');

    await checkErrorInSQSHandling(errorThrown);

    expect(consoleErrorSpy).toHaveBeenCalledWith("Error handling refresh message 63e062a9-362a-4a75-9cdc-e1bbe7b788d7, body: 'test-account-sqs'. Message will be dropped.");
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(errorThrown);
  });

  it('drops SQS record with error, suspends appInstance on Lansweeper authorization error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error');
    const errorThrown = new LansweeperAuthorizationError('Not authorized for any sites');

    const expectedInstanceId = 'abcd1';
    const updateAppInstanceMock = createUpdateAppInstanceMock(expectedInstanceId)
      .mockImplementationOnce(async (js4meHelper, accessToken, instanceInput) => {
      expect(instanceInput.id).toBe(expectedInstanceId);
      expect(instanceInput.suspended).toBe(true);
      expect(instanceInput.suspensionComment).not.toBeNull();
      expect(instanceInput.customFields).toBeUndefined();
      return {instanceId: instanceInput.id};
    });

    await checkErrorInSQSHandlingBasics(errorThrown, expectedInstanceId, updateAppInstanceMock);

    expect(updateAppInstanceMock).toHaveBeenCalledTimes(2);

    expect(consoleErrorSpy).toHaveBeenCalledWith("Error handling refresh message 63e062a9-362a-4a75-9cdc-e1bbe7b788d7, body: 'test-account-sqs'. Message will be dropped.");
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(errorThrown);
  });

  it('drops SQS record with error, suspends appInstance on 4me customer account authorization error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error');
    const errorThrown = new Js4meAuthorizationError('Unable to get access token: Invalid client credentials');

    const expectedInstanceId = 'abcd1';
    const updateAppInstanceMock = createUpdateAppInstanceMock(expectedInstanceId)
      .mockImplementationOnce(async (js4meHelper, accessToken, instanceInput) => {
        expect(instanceInput.id).toBe(expectedInstanceId);
        expect(instanceInput.suspended).toBe(true);
        expect(instanceInput.suspensionComment).not.toBeNull();
        expect(instanceInput.customFields).toBeUndefined();
        return {instanceId: instanceInput.id};
      });

    await checkErrorInSQSHandlingBasics(errorThrown, expectedInstanceId, updateAppInstanceMock);

    expect(updateAppInstanceMock).toHaveBeenCalledTimes(2);

    expect(consoleErrorSpy).toHaveBeenCalledWith("Error handling refresh message 63e062a9-362a-4a75-9cdc-e1bbe7b788d7, body: 'test-account-sqs'. Message will be dropped.");
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(errorThrown);
  });

  async function checkErrorInSQSHandling(errorThrown) {
    const expectedInstanceId = 'NG1lLmNvbS9BcHBJbnN0YW5jZS83';
    const updateAppInstanceMock = createUpdateAppInstanceMock(expectedInstanceId);

    await checkErrorInSQSHandlingBasics(errorThrown, expectedInstanceId, updateAppInstanceMock);

    expect(updateAppInstanceMock).toHaveBeenCalledTimes(1);
  }

  async function checkErrorInSQSHandlingBasics(errorThrown, expectedInstanceId, updateAppInstanceMock) {
    const expectedCustomerAccount = 'test-account-sqs';
    const customerSecrets = {
      application: {
        client_id: 'b',
        client_secret: 'secret',
      },
      secrets: {
        client_secret: 'X6PCsPGk',
      },
      refresh_token: '12345',
    };
    const lambdaContextMocker = new LambdaContextMocker(expectedCustomerAccount, customerSecrets);
    SecretsHelper.mockImplementation(() => ({
      getSecrets: lambdaContextMocker.mockedGetSecrets,
    }));

    InstanceHelper.mockImplementation(() => ({
      retrieveInstance: async () => ({
        instanceId: expectedInstanceId,
        clientID: '123456',
      }),
      updateAppInstance: updateAppInstanceMock,
    }));

    const processSitesMock = jest.fn().mockRejectedValue(errorThrown);
    LansweeperIntegration.mockImplementation(() => ({
      processSites: processSitesMock,
    }));

    const handlerResult = await app.lambdaHandler(refreshSQSEvent, context);
    expect(handlerResult).toEqual({
                                    'statusCode': 200,
                                    'body': "{\"message\":{\"recordCount\":1,\"successCount\":0}}",
                                  });

    expect(processSitesMock).toHaveBeenCalledTimes(1);
  }

  function createUpdateAppInstanceMock(expectedInstanceId) {
    return jest.fn()
      .mockImplementationOnce(async (js4meHelper, accessToken, instanceInput) => {
        expect(instanceInput.id).toBe(expectedInstanceId);
        expect(instanceInput.customFields[0].id).toEqual('sync_start_at');
        return {instanceId: instanceInput.id};
      });
  }
});

async function checkRefreshEvent(event, expectedCustomerAccount, extraConfig, expectedNetworkedAssetsOnly) {
  const providerAccessToken = {access_token: 'howard.tanner'};
  const customerAccessToken = {access_token: 'foo.bar'};
  const customerSecrets = {
    application: {
      client_id: 'a',
      client_secret: 'secret',
    },
    secrets: {
      client_secret: 'X6PCsPGl',
    },
    refresh_token: '1234',
    callback_secret: '7c5c9d3yyyyyfd7',
  };
  const lambdaContextMocker = new LambdaContextMocker(expectedCustomerAccount, customerSecrets);

  const expectedInstanceId = 'NG1lLmNvbS9BcHBJbnN0YW5jZS82'; // '4me.com/AppInstance/6'
  const config = {
    instanceId: expectedInstanceId,
    clientID: '12345',
    ... extraConfig
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

  const timerStopMock = jest.fn();
  Timer.mockImplementation(() => {
    return {
      startTime: 'start time',
      endTime: 'stop time',
      stop: timerStopMock,
      getDurationInSeconds: () => 1.001,
    }
  });

  const formatDateMock = jest.fn()
    .mockImplementationOnce(() => 'formatted start')
    .mockImplementationOnce(() => 'formatted end');
  const sToDurationTextMock = jest.fn()
    .mockImplementationOnce(() => 'duration text');
  TimeHelper.mockImplementation(() => {
    return {
      formatDateTime: formatDateMock,
      secondsToDurationText: sToDurationTextMock,
    }
  });

  const updateAppInstanceMock = jest.fn()
    .mockImplementationOnce(async (js4meHelper, accessToken, instanceInput) => {
      expect(instanceInput.id).toBe(expectedInstanceId);
      expect(instanceInput.customFields[0]).toEqual({id: 'sync_start_at', value: 'formatted start'});
      return {instanceId: instanceInput.id};
    }).mockImplementationOnce(async (js4meHelper, accessToken, instanceInput) => {
      expect(instanceInput.id).toBe(expectedInstanceId);
      expect(instanceInput.customFields[0]).toEqual({id: 'sync_end_at', value: 'formatted end'});
      expect(instanceInput.customFields[1]).toEqual({id: 'sync_duration', value: '1.001'});
      expect(instanceInput.customFields[2]).toEqual({id: 'sync_duration_text', value: 'duration text'});
      expect(instanceInput.customFields[3]).toEqual({id: 'sync_summary', value:
          '```\n' +
          '{\n' +
          '  "site1": 1,\n' +
          '  "site2": 0\n' +
          '}\n' +
          '```\n'});
      expect(instanceInput.customFields.length).toEqual(4);
      return {instanceId: instanceInput.id};
    });
  InstanceHelper.mockImplementation(() => {
    return {
      retrieveInstance: async (js4meHelper, token, reference, customerAccount) => {
        expect(js4meHelper).not.toBeNull();
        expect(token).toBe(providerAccessToken);
        expect(reference).toBe(process.env.PARAM_OFFERING_REFERENCE);
        expect(customerAccount).toBe(expectedCustomerAccount);
        return config;
      },
      updateAppInstance: updateAppInstanceMock,
    };
  });

  LansweeperIntegration.mockImplementation((clientId, clientSecret, refreshToken, customer4meHelper) => {
    expect(clientId).toEqual(config.clientID);
    expect(clientSecret).toEqual(customerSecrets.secrets.client_secret);
    expect(refreshToken).toEqual(customerSecrets.refresh_token);
    return {
      processSites: async (networkedAssetsOnly) => {
        expect(networkedAssetsOnly).toEqual(expectedNetworkedAssetsOnly);
        return {site1: 1, site2: 0}
      },
    };
  });

  const handlerResult = await app.lambdaHandler(event, context);
  const expectedAppName = `${process.env.PARAM_BOOTSTRAP_APP}/${process.env.PARAM_OFFERING_REFERENCE}`;
  expect(SecretsHelper).toHaveBeenCalledWith(null, process.env.PARAM_4ME_DOMAIN, expectedAppName);
  lambdaContextMocker.checkCustomerAndProvider4meHelperCreated();

  expect(updateAppInstanceMock).toHaveBeenCalledTimes(2);
  expect(timerStopMock).toHaveBeenCalled();
  expect(sToDurationTextMock).toHaveBeenCalledWith(1.001);
  expect(formatDateMock).toHaveBeenNthCalledWith(1, 'start time');
  expect(formatDateMock).toHaveBeenNthCalledWith(2, 'stop time');

  return handlerResult;
}
