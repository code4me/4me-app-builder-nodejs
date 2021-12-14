'use strict';

const InstanceHelper = require('../instance_helper');
const Js4meHelper = require('../../../../library/helpers/js_4me_helper');
jest.mock('../../../../library/helpers/js_4me_helper');

const accessToken = {access_token: 'howard.tanner'};
const offeringReference = 'my_ref';
const customerAccount = 'abc';
const instanceHelper = new InstanceHelper();

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
               formUrl: 'https://mysite.typeform.com/to/u6nXL7',
               requestId: 'def',
             });
});
