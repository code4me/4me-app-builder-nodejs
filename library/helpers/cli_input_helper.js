'use strict';

const ConfigFileHelper = require('./config_file_helper');
const promptly = require('promptly');
const path = require('path');

class CliInputHelper {
  constructor(...dirs) {
    this.defaults = this.searchDefaults(...dirs);
  }

  async gatherInput(config) {
    const input = {};
    for (const configKey in config) {
      const configValue = config[configKey];
      let message;
      let options;
      if (typeof configValue === 'string') {
        message = configValue;
      } else {
        message = Object.keys(configValue)[0];
        options = configValue[message];
      }
      const value = await this.prompt(configKey, message, options);
      input[configKey] = value;
    }
    return input;
  }

  async prompt(key, message, options) {
    const defaultFromFile = this.defaults[key];
    if (defaultFromFile) {
      if (!options) {
        options = {};
      }
      options.default = defaultFromFile;
    }
    if (this.defaults.skipQuestionWithDefault && options && options.default) {
      return options.default;
    }
    return await promptly.prompt(`${message}: `, options);
  }

  searchDefaults(...dirs) {
    const deepest = path.resolve(...dirs);
    const root = path.parse(deepest).root;
    let current = deepest;
    let defaults = this.loadDefaults(current);
    while (current !== root) {
      current = path.resolve(current, '..');
      const parentDefaults = this.loadDefaults(current);
      defaults = {...parentDefaults, ...defaults}; // lower level defaults override parent's
    }
    return defaults;
  }

  loadDefaults(dir) {
    const filename = 'default_input.json';
    const configFileHelper = new ConfigFileHelper(dir);
    if (configFileHelper.configFileExists(filename)) {
      const allDefaults = configFileHelper.readConfigJsonFile(filename);
      let defaults = allDefaults;
      if (process.env.ENV_4ME && allDefaults[process.env.ENV_4ME]) {
        const envDefaults = allDefaults[process.env.ENV_4ME];
        defaults = {...defaults, ...envDefaults};
      }
      return defaults;
    } else {
      return {};
    }
  }
}

module.exports = CliInputHelper;