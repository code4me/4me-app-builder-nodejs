'use strict';

const axios = require('axios');
jest.mock('axios');

const Js4meHelper = require('../js_4me_helper');
const Js4meAuthorizationError = require('../errors/js_4me_authorization_error');

describe('/token calls', () => {

  test('successful call', async () => {
    const clientId = 'dsdfsdf';
    const clientSecret = '45fgfh';

    axios.create.mockReturnThis();
    axios.post.mockImplementationOnce(async (url, content) => {
      expect(url).toBe('/token');
      expect(content).toEqual({
                                client_id: clientId,
                                client_secret: clientSecret,
                                grant_type: 'client_credentials'
                              });
      return {status: 200, data: {access_token: 'abc'}};
    });

    const jsHelper = new Js4meHelper('4me-demo.com', 'wdc', clientId, clientSecret);
    expect(await jsHelper.getToken()).toEqual({access_token: 'abc'})
  });

  test('failed call with 400 exception', async () => {
    const clientId = '2123';
    const clientSecret = 'gasdjsdjf';

    axios.create.mockReturnThis();
    axios.post.mockImplementationOnce(async (url, content) => {
      expect(url).toBe('/token');
      expect(content).toEqual({
                                client_id: clientId,
                                client_secret: clientSecret,
                                grant_type: 'client_credentials'
                              });
      const error = new Error('Bad request');
      error.config = {url: '/token'};
      error.response = {status: 400, data: 'Bad request'};
      throw error;
    });

    const jsHelper = new Js4meHelper('4me-demo.com', 'wdc', clientId, clientSecret);
    await expect(async () => jsHelper.getToken())
      .rejects
      .toThrow(new Js4meAuthorizationError('Access token request rejected'));
  });

  test('failed call with 500 exception', async () => {
    const clientId = '2123df';
    const clientSecret = 'gassdfdjsdjf';

    axios.create.mockReturnThis();
    axios.post.mockImplementationOnce(async (url, content) => {
      expect(url).toBe('/token');
      expect(content).toEqual({
                                client_id: clientId,
                                client_secret: clientSecret,
                                grant_type: 'client_credentials'
                              });
      const error = new Error('Bad request');
      error.config = {url: '/token'};
      error.response = {status: 500, data: 'Internal server error'};
      throw error;
    });

    const jsHelper = new Js4meHelper('4me-demo.com', 'wdc', clientId, clientSecret);
    await expect(async () => jsHelper.getToken())
      .rejects
      .toThrow(new Js4meAuthorizationError('Error: Bad request'));
  });

  test('failed call with 200 and error', async () => {
    const clientId = '212ewwe3';
    const clientSecret = 'gasewrwdjsdjf';

    axios.create.mockReturnThis();
    axios.post.mockImplementationOnce(async (url, content) => {
      expect(url).toBe('/token');
      expect(content).toEqual({
                                client_id: clientId,
                                client_secret: clientSecret,
                                grant_type: 'client_credentials'
                              });
      return {status: 200, data: {error: 'Hello'}};
    });

    const jsHelper = new Js4meHelper('4me-demo.com', 'wdc', clientId, clientSecret);
    await expect(async () => jsHelper.getToken())
      .rejects
      .toThrow(new Js4meAuthorizationError('Unable to get access token: Hello'));
  });
});
