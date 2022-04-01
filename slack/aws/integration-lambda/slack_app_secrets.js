"use strict"

const Secrets = require("./secrets")

class SlackAppSecrets extends Secrets {
  constructor(params) {
    super({
      env4me: params.env4me,
      secretsBase: `${params.secretApplicationName}/${params.offeringReference}`,
      secretsKey: "slack_app_credentials",
      secretsClient: params.secretsClient, // optional
    })
  }
}

module.exports = SlackAppSecrets
