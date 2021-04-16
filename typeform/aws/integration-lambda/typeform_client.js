'use strict';

const axios = require('axios');

class TypeformClient {
  constructor(token) {
    this.client = this.createClient('https://api.typeform.com', token);
  }

  createClient(url, bearerToken) {
    const headers = {};
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

  async createWebhook(form, tag, secret, webhookUrl) {
    try {
      const response = await this.client.put(
        `/forms/${form}/webhooks/${tag}`,
        {
          url: webhookUrl,
          enabled: true,
          secret: secret,
          verify_ssl: true,
        });
      const responseBody = response.data;
      const errors = responseBody.description;
      if (errors) {
        console.error("Errors from TypeForm call:\n%j", responseBody);
        return {error: 'Unable to create webhook'};
      } else {
        return responseBody;
      }
    } catch (error) {
      if (error.response) {
        const response = error.response;
        const url = error.config.url;
        console.error(`Error from ${url}. ${response.status}: ${response.statusText}`);
      } else {
        console.error(error);
      }
      return {error: 'Error from Typeform create webhook call'};
    }
  }
}

module.exports = TypeformClient;