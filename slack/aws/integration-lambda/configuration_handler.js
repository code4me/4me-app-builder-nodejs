"use strict"

class ConfigurationHandler {
  constructor(application) {
    this.application = application
  }

  async handle(event, context) {
    if (event.httpMethod !== "GET") {
      return this.#respondWithBadRequest()
    }

    const lambdaUrl = `https://${event.requestContext.domainName}${event.requestContext.path}`

    if (event.queryStringParameters && event.queryStringParameters.nodeID) {
      return await this.#handleExternalConfiguration(
        lambdaUrl,
        event.queryStringParameters.nodeID,
        event.queryStringParameters.account_id,
        new Date(event.queryStringParameters.created_at),
        event.queryStringParameters.confirmation_url,
      )
    }

    if (event.queryStringParameters && event.queryStringParameters.code && event.queryStringParameters.state) {
      return await this.#handleAuthorizeSlackCallback(
        lambdaUrl,
        event.queryStringParameters.code,
        event.queryStringParameters.state,
      )
    }

    return this.#respondWithBadRequest()
  }

  async #handleExternalConfiguration(lambdaUrl, nodeId, account, createdAt, confirmationUrl) {
    const providerFourMe = await this.application.providerFourMe()
    if (!providerFourMe) {
      return this.#respondWithUnknownError("Failed to connect to 4me.")
    }

    const appInstance = await providerFourMe.appInstance(nodeId)
    if (!appInstance) {
      return this.#respondWithForbidden("No matching 4me App instance found.")
    }

    if (appInstance.offeringReference !== this.application.offeringReference) {
      return this.#respondWithForbidden("No matching 4me App instance found.")
    }

    if (appInstance.account !== account) {
      console.error("%j !== %j", appInstance.account, account)
      return this.#respondWithForbidden("No matching 4me App instance found.")
    }

    if (appInstance.createdAt.valueOf() !== createdAt.valueOf()) {
      console.error("%j !== %j", appInstance.createdAt.valueOf(), createdAt.valueOf())
      return this.#respondWithForbidden("No matching 4me App instance found.")
    }

    if (appInstance.enabledByCustomer !== false) {
      return this.#respondWithForbidden("Configuration of an app instance that is enabled by the customer is not allowed.")
    }

    const slackAuthorizeSecret = await this.application.resetSlackAuthorizeSecret(account)
    if (!slackAuthorizeSecret) {
      return this.#respondWithUnknownError("Failed to reset Slack authorize secret.")
    }

    const state = `${nodeId}^${slackAuthorizeSecret}^${confirmationUrl}`

    const slackOauth = await this.application.slackOauth(lambdaUrl)
    if (!slackOauth) {
      return this.#respondWithUnknownError("Failed to initialize Slack oauth.")
    }

    return this.#respondWithRedirect(slackOauth.authorizeUrl(state))
  }

  async #handleAuthorizeSlackCallback(lambdaUrl, code, state) {
    const [nodeId, slackAuthorizeSecret, confirmationUrl] = state.split("^")

    const providerFourMe = await this.application.providerFourMe()
    if (!providerFourMe) {
      return this.#respondWithUnknownError("Failed to connect to 4me.")
    }

    const appInstance = await providerFourMe.appInstance(nodeId)
    if (!appInstance) {
      return this.#respondWithForbidden("No matching 4me App instance found.")
    }

    if (!this.application.validateAuthorizeSecret(appInstance.account, slackAuthorizeSecret)) {
      return this.#respondWithForbidden("Failed to validate authorization secret.")
    }

    const newSlackAuthorizeSecret = await this.application.resetSlackAuthorizeSecret(appInstance.account)
    if (!newSlackAuthorizeSecret) {
      return this.#respondWithUnknownError("Failed to reset Slack authorize secret.")
    }

    const slackOauth = await this.application.slackOauth(lambdaUrl)
    if (!slackOauth) {
      return this.#respondWithUnknownError("Failed to initialize Slack oauth.")
    }

    const slackAuthorization = await slackOauth.getAuthorization(code)
    if (!slackAuthorization || !slackAuthorization.team) {
      return this.#respondWithUnknownError("Failed to acquire Slack authorization.")
    }

    const saveResult = await this.application.saveSlackAuthorization(appInstance.account, slackAuthorization)
    if (!saveResult) {
      return this.#respondWithUnknownError("Failed to save Slack authorization.")
    }

    const slackWorkspaceId = slackAuthorization.team.id
    const slackWorkspaceName = slackAuthorization.team.name

    const result = await providerFourMe.configureAppInstance(appInstance.id, {slackWorkspaceId, slackWorkspaceName})
    if (!result) {
      return this.#respondWithUnknownError("Failed to configure Slack Workspace in 4me app.")
    }

    return this.#respondWithRedirect(confirmationUrl)
  }

  #respondWithRedirect(url) {
    return {
      "statusCode": 302,
      "headers": {
        "Location": url,
      }
    }
  }

  #respondWithBadRequest(message) {
    this.#error(message)
    return this.#respondWith(message, 400)
  }

  #respondWithForbidden(message) {
    this.#error(message)
    return this.#respondWith(message, 403)
  }

  #respondWithUnknownError(message) {
    this.#error(message)
    return this.#respondWith(message, 500)
  }

  #respondWith(message, code = 200) {
    return {
      "statusCode": code,
      "body": JSON.stringify({message}),
    }
  }

  #error(message, ...data) {
    if (data && data.length > 0) {
      console.error(message, ...data);
    } else {
      console.error(message);
    }
  }
}

module.exports = ConfigurationHandler
