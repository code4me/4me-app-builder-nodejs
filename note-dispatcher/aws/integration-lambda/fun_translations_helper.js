'use strict';

const axios = require('axios');

class FunTranslationsHelper {
  constructor(customHttpsAgent) {
    if (customHttpsAgent) {
      this.httpsAgent = customHttpsAgent
    }

    this.client = this.createClient();
    this.translations = FunTranslationsHelper.TRANSLATIONS;
  }

  createClient() {
    const axiosConfig = {
      baseURL: FunTranslationsHelper.URL,
      timeout: 30000,
      headers: {},
    };
    if (this.httpsAgent) {
      axiosConfig.httpsAgent = this.httpsAgent;
    }

    return axios.create(axiosConfig);
  }

  async getRandomTranslation(text) {
    const translation = this.translations[Math.floor(Math.random() * this.translations.length)];
    return await this.getTranslation(translation, text);
  }

  async getTranslation(translation, text) {
    try {
      const response = await this.client.post(
        `${translation}.json`,
        {
          text: text,
        }
      );
      return response.data.contents;
    } catch (error) {
      if (error.response) {
        const response = error.response;
        const url = error.config.url;
        if (response.status === 429 && response.data && response.data.error && response.data.error.message) {
          const msg = response.data.error.message;
          console.info(`Exceeded rate limit: ${msg}`);
          return {translation: translation, text: text, error: msg};
        }
        console.error(`Error from ${url}. ${response.status}: ${response.statusText}`);
      } else {
        console.error('Error translating: %j', error);
      }
      throw error;
    }
  }
}

FunTranslationsHelper.URL = 'https://api.funtranslations.com/translate/';
FunTranslationsHelper.TRANSLATIONS = ['yoda', 'pirate', 'gungan', 'minion', 'morse'];

module.exports = FunTranslationsHelper;