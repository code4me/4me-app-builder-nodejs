'use strict';

const ExternalStoreHelper = require('../external_store_helper')

it('can store', async () => {
  const helper = new ExternalStoreHelper();

  const response = await helper.store('https://webhook.site/d0a16e8d-5597-4fb3-bb12-016a9512b4a1');

  expect(response.status).toBe(200);
  expect(response.data).toBe('');
  expect(response.error).toBeFalsy();
});
