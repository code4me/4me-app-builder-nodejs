'use strict';

const InstanceHelper = require('../instance_helper');
const Js4meHelper = require('../../../../library/helpers/js_4me_helper');
jest.mock('../../../../library/helpers/js_4me_helper');

const accessToken = {access_token: 'howard.tanner'};
const offeringReference = 'my_ref';
const customerAccount = 'abc';
const instanceHelper = new InstanceHelper();

describe('import_type', () => {
  it('can retrieve data from custom fields without import_type', async () => {
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
                "id": "client_id",
                "value": "12345"
              },
              {
                "id": "client_secret",
                "value": "***"
              },
              {
                "id": "callback_url",
                "value": "https://lambda.aws.com/lansweeper"
              },
              {
                "id": "connection_status",
                "value": "pending_authorization"
              }
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
                 clientID: '12345',
                 callbackURL: 'https://lambda.aws.com/lansweeper',
                 connectionStatus: 'pending_authorization',
               });
  });

  it('can retrieve data from custom fields with import_type', async () => {
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
                "id": "client_id",
                "value": "12345"
              },
              {
                "id": "client_secret",
                "value": "***"
              },
              {
                "id": "callback_url",
                "value": "https://lambda.aws.com/lansweeper"
              },
              {
                "id": "connection_status",
                "value": "pending_authorization"
              },
              {
                "id": "import_type",
                "value": "ip_only"
              }
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
                 clientID: '12345',
                 callbackURL: 'https://lambda.aws.com/lansweeper',
                 connectionStatus: 'pending_authorization',
                 importType: 'ip_only',
               });
  });
});

describe('label_generator', () => {
  it('can retrieve data from custom fields without label_generator', async () => {
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
                "id": "client_id",
                "value": "12345"
              },
              {
                "id": "client_secret",
                "value": "***"
              },
              {
                "id": "callback_url",
                "value": "https://lambda.aws.com/lansweeper"
              },
              {
                "id": "connection_status",
                "value": "pending_authorization"
              },
              {
                "id": "import_type",
                "value": "ip_only"
              }
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
                 clientID: '12345',
                 callbackURL: 'https://lambda.aws.com/lansweeper',
                 connectionStatus: 'pending_authorization',
                 importType: 'ip_only',
               });
  });

  it('can retrieve data from custom fields with label_generator', async () => {
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
                "id": "client_id",
                "value": "12345"
              },
              {
                "id": "client_secret",
                "value": "***"
              },
              {
                "id": "callback_url",
                "value": "https://lambda.aws.com/lansweeper"
              },
              {
                "id": "connection_status",
                "value": "pending_authorization"
              },
              {
                "id": "import_type",
                "value": "ip_only"
              },
              {
                "id": "label_generator",
                "value": "lansweeper_asset_name"
              }
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
                 clientID: '12345',
                 callbackURL: 'https://lambda.aws.com/lansweeper',
                 connectionStatus: 'pending_authorization',
                 importType: 'ip_only',
                 labelGenerator: 'lansweeper_asset_name',
               });
  });
});

it('can retrieve instances not synced since time', async () => {
  const graphQLResult = {
    appInstances: {
      nodes: [
        {id: 'a1', customerAccount: {id: 'customer1'},},
        {id: 'a2', customerAccount: {id: 'customer2'},},
      ]
    }
  };

  const endDate = new Date(2021, 8, 2, 10, 22, 5);

  const js4meHelper = {
    getToken: async () => accessToken,
    getGraphQLQuery: async (descr, token, query, vars) => {
      expect(token).toBe(accessToken);
      expect(vars).toEqual(
        {
          reference: offeringReference,
          value: '<2021-09-02T08:22:05Z',
        }
      );
      expect(query.trim()).toEqual(`      
       query($reference: String, $value: String!) {
        appInstances(first: 100,
                 filter: {customFilters: [{name: "Start", values: [$value]}],
                          appOfferingReference: { values: [$reference] },
                          disabled: false, suspended: false, enabledByCustomer: true
                 }
        ) { nodes { id customerAccount { id } } }
      }`.trim());
      return graphQLResult;
    },
  };

  expect(await instanceHelper.retrieveAccountsLastSyncedBefore(js4meHelper, offeringReference, endDate))
    .toEqual(['customer1', 'customer2']);
});
