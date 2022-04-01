"use strict"

const axios = require("axios")
jest.mock("axios")

const Js4meHelper = require("../../../../library/helpers/js_4me_helper")
jest.mock("../../../../library/helpers/js_4me_helper")

const SecretsHelper = require("../../../../library/helpers/secrets_helper")
jest.mock("../../../../library/helpers/secrets_helper")

const SqsQueue = require("../sqs_queue")
jest.mock("../sqs_queue")

const crypto = require("crypto")

process.env.PARAM_BOOTSTRAP_APP = "4me-app-builder"
process.env.PARAM_BOOTSTRAP_ACCOUNT = "wdc"
process.env.PARAM_4ME_DOMAIN = "4me-demo.com"
process.env.PARAM_OFFERING_REFERENCE = "slack"
process.env.SQS_QUEUE_URL = "https://foo.sqs.aws.com"

const app = require("../app")

describe("app.lambdaHandler(inputLambdaEvent, lambdaContext)", () => {
  it("redirects configuration requests to the authorize Slack url", async () => {
    const mockRandomBuffer = Buffer.alloc(4)
    jest.spyOn(crypto, "randomBytes").mockImplementationOnce((size) => mockRandomBuffer)

    SecretsHelper.mockImplementationOnce((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder")

      return {
        getSecrets: async (key) => {
          expect(key).toEqual("wdc")

          return {}
        },
      }
    }).mockImplementationOnce((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder/slack")

      return {
        getSecrets: async (key) => {
          expect(key).toEqual("wna-it")

          return {}
        },
        updateSecrets: async (key, secrets) => {
          expect(secrets.slackAuthorizeSecret).toEqual(mockRandomBuffer.toString('hex'))
          expect(key).toEqual("instances/wna-it")

          return {secrets}
        },
      }
    }).mockImplementationOnce((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder/slack")

      return {
        getSecrets: async (key) => {
          expect(key).toEqual("slack_app_credentials")

          return {
            clientId: "foo",
            clientSecret: "bar",
          }
        },
      }
    })
    Js4meHelper.mockImplementation(() => {
      return {
        getToken: async () => {
          return "secret"
        },
        getGraphQLQuery: async (description, accessToken, query, vars) => {
          expect(vars.nodeId).toEqual("12345678")

          return {
            node: {
              id: "12345678",
              appOffering: {
                reference: "slack",
              },
              customerAccount: {
                id: "wna-it",
              },
              enabledByCustomer: false,
              createdAt: new Date("2022-03-14T17:59:13+01:00"),
            },
          }
        }
      }
    })

    const event = require("./fixtures/configuration.event.json")
    const context = require("./fixtures/context.json")

    expect(await app.lambdaHandler(event, context)).toEqual({
      "statusCode": 302,
      "headers": {
        "Location": "https://slack.com/oauth/v2/authorize?scope=commands%2Cusers%3Aread%2Cusers%3Aread.email&client_id=foo&redirect_uri=https%3A%2F%2Fufru4nvmzf.execute-api.eu-west-1.amazonaws.com%2FProd%2Fintegration&state=12345678%3A00000000",
      }
    })
  })

  it("handles authorize callback requests from slack", async () => {
    jest.spyOn(crypto, "randomBytes").mockImplementationOnce((size) => Buffer.alloc(4))

    SecretsHelper.mockImplementationOnce((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder")

      return {
        getSecrets: async (key) => {
          expect(key).toEqual("wdc")

          return {}
        },
      }
    }).mockImplementationOnce((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder/slack")

      return {
        getSecrets: async (key) => {
          expect(key).toEqual("instances/wna-it")

          return {}
        },
        updateSecrets: jest.fn().mockImplementationOnce(
          async (key, secrets) => {
            expect(secrets.slackAuthorizeSecret).toEqual("00000000")
            expect(key).toEqual("instances/wna-it")

            return {secrets}
          }
        ).mockImplementationOnce(
          async (key, secrets) => {
            expect(key).toEqual("instances/wna-it")
            expect(secrets.slackAuthorization.ok).toEqual(true)
            expect(secrets.slackAuthorization.team.id).toEqual("ABCDEFGH")
            expect(secrets.slackAuthorization.team.name).toEqual("Widget")

            return {secrets}
          }
        )
      }
    }).mockImplementationOnce((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder/slack")

      return {
        getSecrets: async (key) => {
          expect(key).toEqual("slack_app_credentials")

          return {
            clientId: "foo",
            clientSecret: "bar",
          }
        },
      }
    }).mockImplementationOnce((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder/slack")

      return {
      }
    })
    Js4meHelper.mockImplementationOnce(() => {
      return {
        getToken: async () => {
          return "secret"
        },
        getGraphQLQuery: async (description, accessToken, query, vars) => {
          expect(description).toEqual("Get app instance details")
          expect(vars.nodeId).toEqual("1234567890")

          return {
            node: {
              id: "1234567890",
              appOffering: {
                reference: "slack",
              },
              customerAccount: {
                id: "wna-it",
              },
              enabledByCustomer: false,
              createdAt: new Date("2022-03-14T17:59:13+01:00"),
            },
          }
        },
        executeGraphQLMutation: async (description, accessToken, mutation, vars) => {
          expect(description).toEqual("Update app instance")
          expect(vars.input.id).toEqual("1234567890")

          return {
            appInstance: {
              id: "1234567890",
              customerAccount: {
                id: "wna-it",
              },
              customFields: [],
            }
          }
        },
      }
    })

    axios.post.mockImplementation((url, data) => {
      expect(url).toEqual("https://slack.com/api/oauth.v2.access?redirect_uri=https%3A%2F%2Fufru4nvmzf.execute-api.eu-west-1.amazonaws.com%2FProd%2Fintegration")
      expect(data).toEqual("code=12345678&client_id=foo&client_secret=bar")

      return {
        "status": 200,
        "data": {
          "ok": true,
          "team": {
            "id": "ABCDEFGH",
            "name": 'Widget',
          },
        },
      }
    })

    const event = require("./fixtures/authorize_callback.event.json")
    const context = require("./fixtures/context.json")

    expect(await app.lambdaHandler(event, context)).toEqual({
      "statusCode": 302,
      "headers": {
        "Location": "https://wna-it.4me-demo.com/app_instances/1234567890/confirm_configuration",
      }
    })
  })

  it("handles receiving 4me command slack events", async () => {
    jest.useFakeTimers().setSystemTime(1645025140000)

    SecretsHelper.mockImplementationOnce((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder/slack")

      return {
        getSecrets: async (key) => {
          expect(key).toEqual("slack_app_credentials")

          return {
            signingSecret: "SECRET",
          }
        },
      }
    }).mockImplementationOnce((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder")

      return {
        getSecrets: async (key) => {
          expect(key).toEqual("wdc")

          return {}
        },
      }
    }).mockImplementationOnce((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder/slack")

      return {
        getSecrets: async (key) => {
          expect(key).toEqual("instances/wna-it")

          return {
            slackAuthorization: {
              access_token: "foo",
            },
          }
        },
      }
    })
    Js4meHelper.mockImplementationOnce(() => {
      return {
        getToken: async () => {
          return "secret"
        },
        getGraphQLQuery: async (description, accessToken, query, vars) => {
          expect(description).toEqual("Get app instances details")
          expect(vars.reference).toEqual("slack")
          expect(vars.customFilters).toEqual([
            {
              name: "slackWorkspaceId",
              values: ["T1234567890"],
            },
          ])

          return {
            appInstances: {
              nodes: [
                {
                  id: "1234567890",
                  appOffering: {
                    reference: "slack",
                  },
                  customerAccount: {
                    id: "wna-it",
                  },
                  enabledByCustomer: true,
                  createdAt: new Date("2022-03-14T17:59:13+01:00"),
                },
              ],
            },
          }
        }
      }
    })

    axios.post.mockImplementation((url, data) => {
      expect(url).toEqual("https://slack.com/api/views.open")

      return {
        "status": 200,
        "data": {
          "ok": true,
        }
      }
    })

    const event = require("./fixtures/4me.command.slack.event.json")
    const context = require("./fixtures/context.json")

    expect(await app.lambdaHandler(event, context)).toEqual({
      "statusCode": 200,
    })
    expect(axios.post).toHaveBeenCalled()
  })

  it("handles receiving help 4me command slack events", async () => {
    jest.useFakeTimers().setSystemTime(1645025140000)

    SecretsHelper.mockImplementationOnce((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder/slack")

      return {
        getSecrets: async (key) => {
          expect(key).toEqual("slack_app_credentials")

          return {
            signingSecret: "SECRET",
          }
        },
      }
    })

    const event = require("./fixtures/help.4me.command.slack.event.json")
    const context = require("./fixtures/context.json")

    expect(await app.lambdaHandler(event, context)).toEqual({
      "statusCode": 200,
      "body": JSON.stringify({
        "response_type": "in_channel",
        "text": "Usage: /4me [request subject]",
      }),
    })
  })

  it("handles receiving request 4me command slack events", async () => {
    jest.useFakeTimers().setSystemTime(1645025140000)

    SecretsHelper.mockImplementationOnce((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder/slack")

      return {
        getSecrets: async (key) => {
          expect(key).toEqual("slack_app_credentials")

          return {
            signingSecret: "SECRET",
          }
        },
      }
    }).mockImplementationOnce((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder")

      return {
        getSecrets: async (key) => {
          expect(key).toEqual("wdc")

          return {}
        },
      }
    }).mockImplementationOnce((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder/slack")

      return {
        getSecrets: async (key) => {
          expect(key).toEqual("instances/wna-it")

          return {
            slackAuthorization: {
              access_token: "foo",
            },
          }
        },
      }
    })
    Js4meHelper.mockImplementationOnce(() => {
      return {
        getToken: async () => {
          return "secret"
        },
        getGraphQLQuery: async (description, accessToken, query, vars) => {
          expect(description).toEqual("Get app instances details")
          expect(vars.reference).toEqual("slack")
          expect(vars.customFilters).toEqual([
            {
              name: "slackWorkspaceId",
              values: ["T1234567890"],
            },
          ])

          return {
            appInstances: {
              nodes: [
                {
                  id: "1234567890",
                  appOffering: {
                    reference: "slack",
                  },
                  customerAccount: {
                    id: "wna-it",
                  },
                  enabledByCustomer: true,
                  createdAt: new Date("2022-03-14T17:59:13+01:00"),
                },
              ],
            },
          }
        }
      }
    })

    axios.post.mockImplementation((url, data) => {
      expect(url).toEqual("https://slack.com/api/views.open")

      return {
        "status": 200,
        "data": {
          "ok": true,
        }
      }
    })

    const event = require("./fixtures/request.4me.command.slack.event.json")
    const context = require("./fixtures/context.json")

    expect(await app.lambdaHandler(event, context)).toEqual({
      "statusCode": 200,
    })
    expect(axios.post).toHaveBeenCalled()
  })

  it("handles receiving create request view submission slack events", async () => {
    jest.useFakeTimers().setSystemTime(1645025140000)

    SecretsHelper.mockImplementationOnce((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder/slack")

      return {
        getSecrets: async (key) => {
          expect(key).toEqual("slack_app_credentials")

          return {
            signingSecret: "SECRET",
          }
        },
      }
    })
    SqsQueue.mockImplementationOnce((sqsQueueUrl) => {
      expect(sqsQueueUrl).toEqual("https://foo.sqs.aws.com")

      return {
        sendMessage: async (text) => {
          expect(text).toEqual(
            "{\"slackWorkspaceId\":\"T0123456789\",\"slackUserId\":\"U0123456789\",\"responseUrl\":\"https://hooks.slack.com/commands/T0123456789/0123456789012/XXXXXXXXXXXXXXXXXXXXXXXX\",\"subject\":\"Pizza!\",\"note\":\"Met ananas en kaas\"}"
          )

          return true
        }
      }
    })

    axios.post.mockImplementation((url, data) => {
      expect(url).toEqual("https://hooks.slack.com/commands/T0123456789/0123456789012/XXXXXXXXXXXXXXXXXXXXXXXX")
      expect(data.text).toEqual("Creating a request in 4me...")
      expect(data.response_type).toEqual("in_channel")
      expect(data.replace_original).toEqual("true")

      return {
        "status": 200,
        "data": {
          "ok": true,
        }
      }
    })

    const event = require("./fixtures/create-request.view_submission.slack.event.json")
    const context = require("./fixtures/context.json")

    expect(await app.lambdaHandler(event, context)).toEqual({
      "statusCode": 200,
    })
    expect(axios.post).toHaveBeenCalled()
  })

  it("handles receiving create request sqs events", async () => {
    SecretsHelper.mockImplementationOnce((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder")

      return {
        getSecrets: async (key) => {
          expect(key).toEqual("wdc")

          return {}
        },
      }
    }).mockImplementationOnce((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder/slack")

      return {
        getSecrets: async (key) => {
          expect(key).toEqual("instances/wna-it")

          return {
            application: {},
            slackAuthorization: {
              access_token: "foo",
            },
          }
        },
      }
    })
    Js4meHelper.mockImplementationOnce(() => {
      return {
        getToken: async () => {
          return "secret"
        },
        getGraphQLQuery: async (description, accessToken, query, vars) => {
          expect(description).toEqual("Get app instances details")
          expect(vars.reference).toEqual("slack")
          expect(vars.customFilters).toEqual([
            {
              name: "slackWorkspaceId",
              values: ["T123456"],
            },
          ])

          return {
            appInstances: {
              nodes: [
                {
                  id: "1234567890",
                  appOffering: {
                    reference: "slack",
                  },
                  customerAccount: {
                    id: "wna-it",
                  },
                  enabledByCustomer: true,
                  createdAt: new Date("2022-03-14T17:59:13+01:00"),
                },
              ],
            },
          }
        }
      }
    }).mockImplementationOnce(() => {
      return {
        getToken: async () => {
          return "secret"
        },
        getGraphQLQuery: jest.fn().mockImplementationOnce(
          async (description, accessToken, query, vars) => {
            expect(description).toEqual("Find person Id by primary email")
            expect(vars.primaryEmail).toEqual("howard.tanner@widget.com")

            return {
              people: {
                nodes: [
                  {
                    id: "1234567890",
                  },
                ],
              },
            }
          }
        ).mockImplementationOnce(
          async (description, accessToken, query, vars) => {
            expect(description).toEqual("Get person account id")
            expect(vars.nodeId).toEqual("1234567890")

            return {
              node: {
                id: "1234567890",
                account: {
                  id: "widget",
                },
              },
            }
          }

        ),
        executeGraphQLMutation: async (description, accessToken, mutation, vars) => {
          expect(description).toEqual("Create request")
          expect(vars.input.subject).toEqual("Pizza")
          expect(vars.input.category).toEqual("other")
          expect(vars.input.requestedForId).toEqual("1234567890")

          return {
            request: {
              id: "1234567890",
              requestId: "123456",
              subject: "Pizza",
            },
          }
        },
      }
    })
    axios.get.mockImplementation((url, options) => {
      return {
        "status": 200,
        "data": {
          "ok": true,
          "user": {
            "profile": {
              "email": "howard.tanner@widget.com",
            },
          }
        },
      }
    })
    axios.post.mockImplementation((url, data) => {
      expect(url).toEqual("https://hooks.slack.com/blabla")
      expect(data.replace_original).toEqual("true")
      expect(data.response_type).toEqual("in_channel")
      expect(data.blocks[0].text.text).toEqual(
        ":white_check_mark: Registered request <https://widget.4me-demo.com/self-service/requests/123456|#123456> for you.",
      )

      return {
        "status": 200,
      }
    })

    const event = require("./fixtures/create-request.sqs.event.json")
    const context = require("./fixtures/context.json")

    const response = await app.lambdaHandler(event, context)

    expect(JSON.parse(response.body).message.successCount).toEqual(1)
  })
})
