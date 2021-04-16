'use strict';

const axios = require('axios');
const crypto = require('crypto');
const { default: jwtVerify } = require('jose/jwt/verify')

class Js4meHelper {
  constructor(env4me, account, clientId, clientSecret, algorithm, certStr, audience, customHttpsAgent) {
    this.env4me = env4me;
    this.account = account;
    this.oauthUrl = `https://oauth.${env4me}`;
    this.restUrl = `https://api.${env4me}`;
    this.graphQLUrl = `https://graphql.${env4me}`;
    this.issuer = `https://${account}.${env4me}`;

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.algorithm = algorithm;
    this.certStr = certStr;
    this.audience = audience;

    if (customHttpsAgent) {
      this.httpsAgent = customHttpsAgent
    }

    this.oauthClient = this.createClient(this.oauthUrl, null);
    // this.restClient = this.createClient(this.restUrl, null);
  }

  getAccount() {
    return this.account;
  }

  createClient(url, bearerToken) {
    const headers = {
      'X-4me-Account': this.account,
    };
    if (bearerToken) {
      headers['authorization'] = `Bearer ${bearerToken}`;
    }
    const axiosConfig = {
      baseURL: url,
      timeout: 30000,
      headers: headers,
    };
    if (this.httpsAgent) {
      axiosConfig.httpsAgent = this.httpsAgent;
    }

    return axios.create(axiosConfig);
  }

  async getToken() {
    try {
      const itrpResponse = await this.oauthClient.post(
        '/token',
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials'
        }
      );
      return itrpResponse.data;
    } catch (error) {
      if (error.response) {
        const response = error.response;
        const url = error.config.url;
        console.log(`Error from ${url}. ${response.status}: ${response.statusText}`);
      } else {
        console.log(error);
      }
      throw error;
    }
  }

  async get4meData(token) {
    const cryptoKeyObj = crypto.createPublicKey(this.certStr);

    try {
      const { payload, protectedHeader } = await jwtVerify(
        token,
        cryptoKeyObj,
        {
          issuer: this.issuer,
          algorithms: [this.algorithm],
          audience: this.audience,
        }
      );
      return payload.data;
    } catch (error) {
      return { error: error };
    }
  }

  async getGraphQLQuery(descr, accessToken, query, vars) {
    try {
      const client = this.createClient(this.graphQLUrl, accessToken.access_token);
      const itrpResponse = await client.post(
        '/',
        {
          query: query,
          variables: vars,
        }
      );
      const responseBody = itrpResponse.data;
      const errors = responseBody.errors;
      if (errors) {
        console.log("Errors from GraphQL call:\n%O", errors);
        return { error: `Unable to query ${descr}` };
      } else {
        return responseBody.data;
      }
    } catch (error) {
      if (error.response) {
        const response = error.response;
        const url = error.config.url;
        console.log(`Error from ${url}. ${response.status}: ${response.statusText}`);
      } else {
        console.log(error);
      }
      throw new Error(`Error from GraphQL call: ${error.message}`);
    }
  }

  async executeGraphQLMutation(descr, accessToken, query, vars) {
    const result = await this.getGraphQLQuery(descr, accessToken, query, vars);
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

  async deleteRecord(accessToken, resource, id) {
    try {
      const client = this.createClient(this.restUrl, accessToken.access_token);
      return await client.delete(
        `/v1/${resource}/${id}`,
        {}
      );
    } catch (error) {
      console.log(error);
      throw new Error(`Error from DELETE call: ${error.message}`);
    }
  }
}

Js4meHelper.DELIVERY_HEADER = 'X-4me-Delivery';

module.exports = Js4meHelper;