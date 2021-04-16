'use strict';

const axios = require('axios');

class ExternalStoreHelper {
  constructor(customHttpsAgent) {
    if (customHttpsAgent) {
      this.httpsAgent = customHttpsAgent
    }

    this.client = this.createClient();
  }

  createClient() {
    const axiosConfig = {
      timeout: 30000,
      headers: {},
    };
    if (this.httpsAgent) {
      axiosConfig.httpsAgent = this.httpsAgent;
    }

    return axios.create(axiosConfig);
  }

  async store(url, result) {
    try {
      return await this.client.post(url, result);
    } catch (error) {
      if (error.response) {
        const response = error.response;
        const url = error.config.url;
        console.error(`Error from ${url}. ${response.status}: ${response.statusText}`);
      } else {
        console.error('Error translating: %j', error);
      }
      throw error;
    }
  }
}

module.exports = ExternalStoreHelper;