"use strict"

const Secrets = require("./secrets")

class CustomerSecrets extends Secrets {
  constructor(params) {
    super({
      env4me: params.env4me,
      secretsBase: `${params.secretApplicationName}/${params.offeringReference}`,
      secretsKey: `instances/${params.account}`,
    })
  }
}

module.exports = CustomerSecrets
