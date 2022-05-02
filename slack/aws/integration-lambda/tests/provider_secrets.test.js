"use strict"

const SecretsHelper = require("../../../../library/helpers/secrets_helper")
jest.mock("../../../../library/helpers/secrets_helper")

const ProviderSecrets = require("../provider_secrets")

const subject = () => {
  return new ProviderSecrets({
    secretApplicationName: "4me-app-builder",
    // reference: "my-app-reference",
    env4me: "4me-demo.com",
    provider: "wdc",
  })
}

describe(".get()", () => {
  it("returns the secrets for the provider from AWS", async () => {
    const mockSecrets = {
      "foo": "bar",
    }
    SecretsHelper.mockImplementation((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder")

      return {
        getSecrets: async (key) => {
          expect(key).toEqual("wdc")
          return mockSecrets
        }
      }
    })

    expect(await subject().get()).toEqual(mockSecrets)
  })
})

describe(".put(newSecrets)", () => {
  it("updates the provider secrets on AWS and returns them", async () => {
    SecretsHelper.mockImplementation((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder")

      return {
        upsertSecret: async (key, secrets) => {
          expect(key).toEqual("wdc")

          return {
            secrets: {
              "foo": "bar",
              "my_secret": "baz",
            },
          }
        },
      }
    })

    expect(await subject().put({my_secret: "baz"})).toEqual(
      {
        "foo": "bar",
        "my_secret": "baz",
      }
    )
  })
})
