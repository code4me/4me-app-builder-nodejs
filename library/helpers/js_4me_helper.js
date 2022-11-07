'use strict';

const axios = require('axios');
const crypto = require('crypto');
const {default: jwtVerify} = require('jose/jwt/verify')
const PollingHelper = require('./polling_helper');
const LoggedError = require('./errors/logged_error');
const Js4meAuthorizationError = require('./errors/js_4me_authorization_error');
const FormData = require('form-data');

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
      timeout: Js4meHelper.SYNC_TIMEOUT,
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
      const resp = itrpResponse.data;
      if (!resp.access_token) {
        let msg = 'Unable to get access token';
        if (resp.error) {
          msg = `Unable to get access token: ${resp.error_description || resp.error}`;
          console.info(msg);
        } else {
          console.error('Unexpected response from access token request. %j', resp);
        }
        throw new Js4meAuthorizationError(msg);
      }
      return resp;
    } catch (error) {
      if (error instanceof LoggedError) {
        throw error;
      }
      if (error.response) {
        const response = error.response;
        const url = error.config.url;
        console.error(`Error from ${url}. ${response.status}: ${response.statusText}`);
      } else {
        console.error(error);
      }
      throw new LoggedError(error);
    }
  }

  async get4meData(token) {
    const cryptoKeyObj = crypto.createPublicKey(this.certStr);

    try {
      const {payload, protectedHeader} = await jwtVerify(
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
      return {error: error};
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
        console.log("Errors from GraphQL call:\n%j", errors);
        return {error: `Unable to query ${descr}`};
      } else {
        return responseBody.data;
      }
    } catch (error) {
      if (error.response) {
        const response = error.response;
        const url = error.config.url;
        console.error(`Error from ${url}. ${response.status}: ${response.statusText}`);
      } else {
        console.error(error);
      }
      throw new LoggedError(`Error from GraphQL call: ${error.message}`);
    }
  }

  async getPagedGraphQLQuery(descr, accessToken, query, vars, resultHandler, memo) {
    let results = memo;
    const queryVars = {...vars, previousEndCursor: null};
    let hasNext = true;
    let i = 0;

    do {
      i++;
      const result = await this.getGraphQLQuery(`${descr} #${i}`, accessToken, query, queryVars);
      results = resultHandler(results, result, i);
      if (results.error) {
        return results;
      }
      const connection = this.getFirstProperty(result);

      if (!connection || !connection.pageInfo) {
        console.log(`Error. No pageInfo on loop ${i}`);
        hasNext = false;
      } else {
        hasNext = connection.pageInfo.hasNextPage;
        queryVars.previousEndCursor = connection.pageInfo.endCursor;
      }
    } while (hasNext);

    return results;
  }

  async reducePagedGraphQLQuery(descr,
                                accessToken,
                                query,
                                vars = {},
                                resultHandler = (c, q, _) => c.push(q),
                                memo = []) {
    const processor = (currentResults, queryResult, index) => {
      if (queryResult.error) {
        return queryResult;
      }
      const connection = this.getFirstProperty(queryResult);
      if (connection.nodes) {
        connection.nodes.forEach(n => resultHandler(currentResults, n, index))
      } else {
        console.log(`No nodes in ${descr} result ${index}`);
      }

      return currentResults;
    };
    return await this.getPagedGraphQLQuery(descr,
                                           accessToken,
                                           query,
                                           vars,
                                           processor,
                                           memo);
  }

  async executeGraphQLMutation(descr, accessToken, query, vars) {
    const result = await this.getGraphQLQuery(descr, accessToken, query, vars);
    if (result.error) {
      return result;
    } else {
      const updateResult = this.getFirstProperty(result);
      if (updateResult.errors && updateResult.errors.length > 0) {
        return {error: updateResult.errors};
      } else {
        return updateResult;
      }
    }
  }

  async getAsyncQueryResult(descr, url, maxWait) {
    try {
      if (maxWait < 1000) {
        // ensure we allow some time to download JSON
        maxWait = 1000;
      }
      const s3Response = await axios.get(url, {timeout: maxWait});
      const responseBody = s3Response.data;
      if (!responseBody) {
        return null;
      }

      const errors = responseBody.errors;
      if (errors) {
        console.log("Errors in async result:\n%j", errors);
        return {error: `Unable to query ${descr}`};
      } else {
        return responseBody.data;
      }
    } catch (error) {
      if (error.response) {
        const response = error.response;
        console.error(`Error from ${url}. ${response.status}: ${response.statusText}`);
      } else {
        console.error(error.toJSON());
      }
      throw new LoggedError(`Error on ${descr}: ${error.message}`);
    }
  }

  async getAsyncMutationResult(descr, mutationResult, maxWait = Js4meHelper.ASYNC_TIMEOUT) {
    const url = mutationResult.asyncQuery.resultUrl;

    const pollingHelper = new PollingHelper();
    const getResult = async (timeRemaining) => await this.getAsyncQueryResult(descr, url, timeRemaining);
    const result = await pollingHelper.poll(Js4meHelper.ASYNC_POLL_INTERVAL, maxWait, getResult);
    if (result.error) {
      return result;
    } else {
      return this.getFirstProperty(result);
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
      console.error(error);
      throw new LoggedError(`Error from DELETE call: ${error.message}`);
    }
  }

  async updateAvatar(accessToken, resource, id, avatar_file_name, avatar_stream) {
    try {
      const client = this.createClient(this.restUrl, accessToken.access_token);

      const form = new FormData();
      form.append('avatar_file_name', avatar_file_name);
      form.append('avatar', avatar_stream);

      return await client.post(
        `/v1/${resource}/${id}/avatar`,
        form,
        {
          headers: form.getHeaders(),
        },
      )
    } catch (error) {
      console.error(error);
      throw new LoggedError(`Error from POST call: ${error.message}`);
    }
  }

  getFirstProperty(result) {
    return result ? result[Object.keys(result)[0]] : null;
  }
}

Js4meHelper.DELIVERY_HEADER = 'X-4me-Delivery';
Js4meHelper.SYNC_TIMEOUT = parseInt(process.env.SYNC_4ME_TIMEOUT, 10) || 60000;
Js4meHelper.ASYNC_TIMEOUT = parseInt(process.env.SYNC_4ME_ASYNC_TIMEOUT, 10) || 120000;
Js4meHelper.ASYNC_POLL_INTERVAL = parseInt(process.env.SYNC_4ME_ASYNC_POLL_INTERVAL, 10) || 501;
Js4meHelper.MAX_SOURCE_LENGTH = 30;

module.exports = Js4meHelper;