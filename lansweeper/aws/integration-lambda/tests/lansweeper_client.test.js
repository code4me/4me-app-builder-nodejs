'use strict';

const LansweeperClient = require('../lansweeper_client');

it('can create webhook', async () => {
  const token = 'FMpQohzHLqAMSqJ3EuutcJQEGokKLxFWVEEASMP6xVxw';
  const form = 'zGUeqRpS';
  const tag = 'my_hook';
  const secret = '12345';
  const url = 'https://ufru4nvmzf.execute-api.eu-west-1.amazonaws.com/Prod/integration/?type=lansweeper&account=wdc';

  const client = new LansweeperClient(token);
  // const response = await client.createWebhook(form, tag, secret, url);
  // expect(response.id).not.toBeNull();
  // expect(response.tag).toBe(tag);
  // expect(response.url).toBe(url);
});
