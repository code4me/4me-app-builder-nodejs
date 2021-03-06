'use strict';

const InstanceHelperBase = require('../instance_helper_base');
const Js4meHelper = require('../js_4me_helper');
jest.mock('../js_4me_helper');

const accessToken = {access_token: 'howard.tanner'};
const offeringReference = 'my_ref';
const customerAccount = 'abc';
const instanceHelper = new InstanceHelperBase();

let defaultRetryTimeout;
beforeEach(() => {
  defaultRetryTimeout = InstanceHelperBase.RETRY_WAIT;
  InstanceHelperBase.RETRY_WAIT = 1;
});

afterEach(() => {
  InstanceHelperBase.RETRY_WAIT = defaultRetryTimeout;
});

it('can retrieve data from custom fields', async () => {
  const graphQLResult = {
    appInstances: {
      nodes: [
        {
          id: 'tadsasd',
          appOffering: {
            id: 'app-off-id',
          },
          suspended: false,
          customFields: [
            {
              "id": "form_url",
              "value": "https://mysite.typeform.com/to/u6nXL7"
            },
            {
              "id": "typeform_token",
              "value": "***"
            },
            {
              "id": "request_id",
              "value": "def"
            },
          ]
        }
      ]
    }
  };

  Js4meHelper.mockImplementation(() => {
    return {
      getGraphQLQuery: async (descr, token, query, vars) => {
        expect(token).toBe(accessToken);
        expect(vars).toEqual(
          {
            customerAccount: customerAccount,
            reference: offeringReference,
          }
        );
        return graphQLResult;
      },
    };
  });
  const js4meHelper = new Js4meHelper();

  expect(await instanceHelper.retrieveInstance(js4meHelper, accessToken, offeringReference, customerAccount))
    .toEqual({
               instanceId: 'tadsasd',
               appOfferingId: 'app-off-id',
               suspended: false,
               customFields: graphQLResult.appInstances.nodes[0].customFields,
             });
});

it('can retry on failure', async () => {
  const graphQLErrorResult = {"error": "Unable to query Update app instance"};

  const graphQLSuccessResult = {
    appInstances: {
      nodes: [
        {
          id: 'tadsasd',
          appOffering: {
            id: 'app-off-id',
          },
          suspended: false,
          customFields: [
            {
              "id": "form_url",
              "value": "https://mysite.typeform.com/to/u6nXL7"
            },
            {
              "id": "typeform_token",
              "value": "***"
            },
            {
              "id": "request_id",
              "value": "def"
            },
          ]
        }
      ]
    }
  };

  let callCounter = 0;
  Js4meHelper.mockImplementation(() => {
    return {
      getGraphQLQuery: async (descr, token, query, vars) => {
        callCounter++;
        expect(token).toBe(accessToken);
        expect(vars).toEqual(
          {
            customerAccount: customerAccount,
            reference: offeringReference,
          }
        );
        if (callCounter === 2) {
          return graphQLSuccessResult;
        } else {
          return graphQLErrorResult;
        }
      },
    };
  });

  const js4meHelper = new Js4meHelper();

  expect(await instanceHelper.retrieveInstanceWithRetry(js4meHelper,
                                                        accessToken,
                                                        offeringReference,
                                                        customerAccount))
    .toEqual({
               instanceId: 'tadsasd',
               appOfferingId: "app-off-id",
               suspended: false,
               customFields: graphQLSuccessResult.appInstances.nodes[0].customFields,
             });
  expect(callCounter).toBe(2);
});

it('retries only once', async () => {
  const graphQLErrorResult = {"error": "Unable to query Update app instance"};

  let callCounter = 0;
  Js4meHelper.mockImplementation(() => {
    return {
      getGraphQLQuery: async (descr, token, query, vars) => {
        callCounter++;
        expect(token).toBe(accessToken);
        expect(vars).toEqual(
          {
            customerAccount: customerAccount,
            reference: offeringReference,
          }
        );
        return graphQLErrorResult;
      },
    };
  });

  const js4meHelper = new Js4meHelper();

  expect(await instanceHelper.retrieveInstanceWithRetry(js4meHelper,
                                                        accessToken,
                                                        offeringReference,
                                                        customerAccount))
    .toEqual(graphQLErrorResult);
  expect(callCounter).toBe(2);
});

it('can suspend instance', async () => {
  const instanceId = 'saasdasdasq';
  const comment = 'bad token';
  const descr = 'instance of wdc_test for wdc';

  const graphQLResult = {
    appInstance: {
      id: instanceId,
    }
  };

  Js4meHelper.mockImplementation(() => {
    return {
      executeGraphQLMutation: async (descr, token, query, vars) => {
        expect(token).toBe(accessToken);
        expect(vars).toEqual(
          {
            input: {
              id: instanceId,
              suspended: true,
              suspensionComment: comment,
            },
          }
        );
        return graphQLResult;
      },
    };
  });
  const js4meHelper = new Js4meHelper();

  expect(await instanceHelper.suspendInstance(js4meHelper, accessToken, descr, instanceId, comment))
    .toEqual({
               instanceId: instanceId,
             });
});

it('handles suspend instance error', async () => {
  const instanceId = 'saasdasdasq';
  const comment = 'bad token';
  const descr = 'instance of wdc_test for wdc';

  const graphQLResult = {
    error: [{path: ['appInstanceUpdate', 'input'], message: 'somethings wrong'}],
  };

  Js4meHelper.mockImplementation(() => {
    return {
      executeGraphQLMutation: async (descr, token, query, vars) => {
        expect(token).toBe(accessToken);
        expect(vars).toEqual(
          {
            input: {
              id: instanceId,
              suspended: true,
              suspensionComment: comment,
            },
          }
        );
        return graphQLResult;
      },
    };
  });
  const js4meHelper = new Js4meHelper();

  expect(await instanceHelper.suspendInstance(js4meHelper, accessToken, descr, instanceId, comment))
    .toEqual({
               error: `Unable to suspend ${descr}`,
             });
});

it('can unsuspend instance', async () => {
  const instanceId = 'saasdagffghfgh';
  const descr = 'instance of wdc_test for wdc';

  const graphQLResult = {
    appInstance: {
      id: instanceId,
    }
  };

  Js4meHelper.mockImplementation(() => {
    return {
      executeGraphQLMutation: async (descr, token, query, vars) => {
        expect(token).toBe(accessToken);
        expect(vars).toEqual(
          {
            input: {
              id: instanceId,
              suspended: false,
            },
          }
        );
        return graphQLResult;
      },
    };
  });
  const js4meHelper = new Js4meHelper();

  expect(await instanceHelper.unsuspendInstance(js4meHelper, accessToken, descr, instanceId))
    .toEqual({
               instanceId: instanceId,
             });
});

it('handles unsuspend instance error', async () => {
  const instanceId = 'saasdagffghfgh';
  const descr = 'instance of wdc_test for wdc';

  const graphQLResult = {
    error: [{path: ['appInstanceUpdate', 'input'], message: 'somethings wrong'}],
  };

  Js4meHelper.mockImplementation(() => {
    return {
      executeGraphQLMutation: async (descr, token, query, vars) => {
        expect(token).toBe(accessToken);
        expect(vars).toEqual(
          {
            input: {
              id: instanceId,
              suspended: false,
            },
          }
        );
        return graphQLResult;
      },
    };
  });
  const js4meHelper = new Js4meHelper();

  expect(await instanceHelper.unsuspendInstance(js4meHelper, accessToken, descr, instanceId))
    .toEqual({
               error: `Unable to unsuspend ${descr}`,
             });
});
