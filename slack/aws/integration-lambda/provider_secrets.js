"use strict"

const Secrets = require("./secrets")

class ProviderSecrets extends Secrets {
  constructor(params) {
    super({
      env4me: params.env4me,
      secretsBase: params.secretApplicationName,
      secretsKey: params.provider,
    })
  }
}

module.exports = ProviderSecrets
