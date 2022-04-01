"use strict"

const SlackInteraction = require("./slack_interaction")

class SqsEventHandler {
  constructor(application) {
    this.application = application
  }

  async handle(event, context) {
    if (event.Records) {
      return await this.#handleSQSEvent(event, context)
    }

    return this.#respondWithBadRequest()
  }

  async #handleSQSEvent(event, context) {
    let handledCount = 0;

    for (const record of event.Records) {
      if (await this.#handleSQSRecord(record)) {
        handledCount++
      } else {
        console.error(`Error handling message ${record.messageId}. Message will be dropped.`)
      }
    }

    return this.#respondWith({
      recordCount: event.Records.length,
      successCount: handledCount,
    })
  }

  async #handleSQSRecord(record) {
    try {
      const {slackWorkspaceId, slackUserId, responseUrl, subject, note} = JSON.parse(record.body)

      const result = await this.#handleCreateRequest(slackWorkspaceId, slackUserId, responseUrl, subject, note)
      if (!result) {
        console.error("handleCreateRequest failed")
      }

      return result
    } catch (error) {
      console.error("Unhandled error in #handleSQSRecord: %j", error)
      return
    }
  }

  async #handleCreateRequest(slackWorkspaceId, slackUserId, responseUrl, subject, note) {
    const slackInteraction = new SlackInteraction(responseUrl)

    const providerFourMe = await this.application.providerFourMe()
    if (!providerFourMe) {
      console.error("Failed to connect to 4me")
      return slackInteraction.sendCreateRequestFailedWithUnknownError()
    }

    const appInstance = await providerFourMe.activeAppInstance(this.application.offeringReference, {slackWorkspaceId})
    if (!appInstance) {
      return slackInteraction.sendCreateRequestFailedWithUnknownWorkspace()
    }

    const slackApi = await this.application.slackApi(appInstance.account)
    if (!slackApi) {
      console.error("Failed to connect to Slack")
      return slackInteraction.sendCreateRequestFailedWithUnknownError()
    }

    const requestedForEmail = await slackApi.userEmail(slackUserId)
    if (!requestedForEmail) {
      console.error("Failed to lookup user e-mail in Slack")
      return slackInteraction.sendCreateRequestFailedWithUnknownError()
    }

    const customerFourMe = await this.application.customerFourMe(appInstance.account)
    if (!customerFourMe) {
      return slackInteraction.sendCreateRequestFailedWithUnknownWorkspace()
    }

    const requestedForId = await customerFourMe.findPersonIdByPrimaryEmail(requestedForEmail)
    if (!requestedForId) {
      return slackInteraction.sendCreateRequestFailedWithUnknownUserEmail(requestedForEmail)
    }

    const request = await customerFourMe.createRequest(requestedForId, subject, note)
    if (!request) {
      console.error("createRequest failed")
      return slackInteraction.sendCreateRequestFailedWithUnknownError()
    }

    return slackInteraction.sendCreateRequestSuccess(request)
  }

  #respondWithBadRequest(message) {
    this.#error(message)
    return this.#respondWith(message, 400)
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

module.exports = SqsEventHandler
