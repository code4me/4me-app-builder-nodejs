"use strict"

const Application = require("../application")
jest.mock("../application")

const FourMe = require("../four_me")
jest.mock("../four_me")

const SlackApi = require("../slack_api")
jest.mock("../slack_api")

const AppInstance = require("../app_instance")
jest.mock("../app_instance")

const SlackHandler = require("../slack_handler")

const subject = () => { return new SlackHandler(new Application()) }

describe(".handle()", () => {
  it("handles receiving 4me command slack events", async () => {
    const event = require("./fixtures/4me.command.slack.event.json")
    const context = require("./fixtures/context.json")

    Application.mockImplementation(() => {
      return {
        offeringReference: "slack",
        providerFourMe: async () => { return new FourMe() },
        slackSigningSecret: async () => {
          return "SECRET"
        },
        slackApi: async (account) => {
          expect(account).toEqual("wna-it")

          return new SlackApi()
        },
      }
    })
    SlackApi.validateSignature.mockImplementation((signingSecret, signature, timestamp, body) => {
      expect(signingSecret).toEqual("SECRET")

      return true
    })
    FourMe.mockImplementationOnce(() => {
      return {
        activeAppInstance: async (offeringReference, customFilters) => {
          expect(offeringReference).toEqual("slack")
          expect(customFilters.slackWorkspaceId).toEqual("T1234567890")

          return new AppInstance()
        },
      }
    })
    AppInstance.mockImplementation(() => {
      return {
        account: "wna-it",
      }
    })
    SlackApi.mockImplementation(() => {
      return {
        openModal: async (trigger_id, view) => {
          return true
        },
      }
    })

    expect(await subject().handle(event, context)).toEqual({
      "statusCode": 200,
    })
  })

  it("handles receiving help 4me command slack events", async () => {
    const event = require("./fixtures/help.4me.command.slack.event.json")
    const context = require("./fixtures/context.json")

    Application.mockImplementation(() => {
      return {
        slackSigningSecret: async () => {
          return "SECRET"
        },
      }
    })
    SlackApi.validateSignature.mockImplementation((signingSecret, signature, timestamp, body) => {
      expect(signingSecret).toEqual("SECRET")

      return true
    })

    expect(await subject().handle(event, context)).toEqual({
      "statusCode": 200,
      "body": JSON.stringify({
        "response_type": "in_channel",
        "text": "Usage: /4me [request subject]",
      }),
    })
  })

  it("handles receiving request 4me command slack events", async () => {
    const event = require("./fixtures/request.4me.command.slack.event.json")
    const context = require("./fixtures/context.json")

    Application.mockImplementation(() => {
      return {
        offeringReference: "slack",
        providerFourMe: async () => { return new FourMe() },
        slackSigningSecret: async () => {
          return "SECRET"
        },
        slackApi: async (account) => {
          expect(account).toEqual("wna-it")

          return new SlackApi()
        },
      }
    })
    SlackApi.validateSignature.mockImplementation((signingSecret, signature, timestamp, body) => {
      expect(signingSecret).toEqual("SECRET")

      return true
    })
    FourMe.mockImplementationOnce(() => {
      return {
        activeAppInstance: async (offeringReference, customFilters) => {
          expect(offeringReference).toEqual("slack")
          expect(customFilters.slackWorkspaceId).toEqual("T1234567890")

          return new AppInstance()
        },
      }
    })
    AppInstance.mockImplementation(() => {
      return {
        account: "wna-it",
      }
    })
    SlackApi.mockImplementation(() => {
      return {
        openModal: async (trigger_id, view) => {
          return true
        },
      }
    })

    expect(await subject().handle(event, context)).toEqual({
      "statusCode": 200,
    })
  })
})
