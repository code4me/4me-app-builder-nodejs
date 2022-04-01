"use strict"

const Application = require("../application")
jest.mock("../application")

const FourMe = require("../four_me")
jest.mock("../four_me")

const SlackOauth = require("../slack_oauth")
jest.mock("../slack_oauth")

const AppInstance = require("../app_instance")

const ConfigurationHandler = require("../configuration_handler")

const subject = () => { return new ConfigurationHandler(new Application()) }

describe(".handle(event, context)", () => {
  describe("given a configuration event", () => {
    const event = require("./fixtures/configuration.event.json")
    const context = require("./fixtures/context.json")

    beforeEach(() => {
      Application.mockImplementation(() => {
        return {
          offeringReference: "slack",
          providerFourMe: async () => { return new FourMe() },
          resetSlackAuthorizeSecret: async () => { return "SECRET" },
          slackOauth: async () => { return new SlackOauth() },
        }
      })
      SlackOauth.mockImplementation(() => {
        return {
          authorizeUrl: (state) => {
            return "https://authorize.slack.com?foo=bar"
          },
        }
      })
    })

    describe("when the app instance in 4me matches the request parameters", () => {
      beforeEach(() => {
        FourMe.mockImplementation(() => {
          return {
            appInstance: async (nodeId) => {
              expect(nodeId).toEqual("12345678")

              return new AppInstance({
                id: "12345678",
                env4me: "4me-demo.com",
                offeringReference: "slack",
                account: "wna-it",
                createdAt: new Date("2022-03-14T17:59:13+01:00"),
                enabledByCustomer: false,
              })
            },
          }
        })
      })

      it("redirects configuration requests to the authorize Slack url", async () => {
        expect(await subject().handle(event, context)).toEqual({
          "statusCode": 302,
          "headers": {
            "Location": "https://authorize.slack.com?foo=bar",
          }
        })
      })
    })

    describe("when the app instance's app offering reference in 4me does not match the request parameters", () => {
      beforeEach(() => {
        FourMe.mockImplementation(() => {
          return {
            appInstance: async (nodeId) => {
              expect(nodeId).toEqual("12345678")

              return new AppInstance({
                id: "12345678",
                env4me: "4me-demo.com",
                offeringReference: "NOT-slack",
                account: "wna-it",
                createdAt: new Date("2022-03-14T17:59:13+01:00"),
                enabledByCustomer: false,
              })
            },
          }
        })
      })

      it("returns an error message", async () => {
        expect(await subject().handle(event, context)).toEqual({
          "body": "{\"message\":\"No matching 4me App instance found.\"}",
          "statusCode": 403,
        })
      })
    })

    describe("when the app instance's account in 4me does not match the request parameters", () => {
      beforeEach(() => {
        FourMe.mockImplementation(() => {
          return {
            appInstance: async (nodeId) => {
              expect(nodeId).toEqual("12345678")

              return new AppInstance({
                id: "12345678",
                env4me: "4me-demo.com",
                offeringReference: "slack",
                account: "NOT-wna-it",
                createdAt: new Date("2022-03-14T17:59:13+01:00"),
                enabledByCustomer: false,
              })
            },
          }
        })
      })

      it("returns an error message", async () => {
        expect(await subject().handle(event, context)).toEqual({
          "body": "{\"message\":\"No matching 4me App instance found.\"}",
          "statusCode": 403,
        })
      })
    })

    describe("when the app instance's created_at in 4me does not match the request parameters", () => {
      beforeEach(() => {
        FourMe.mockImplementation(() => {
          return {
            appInstance: async (nodeId) => {
              expect(nodeId).toEqual("12345678")

              return new AppInstance({
                id: "12345678",
                env4me: "4me-demo.com",
                offeringReference: "slack",
                account: "wna-it",
                createdAt: new Date("1970-01-01T00:00:00+00:00"),
                enabledByCustomer: false,
              })
            },
          }
        })
      })

      it("returns an error message", async () => {
        expect(await subject().handle(event, context)).toEqual({
          "body": "{\"message\":\"No matching 4me App instance found.\"}",
          "statusCode": 403,
        })
      })
    })

    describe("when the app instance in 4me is already enabled by the customer", () => {
      beforeEach(() => {
        FourMe.mockImplementation(() => {
          return {
            appInstance: async (nodeId) => {
              expect(nodeId).toEqual("12345678")

              return new AppInstance({
                id: "12345678",
                env4me: "4me-demo.com",
                offeringReference: "slack",
                account: "wna-it",
                createdAt: new Date("2022-03-14T17:59:13+01:00"),
                enabledByCustomer: true,
              })
            },
          }
        })
      })

      it("returns an error message", async () => {
        expect(await subject().handle(event, context)).toEqual({
          "body": "{\"message\":\"Configuration of an app instance that is enabled by the customer is not allowed.\"}",
          "statusCode": 403,
        })
      })
    })
  })

  describe("given an authorize callback event", () => {
    const event = require("./fixtures/authorize_callback.event.json")
    const context = require("./fixtures/context.json")

    beforeEach(() => {
      Application.mockImplementation(() => {
        return {
          providerFourMe: async () => {
            return new FourMe()
          },
          validateAuthorizeSecret: async (account, slackAuthorizeSecret) => {
            expect(account).toEqual("wna-it")
            expect(slackAuthorizeSecret).toEqual("XXXX")

            return true
          },
          resetSlackAuthorizeSecret: async (account) => {
            expect(account).toEqual("wna-it")

            return "SECRET"
          },
          slackOauth: async (lambdaUrl) => {
            return new SlackOauth()
          },
          saveSlackAuthorization: async (account, slackAuthorization) => {
            expect(account).toEqual("wna-it")
            expect(slackAuthorization.team).toEqual({"id": "W1234567890", "name": "MyWorkspace"})

            return true
          },
        }
      })
      SlackOauth.mockImplementation(() => {
        return {
          getAuthorization: (code) => {
            return {
              team: {
                id: "W1234567890",
                name: "MyWorkspace",
              },
            }
          },
        }
      })
      FourMe.mockImplementation(() => {
        return {
          appInstance: async (nodeId) => {
            expect(nodeId).toEqual("1234567890")

            return new AppInstance({
              id: "1234567890",
              env4me: "4me-demo.com",
              offeringReference: "slack",
              account: "wna-it",
              createdAt: new Date("2022-03-14T17:59:13+01:00"),
              enabledByCustomer: false,
            })
          },
          configureAppInstance: async (appInstanceId, config) => {
            expect(config.slackWorkspaceId).toEqual("W1234567890")
            expect(config.slackWorkspaceName).toEqual("MyWorkspace")

            return config
          },
        }
      })
    })

    it("redirects to the app instance's configuration confirmation page", async () => {
      expect(await subject().handle(event, context)).toEqual({
        "statusCode": 302,
        "headers": {
          "Location": "https://wna-it.4me-demo.com/app_instances/1234567890/confirm_configuration",
        }
      })
    })
  })
})
