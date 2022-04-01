"use strict"

const Application = require("../application")
jest.mock("../application")

const FourMe = require("../four_me")
jest.mock("../four_me")

const SlackApi = require("../slack_api")
jest.mock("../slack_api")

const AppInstance = require("../app_instance")
jest.mock("../app_instance")

const Request = require("../request")
jest.mock("../request")

const SlackInteraction = require("../slack_interaction")
jest.mock("../slack_interaction")

const SqsEventHandler = require("../sqs_event_handler")

const subject = () => { return new SqsEventHandler(new Application()) }

//const Request = require("../request")

describe(".handle()", () => {
  it("handles receiving create request sqs events", async () => {
    const event = require("./fixtures/create-request.sqs.event.json")
    const context = require("./fixtures/context.json")

    const mockFourMe = {}

    Application.mockImplementation(() => {
      return {
        customerFourMe: async (account) => {
          expect(account).toEqual("wna-it")

          return new FourMe()
        },
        offeringReference: "slack",
        providerFourMe: async () => {
          return new FourMe()
        },
        slackSigningSecret: async () => {
          return "SECRET"
        },
        slackApi: async (account) => {
          expect(account).toEqual("wna-it")

          return new SlackApi()
        },
      }
    })

    FourMe.mockImplementationOnce(() => {
      return {
        activeAppInstance: async (offeringReference, customFilters) => {
          expect(offeringReference).toEqual("slack")
          expect(customFilters.slackWorkspaceId).toEqual("T123456")

          return new AppInstance()
        },
      }
    }).mockImplementationOnce(() => {
      return {
        findPersonIdByPrimaryEmail: async (requestedForEmail) => {
          expect(requestedForEmail).toEqual("howard.tanner@widget.com")

          return "1234567890"
        },
        createRequest: async (requestedForId, subject, note) => {
          expect(requestedForId).toEqual("1234567890")
          expect(subject).toEqual("Pizza")

          return new Request()
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
        userEmail: async (slackUserId) => {
          expect(slackUserId).toEqual("U123456")

          return "howard.tanner@widget.com"
        },
      }
    })
    Request.mockImplementation(() => {
      return {
        url: () => {
          return "https://foo.example.com/"
        }
      }
    })
    const mockSendCreateRequestSuccess = jest.fn().mockImplementation((request) => {
      return true
    })
    SlackInteraction.mockImplementation(() => {
      return {
        sendCreateRequestSuccess: mockSendCreateRequestSuccess,
      }
    })

    const response = await subject().handle(event, context)

    expect(JSON.parse(response.body).message.successCount).toEqual(1)
    expect(mockSendCreateRequestSuccess).toHaveBeenCalled()
  })
})
