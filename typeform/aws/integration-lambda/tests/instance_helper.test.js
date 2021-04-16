'use strict';

const InstanceHelper = require('../instance_helper');
const Js4meHelper = require('../../../../library/helpers/js_4me_helper');
jest.mock('../../../../library/helpers/js_4me_helper');

const accessToken = {access_token: 'howard.tanner'};
const integrationReference = 'my_ref';
const customerAccount = 'abc';
const instanceHelper = new InstanceHelper();

it('can retrieve data from custom fields', async () => {
  const graphQLResult = {
    integrationInstances: {
      nodes: [
        {
          id: 'tadsasd',
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
            reference: integrationReference,
          }
        );
        return graphQLResult;
      },
    };
  });
  const js4meHelper = new Js4meHelper();

  expect(await instanceHelper.retrieveInstance(js4meHelper, accessToken, integrationReference, customerAccount))
    .toEqual({
               instanceId: 'tadsasd',
               suspended: false,
               formUrl: 'https://mysite.typeform.com/to/u6nXL7',
               requestId: 'def',
             });
});

it('can suspend instance', async () => {
  const instanceId = 'saasdasdasq';
  const comment = 'bad token';
  const descr = 'instance of wdc_test for wdc';

  const graphQLResult = {
    integrationInstance: {
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
    error: [{path: ['integrationInstanceUpdate', 'input'], message: 'somethings wrong'}],
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
    integrationInstance: {
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
    error: [{path: ['integrationInstanceUpdate', 'input'], message: 'somethings wrong'}],
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
