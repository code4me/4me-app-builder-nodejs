'use strict';

const axios = require('axios');
const LoggedError = require('../../../library/helpers/errors/logged_error');
const LansweeperAuthorizationError = require('./errors/lansweeper_authorization_error');

class LansweeperApiHelper {
  constructor(clientId, clientSecret, refreshToken) {
    this.apiUrl = 'https://api.lansweeper.com/api';
    this.oauthUrl = `${this.apiUrl}/integrations/oauth`;

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;

    this.oauthClient = this.createClient(this.oauthUrl, null);
  }

  createClient(url, bearerToken) {
    const headers = {
      'Content-Type': 'application/json',
      'x-ls-integration-id': LansweeperApiHelper.LS_INTEGRATION_ID,
      'x-ls-integration-version': LansweeperApiHelper.LS_INTEGRATION_VERSION,
    };
    if (bearerToken) {
      headers['authorization'] = `Bearer ${bearerToken}`;
    }
    const axiosConfig = {
      baseURL: url,
      timeout: 30000,
      headers: headers,
    };

    return axios.create(axiosConfig);
  }

  async getRefreshToken(code, callbackURL) {
    try {
      const response = await this.oauthClient.post(
        '/token',
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: callbackURL // somehow LS requires this value as well...
        }
      );

      if (!response.data.refresh_token) {
        console.log(`No refresh_token found in: ${response.data}`);
        return null;
      }
      this.refreshToken = response.data.refresh_token;
      return this.refreshToken;
    } catch (error) {
      if (error.response) {
        const response = error.response;
        const url = error.config.url;
        console.log(`Error from ${url}. ${response.status}: ${response.statusText}`);
        console.log(`Error response: ${JSON.stringify(response.data)}`);
      } else {
        console.log(error);
      }
      return null;
    }
  }

  async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }
    try {
      const lecResponse = await this.oauthClient.post(
        '/token',
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
        }
      );
      const response = lecResponse.data;
      if (response && response.access_token) {
        this.accessToken = response.access_token;
        return this.accessToken;
      } else if (response) {
        console.error(`Error retrieving Lansweeper access token. Status: ${lecResponse.status}\n%j`, response);
      } else {
        console.error(`Error retrieving Lansweeper access token. Status: ${lecResponse.status}. No response body`);
      }
      return {
        error: 'Unable to access Lansweeper',
      }
    } catch (error) {
      if (error.response) {
        const response = error.response;
        if (response.status === 401 || response.status === 404) {
          // 401: bad client secret or refresh token
          // 404: bad client ID
          const msg = "Incorrect Lansweeper credentials ('Client ID', 'Client Secret' or the application is no longer authorized)";
          console.info(msg);
          throw new LansweeperAuthorizationError(msg);
        } else {
          const url = error.config.url;
          console.error(`Error from ${url}. ${response.status}: ${response.statusText}`);
        }
      } else {
        console.error(error);
      }
      throw new LoggedError(error);
    }
  }

  async getGraphQLQuery(descr, query, vars) {
    const accessToken = await this.getAccessToken();
    if (accessToken.error) {
      return accessToken;
    }
    try {
      const client = this.createClient(this.apiUrl, accessToken);
      const lecResponse = await client.post(
        '/v2/graphql',
        {
          query: query,
          variables: vars,
        }
      );
      const responseBody = lecResponse.data;
      const errors = responseBody.errors;
      if (errors) {
        console.log("Errors from GraphQL call:\n%j", errors);
        return { error: `Unable to query ${descr}: ${JSON.stringify(errors)}` };
      } else {
        return responseBody.data;
      }
    } catch (error) {
      if (error.response) {
        const lecResponse = error.response;
        if (lecResponse.data && lecResponse.data.errors) {
          const errors = lecResponse.data.errors;
          console.error("Exception from GraphQL call:\n%j", errors);
          return { error: `Unable to query ${descr}: ${JSON.stringify(errors)}` };
        } else {
          const url = error.config.url;
          console.error(`Error from ${url}. ${lecResponse.status}: ${lecResponse.statusText}`);
        }
      } else {
        console.error(error);
      }
      return { error: `Unable to query ${descr}` };
    }
  }

  async executeGraphQLMutation(descr, query, vars) {
    const result = await this.getGraphQLQuery(descr, query, vars);
    if (result.error) {
      return result;
    } else {
      const updateResult = result[Object.keys(result)[0]];
      if (updateResult.errors && updateResult.errors.length > 0) {
        return { error: updateResult.errors };
      } else {
        return updateResult;
      }
    }
  }
}
LansweeperApiHelper.LS_INTEGRATION_VERSION = '1.0';
LansweeperApiHelper.LS_INTEGRATION_ID = 'a561a72d-aa5e-4c52-af6d-084129ab5f09';

module.exports = LansweeperApiHelper;
