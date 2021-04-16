'use strict';

const ExternalStoreHelper = require('../external_store_helper')

it('can store', async () => {
  const helper = new ExternalStoreHelper();

  const response = await helper.store('https://webhook.site/c07a995f-2db3-4cc0-a9c9-17f8d937d506');

  expect(response.status).toBe(200);
  expect(response.data).toBe('');
  expect(response.error).toBeFalsy();
});
