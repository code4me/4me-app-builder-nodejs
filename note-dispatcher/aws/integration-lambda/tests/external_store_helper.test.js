'use strict';

const ExternalStoreHelper = require('../external_store_helper')

it('can store', async () => {
  const helper = new ExternalStoreHelper();

  const response = await helper.store('https://webhook.site/53893346-12ab-4bf6-be97-7e767c42bc05');

  expect(response.status).toBe(200);
  expect(response.data).toBe('');
  expect(response.error).toBeFalsy();
});
