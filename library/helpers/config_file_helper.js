'use strict';

const path = require('path')
const fs = require('fs')

class ConfigFileHelper {
  constructor(...dirs) {
    this.configDir = path.resolve(...dirs);
  }

  getConfigDir() {
    return this.configDir;
  }

  readConfigFile(filename) {
    return fs.readFileSync(path.resolve(this.configDir, filename), 'utf-8');
  }

  configFileExists(filename) {
    return fs.existsSync(path.resolve(this.configDir, filename));
  }

  readConfigJsonFile(filename) {
    const rawdata = this.readConfigFile(filename);
    return JSON.parse(rawdata);
  }

  readConfigFileIfPresent(filename) {
    if (this.configFileExists(filename)) {
      return this.readConfigFile(filename);
    } else {
      return null;
    }
  }

  readUiExtensionFromFiles(filename) {
    const uiExtensionInput = this.readConfigJsonFile(`${filename}.json`);
    uiExtensionInput.html = this.readConfigFileIfPresent(`${filename}.html`);
    uiExtensionInput.css = this.readConfigFileIfPresent(`${filename}.css`);
    uiExtensionInput.javascript = this.readConfigFileIfPresent(`${filename}.js`);
    return uiExtensionInput;
  }

  readAvatar(filename) {
    const stream = fs.createReadStream(path.resolve(this.configDir, filename));

    return {filename, stream};
  }
}

module.exports = ConfigFileHelper;