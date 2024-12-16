'use strict';

const Js4meHelper = require('../../../../library/helpers/js_4me_helper');
jest.mock('../../../../library/helpers/js_4me_helper');

const ExternalStoreHelper = require('../external_store_helper');
jest.mock('../external_store_helper');

const FunTranslationsHelper = require('../fun_translations_helper');
jest.mock('../fun_translations_helper');

const secretsHelperMock = require('../../../../library/helpers/tests/secrets_helper_mock');
const app = require('../app.js');

var context;
const mockedSecrets = {
  "application": {
    "nodeID": "NG1lLXN0YWdpbmcuY29tL09hdXRoQXBwbGljYXRpb24vMw",
    "client_id": "GHxCR65fqwXWpvRsyjhAISZrOFojn6Zu0pXQtyZkH2ezhPTf",
    "client_secret": "cIbVOJhdtGii8rmdvI4nxqP7IJEFqUAHGq3xODaynwMxeynjaHFilmh8MO8Ownb7"
  },
  "policy": {
    "nodeID": "NG1lLXN0YWdpbmcuY29tL1dlYmhvb2tQb2xpY3kvMw",
    "audience": null,
    "algorithm": "RS256",
    "public_key": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwMBWgkVRZohcqi0XvcGT\nkRPxnnsTKP6KVS5fwXkq0zQbm160RoaqfcNJNMiQ4qSoLn5r+SW2XsT1cjgtYDZz\nZVITa8fdYaJJPlNBRdD+D05cQon/WUmH1tRQcxV8a6d76LLV9sgjju4RZj8xll9v\n32ICy4lzRCL1U49UJK8CZ5SFUK9eNWE36rK1DcMAktNuRd5ddc9NN4wfKD0eYT00\nZiwSC+g3apheD24QggGkUZD5tp3UpG++60heQldpmvNbtu88QDRZ7A8gtGug1wsY\n6MC0uIOYBXKGaahld9B0l5tj9jOpYnVIB4XM/vwDBUqhTMXwCe0NcT8E8w9A56ao\niQIDAQAB\n-----END PUBLIC KEY-----\n"
  },
  "secrets": {
    "typeform_token": "3JKrHyKtRsCYatgZGeSF3MpG21bXzjEgE646BBobEviZ"
  },
  "typeform_secret": "a950ba487cbd4a411cf769ecaf7bd78e7394898a7e1dcd0281c3808a0839e6f78cab11c39839b623dadabc1cc83fd40c7ea2290be94a36e0f85179507be442b8",
};

process.env.PARAM_BOOTSTRAP_APP = 'my-app';
process.env.PARAM_4ME_DOMAIN = '4me-test-domain';
process.env.PARAM_OFFERING_REFERENCE = 'typeform';

it('handles note dispatcher event', async () => {
  const event = require('../../events/note-dispatcher.event.json');
  const parsedBody = JSON.parse(event.body);

  const mockGetSecrets = secretsHelperMock.once('getSecrets', async () => mockedSecrets);

  const mockedPayload = require('../../events/note-dispatcher.jwt-data.json');

  Js4meHelper.mockImplementation(() => {
    return {
      getDelivery: (e) => {
        expect(e).toBe(event);
        return '37d6acba-1a74-4c3e-90cd-855010ad01f9';
      },
      get4meData: async (jwt) => {
        expect(jwt).toBe(parsedBody.jwt)
        return mockedPayload;
      }
    };
  });

  let receivedText = null;
  FunTranslationsHelper.mockImplementation(() => {
    return {
      getRandomTranslation: async (text) => {
        receivedText = text;
        return {text: text, translation: FunTranslationsHelper.TRANSLATIONS[0], translated: 'mocked'};
      },
    };
  });

  let receivedUrl = null;
  let receivedResults = null;
  ExternalStoreHelper.mockImplementation(() => {
    return {
      store: async (url, results) => {
        receivedUrl = url;
        receivedResults = results;
        return {status: 200, data: ''};
      },
    };
  });

  expect(await app.lambdaHandler(event, context))
    .toEqual({
               'statusCode': 200,
               'body': JSON.stringify({
                                        message: 'note-dispatcher event handling complete',
                                      })
             });

  expect(secretsHelperMock.constructor()).toHaveBeenCalledWith(null, '4me-test-domain', 'my-app/typeform');
  expect(mockGetSecrets).toHaveBeenCalledWith('instances/wdc');

  expect(receivedText).toBe('a new note');
  expect(receivedUrl).toBe('https://webhook.site/c07a995f-2db3-4cc0-a9c9-17f8d937d506');
  expect(receivedResults).toEqual({
                                    translationResponse: {
                                      text: receivedText,
                                      translation: FunTranslationsHelper.TRANSLATIONS[0],
                                      translated: 'mocked'
                                    },
                                    input: mockedPayload,
                                  });
});
