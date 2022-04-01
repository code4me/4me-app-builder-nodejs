"use strict"

const Application = require("./application")
const ConfigurationHandler = require("./configuration_handler")
const SlackHandler = require("./slack_handler")
const SqsEventHandler = require("./sqs_event_handler")
const UnsupportedEventHandler = require("./unsupported_event_handler")

class LambdaHandler {
  constructor(params) {
    this.application = new Application({
      secretApplicationName: params.secretApplicationName,
      offeringReference: params.offeringReference,
      env4me: params.env4me,
      provider: params.provider,
      sqsQueueUrl: params.sqsQueueUrl,
    })
  }

  async handle(event, context) {
    if (event.Records) {
      return await new SqsEventHandler(this.application).handle(event, context)
    }

    if (event.httpMethod === "GET") {
      return await new ConfigurationHandler(this.application).handle(event, context)
    }

    if (event.httpMethod === "POST") {
      return await new SlackHandler(this.application).handle(event, context)
    }

    return await new UnsupportedEventHandler().handle(event, context)
  }
}

module.exports = LambdaHandler
