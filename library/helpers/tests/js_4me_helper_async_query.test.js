'use strict';

const axios = require('axios')
jest.mock('axios');

const PollingHelper = require('../polling_helper');
jest.mock('../polling_helper');

const Js4meHelper = require('../js_4me_helper');

describe('getAsyncQueryResult', () => {

  test('GET of success result', async () => {
    const response = {
      status: 200,
      data: {
        data: {
          "products": {
            "nodes": [
              {
                "id": "NG1lLXN0YWdpbmcuY29tL1Byb2R1Y3QvMjY3",
                "name": "AWS S3 Bucket",
              }
            ]
          }
        },
      }
    };

    const expectedUrl = 'https://my_test.com/results.json';
    axios.get.mockImplementationOnce(async (url, config) => {
      expect(url).toBe(expectedUrl);
      expect(config).toEqual({timeout: 2002});
      return response;
    });

    const jsHelper = new Js4meHelper();
    expect(await jsHelper.getAsyncQueryResult('test query', expectedUrl, 2002))
      .toEqual(response.data.data);
  });

  test('GET of result with errors', async () => {
    const response = {
      status: 200,
      data: {
        "errors":
          [
            {
              "message": "Argument 'id' on InputObject 'RequestUpdateInput' has an invalid value (null). Expected type 'ID!'.",
              "locations": [
                {
                  "line": 2,
                  "column": 24
                }
              ],
            }
          ]
      }
    };

    const expectedUrl = 'https://my_test.com/results.json';
    axios.get.mockImplementationOnce(async (url, config) => {
      expect(url).toBe(expectedUrl);
      expect(config).toEqual({timeout: 2004});
      return response;
    });

    const jsHelper = new Js4meHelper();
    expect(await jsHelper.getAsyncQueryResult('test query', expectedUrl, 2004))
      .toEqual({"error": "Unable to query test query"});
  });

  test('GET with very small timeout', async () => {
    const response = {
      status: 200,
      data: {
        data: {
          "products": {}
        },
      }
    };

    const expectedUrl = 'https://my_test.com/results.json';
    axios.get.mockImplementationOnce(async (url, config) => {
      expect(url).toBe(expectedUrl);
      expect(config).toEqual({timeout: 1000});
      return response;
    });

    const jsHelper = new Js4meHelper();
    expect(await jsHelper.getAsyncQueryResult('test query', expectedUrl, 31))
      .toEqual(response.data.data);
  });


  test('GET denied', async () => {
    const expectedUrl = 'https://my_test.com/results.json';
    axios.get.mockImplementationOnce(async (url, config) => {
      expect(url).toBe(expectedUrl);
      expect(config).toEqual({timeout: 2003});
      const error = new Error('Request failed with status 403');
      error.response = {status: 403, statusText: 'Access Denied'};
      throw error;
    });

    const jsHelper = new Js4meHelper();
    await expect(async () => await jsHelper.getAsyncQueryResult('test query', expectedUrl, 2003))
      .rejects
      .toThrow('Error on test query: Request failed with status 403');
  });
});

describe('getAsyncMutationResult', () => {
  it('polls to retrieve results', async () => {
    const mutationResult = {asyncQuery: {resultUrl: 'https://my_test_uri/results'}};
    const resultJSONResponse = {
      status: 200,
      data: {
        data: {
          discoveredConfigurationItems: {
            asyncQuery: {id: 'abc', resultUrl: 'https://my_test_uri/results2'},
            configurationItems: [{id: 'def', sourceID: 'source id'}],
            errors: [{}],
          }
        }
      }
    };
    axios.get.mockImplementationOnce(async (url, config) => {
      expect(url).toBe(mutationResult.asyncQuery.resultUrl);
      expect(config).toEqual({timeout: 1342});
      return resultJSONResponse;
    });

    PollingHelper.mockImplementationOnce(() => {
      return {
        poll: jest.fn()
          .mockImplementationOnce(async (interval, maxWait, providerFunction) => {
            expect(interval).toEqual(Js4meHelper.ASYNC_RETRY_TIMEOUT);
            expect(maxWait).toEqual(19921);
            return await providerFunction(1342);
          })
      }
    });

    const jsHelper = new Js4meHelper();
    const result = await jsHelper.getAsyncMutationResult('retrieve mutation result call', mutationResult, 19921);
    expect(result).toEqual(resultJSONResponse.data.data.discoveredConfigurationItems);
  });

  it('returns error', async () => {
    const mutationResult = {asyncQuery: {resultUrl: 'https://my_test_uri/results'}};
    const resultJSONResponse = {
      status: 200,
      data: {
        errors: [{message: 'oops'}]
      }
    };
    axios.get.mockImplementationOnce(async (url, config) => {
      expect(url).toBe(mutationResult.asyncQuery.resultUrl);
      expect(config).toEqual({timeout: 1343});
      return resultJSONResponse;
    });

    PollingHelper.mockImplementationOnce(() => {
      return {
        poll: jest.fn()
          .mockImplementationOnce(async (interval, maxWait, providerFunction) => {
            expect(interval).toEqual(Js4meHelper.ASYNC_RETRY_TIMEOUT);
            expect(maxWait).toEqual(19925);
            return await providerFunction(1343);
          })
      }
    });

    const jsHelper = new Js4meHelper();
    const result = await jsHelper.getAsyncMutationResult('retrieve mutation result call', mutationResult, 19925);
    expect(result).toEqual({error: 'Unable to query retrieve mutation result call'});
  });
});