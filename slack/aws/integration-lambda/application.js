"use strict"

const crypto = require("crypto")

const CustomerSecrets = require("./customer_secrets")
const ProviderSecrets = require("./provider_secrets")
const SlackAppSecrets = require("./slack_app_secrets")
const SlackApi = require("./slack_api")
const SlackOauth = require("./slack_oauth")

const FourMe = require("./four_me")

class Application {
  constructor(params) {
    this.env4me = params.env4me
    this.offeringReference = params.offeringReference
    this.provider = params.provider
    this.secretApplicationName = params.secretApplicationName
    this.sqsQueueUrl = params.sqsQueueUrl

    this._customerSecretsMap = new Map()
  }

  async providerFourMe() {
    const secrets = await this.#providerSecrets().get()
    if (!secrets) {
      console.error("Unable to get provider secrets")
      return
    }

    return new FourMe({
      env4me: this.env4me,
      account: this.provider,
      clientId: secrets.clientID,
      clientSecret: secrets.token,
      publicKeyPem: secrets.policy && secrets.policy.publicKeyPem,
      jwtAlgorithm: secrets.policy && secrets.policy.jwtAlg,
      jwtAudience: secrets.policy && secrets.policy.jwtAudience,
    })
  }

  async customerFourMe(account) {
    const secrets = await this.#customerSecrets(account).get()
    if (!secrets) {
      console.error("Unable to get customer secrets for account %s", account)
      return
    }

    if (!secrets.application) {
      console.error("Unable to get customer application secrets for account %s", account)
      return
    }

    return new FourMe({
      env4me: this.env4me,
      account: account,
      clientId: secrets.application.client_id,
      clientSecret: secrets.application.client_secret,
    })
  }

  async slackApi(account) {
    const secrets = await this.#customerSecrets(account).get()
    if (!secrets) {
      console.error("Unable to get customer secrets for account %s", account)
      return
    }

    const slackAuthorization = secrets.slackAuthorization
    if (!slackAuthorization) {
      console.error("No slack authorization available.")
      return
    }

    const token = slackAuthorization.access_token
    if (!token) {
      console.error("No slack authorization token available.")
      return
    }

    return new SlackApi({token})
  }

  async slackOauth(lambdaUrl) {
    const slackApp = await this.#slackAppSecrets().get()
    if (!slackApp) {
      console.error("Failed to get slack app secrets.")
      return
    }

    return new SlackOauth({
      clientId: slackApp.clientId,
      clientSecret: slackApp.clientSecret,
      redirectUrl: lambdaUrl,
    })
  }

  async resetSlackAuthorizeSecret(account) {
    const slackAuthorizeSecret = crypto.randomBytes(64).toString('hex')

    const secrets = await this.#customerSecrets(account).put({slackAuthorizeSecret})
    if (!secrets) {
      console.error("Failed to store Slack authorize secret.")
      return
    }

    return secrets.slackAuthorizeSecret
  }

  async validateAuthorizeSecret(account, slackAuthorizeSecret) {
    if (!slackAuthorizeSecret) {
      return false
    }

    const secrets = await this.#customerSecrets(account).get()
    if (!secrets) {
      console.error("Failed to get secrets for account %s.", account)
      return
    }

    if (!secrets.slackAuthorizeSecret) {
      return false
    }

    return crypto.timingSafeEqual(
      Buffer.from(slackAuthorizeSecret),
      Buffer.from(secrets.slackAuthorizeSecret),
    )
  }

  async saveSlackAuthorization(account, slackAuthorization) {
    const secrets = await this.#customerSecrets(account).put({slackAuthorization})
    if (!secrets) {
      console.error("Failed to put slack authorization secrets for account %s", account)
      return false
    }

    return true
  }

  async slackSigningSecret() {
    const slackApp = await this.#slackAppSecrets().get()
    if (!slackApp) {
      console.error("Failed to get slack app secrets.")
      return
    }

    return slackApp.signingSecret
  }

  #providerSecrets() {
    if (!this._providerSecrets) {
      this._providerSecrets = new ProviderSecrets({
        secretApplicationName: this.secretApplicationName,
        env4me: this.env4me,
        provider: this.provider,
      })
    }

    return this._providerSecrets
  }

  #customerSecrets(account) {
    if (!this._customerSecretsMap.has(account)) {
      this._customerSecretsMap.set(
        account,
        new CustomerSecrets({
          secretApplicationName: this.secretApplicationName,
          offeringReference: this.offeringReference,
          env4me: this.env4me,
          account: account,
        }),
      )
    }

    return this._customerSecretsMap.get(account)
  }

  #slackAppSecrets() {
    if (!this._slackAppSecrets) {
      this._slackAppSecrets = new SlackAppSecrets({
        secretApplicationName: this.secretApplicationName,
        offeringReference: this.offeringReference,
        env4me: this.env4me,
      })
    }

    return this._slackAppSecrets
  }
}

module.exports = Application
