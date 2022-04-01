"use strict"

const SecretsHelper = require("../../../library/helpers/secrets_helper")

class Secrets {
  constructor(params) {
    const env4me = params.env4me
    const secretsBase = params.secretsBase
    const secretsKey = params.secretsKey
    const secretsClient = params.secretsClient // Optional

    this.secretsHelper = new SecretsHelper(secretsClient, env4me, secretsBase)
    this.secretsKey = secretsKey
  }

  async get() {
    if (!this._secrets) {
      this._secrets = await this.secretsHelper.getSecrets(this.secretsKey)
    }

    return this._secrets
  }

  async put(secrets) {
    const awsResult = await this.secretsHelper.updateSecrets(this.secretsKey, secrets)
    this._secrets = awsResult.secrets

    return this._secrets
  }
}

module.exports = Secrets
