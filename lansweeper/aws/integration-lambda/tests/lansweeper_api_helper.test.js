'use strict';

const axios = require('axios')
jest.mock('axios');
const LansweeperApiHelper = require('../lansweeper_api_helper');

const expectedOAuthConfig = {
  "baseURL": "https://api.lansweeper.com/api/integrations/oauth",
  "headers": {
    "Content-Type": "application/json",
    "x-ls-integration-version": LansweeperApiHelper.LS_INTEGRATION_VERSION,
    "x-ls-integration-id": LansweeperApiHelper.LS_INTEGRATION_ID,
  },
  "timeout": 30000
};

describe('getRefreshToken', () => {
  it('posts correct data', async () => {
    axios.create.mockImplementation((config) => {
      expect(config).toEqual(expectedOAuthConfig);

      return {
        post: async (path, data) => {
          expect(path).toBe('/token');
          expect(data.client_id).toBe('client id');
          expect(data.client_secret).toBe('my secret');
          expect(data.grant_type).toBe('authorization_code');
          expect(data.code).toBe('my code');
          expect(data.redirect_uri).toBe('my uri');
          return {
            status: 200,
            data: {
              refresh_token: 'A9B8C8',
            },
          };
        }
      }
    });

    const apiHelper = new LansweeperApiHelper('client id', 'my secret', null);
    expect(await apiHelper.getRefreshToken('my code', 'my uri')).toEqual('A9B8C8');
  });
});

describe('getAccessToken', () => {
  it('posts correct data', async () => {
    axios.create.mockImplementation((config) => {
      expect(config).toEqual(expectedOAuthConfig);

      return {
        post: async (path, data) => {
          expect(path).toBe('/token');
          expect(data.client_id).toBe('client id2');
          expect(data.client_secret).toBe('my secret2');
          expect(data.grant_type).toBe('refresh_token');
          expect(data.refresh_token).toBe('my refresh token');
          return {
            status: 200,
            data: {
              access_token: 'my token',
            },
          };
        }
      }
    });

    const apiHelper = new LansweeperApiHelper('client id2', 'my secret2', 'my refresh token');
    expect(await apiHelper.getAccessToken()).toEqual('my token');
  });
});

describe('getGraphQLQuery', () => {
  it('posts correct data', async () => {
    const query = 'some graphql';
    const queryVars = {a: 1, b: 'abav'};
    let clientCounter = 0;

    axios.create.mockImplementation((config) => {
      clientCounter++;
      if (clientCounter === 1) {
        // refresh token client is created in constructor
        expect(config).toEqual(expectedOAuthConfig);
      } else {
        // GraphQL client
        expect(config).toEqual(
          {
            "baseURL": "https://api.lansweeper.com/api",
            "headers": {
              "Content-Type": "application/json",
              "x-ls-integration-version": LansweeperApiHelper.LS_INTEGRATION_VERSION,
              "x-ls-integration-id": LansweeperApiHelper.LS_INTEGRATION_ID,
              "authorization": "Bearer my token",
            },
            "timeout": 30000
          }
        );
      }

      return {
        post: async (path, data) => {
          expect(path).toBe('/v2/graphql');
          expect(data.query).toBe(query);
          expect(data.variables).toBe(queryVars)
          return {
            status: 200,
            data: {
              data: 'query result',
            },
          };
        }
      }
    });

    const apiHelper = new LansweeperApiHelper('client id2', 'my secret2', 'abc');
    apiHelper.accessToken = 'my token';
    expect(await apiHelper.getGraphQLQuery('my descr', query, queryVars)).toEqual('query result');
  });
});
