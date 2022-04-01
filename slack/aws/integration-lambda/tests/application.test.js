"use strict"

const FourMe = require("../four_me")
jest.mock("../four_me")

const CustomerSecrets = require("../customer_secrets")
jest.mock("../customer_secrets")

const ProviderSecrets = require("../provider_secrets")
jest.mock("../provider_secrets")

const SlackApi = require("../slack_api")
jest.mock("../slack_api")

const SlackAppSecrets = require("../slack_app_secrets")
jest.mock("../slack_app_secrets")

const SlackOauth = require("../slack_oauth")
jest.mock("../slack_oauth")

const Application = require("../application")

const subject = () => {
  return new Application({
    env4me: "4me-demo.com",
    offeringReference: "slack",
    provider: "wdc",
    secretApplicationName: "4me-app-builder",
    sqsQueueUrl: "https://foo.sqs.aws.com",
  })
}

describe(".providerFourMe()", () => {
  it("returns a connection to 4me", async () => {
    ProviderSecrets.mockImplementation((params) => {
      expect(params.provider).toEqual("wdc")

      return {
        get: async () => {
          return {}
        },
      }
    })

    const mockFourMe = {}
    FourMe.mockImplementation((params) => {
      return mockFourMe
    })

    expect(await subject().providerFourMe()).toBe(mockFourMe)
  })
})

describe(".customerFourMe(account)", () => {
  it("returns a connection to 4me", async () => {
    CustomerSecrets.mockImplementation((params) => {
      expect(params.account).toEqual("wna-it")

      return {
        get: async () => {
          return {
            application: {},
          }
        },
      }
    })

    const mockFourMe = {}
    FourMe.mockImplementation((params) => {
      return mockFourMe
    })

    const account = "wna-it"
    expect(await subject().customerFourMe(account)).toBe(mockFourMe)
  })
})

describe(".slackApi(account)", () => {
  it("returns a connection to Slack", async () => {
    CustomerSecrets.mockImplementation((params) => {
      expect(params.account).toEqual("wna-it")

      return {
        get: async () => {
          return {
            slackAuthorization: {
              access_token: "SECRET",
            },
            application: {},
          }
        },
      }
    })
    const mockSlackApi = {}
    SlackApi.mockImplementation((params) => {
      expect(params.token).toEqual("SECRET")

      return mockSlackApi
    })

    const account = "wna-it"
    expect(await subject().slackApi(account)).toBe(mockSlackApi)
  })
})

describe(".slackOauth(lambdaUrl)", () => {
  it("returns a connection to Slack's oauth API", async () => {
    SlackAppSecrets.mockImplementation((params) => {
      expect(params.secretApplicationName).toEqual("4me-app-builder")
      expect(params.offeringReference).toEqual("slack")
      expect(params.env4me).toEqual("4me-demo.com")

      return {
        get: async () => {
          return {
            clientId: "123456",
            clientSecret: "SECRET",
          }
        },
      }
    })
    const mockSlackOauth = {}
    SlackOauth.mockImplementation((params) => {
      expect(params.clientId).toEqual("123456")
      expect(params.clientSecret).toEqual("SECRET")
      expect(params.redirectUrl).toEqual(lambdaUrl)

      return mockSlackOauth
    })

    const lambdaUrl = "https://foo.lambda.aws.com"
    expect(await subject().slackOauth(lambdaUrl)).toBe(mockSlackOauth)
  })
})

describe(".resetSlackAuthorizeSecret(account)", () => {
  it("resets the slack authorize secret and returns it", async () => {
    CustomerSecrets.mockImplementation((params) => {
      expect(params.account).toEqual("wna-it")

      return {
        put: async (secrets) => {
          expect(secrets.slackAuthorizeSecret).toBeTruthy()

          return {
            slackAuthorizeSecret: "XXXX",
          }
        },
      }
    })

    expect(await subject().resetSlackAuthorizeSecret("wna-it")).toEqual("XXXX")
  })
})

describe(".validateAuthorizeSecret(account, slackAuthorizeSecret)", () => {
  it("returns true it the given slackAuthorizeSecret matches the stored secret", async () => {
    CustomerSecrets.mockImplementation((params) => {
      expect(params.account).toEqual("wna-it")

      return {
        get: async (secrets) => {
          return {
            slackAuthorizeSecret: "XXXX",
          }
        },
      }
    })

    expect(await subject().validateAuthorizeSecret("wna-it", "XXXX")).toEqual(true)
    expect(await subject().validateAuthorizeSecret("wna-it", "YYYY")).toEqual(false)
  })
})

describe(".saveSlackAuthorization(account, slackAuthorization)", () => {
  it("saves the slackAuthorizeSecret in the customer secrets store", async () => {
    CustomerSecrets.mockImplementation((params) => {
      expect(params.account).toEqual("wna-it")

      return {
        put: async (secrets) => {
          expect(secrets.slackAuthorization).toEqual("XXXX")

          return secrets
        },
      }
    })

    expect(await subject().saveSlackAuthorization("wna-it", "XXXX")).toEqual(true)
  })
})

describe(".slackSigningSecret()", () => {
  it("returns the singing secrete of the slack app", async () => {
    SlackAppSecrets.mockImplementation((params) => {
      expect(params.secretApplicationName).toEqual("4me-app-builder")
      expect(params.offeringReference).toEqual("slack")
      expect(params.env4me).toEqual("4me-demo.com")

      return {
        get: async () => {
          return {
            signingSecret: "SECRET",
          }
        },
      }
    })

    expect(await subject().slackSigningSecret()).toEqual("SECRET")
  })
})
