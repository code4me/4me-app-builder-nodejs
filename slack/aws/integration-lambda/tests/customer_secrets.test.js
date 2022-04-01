"use strict"

const SecretsHelper = require("../../../../library/helpers/secrets_helper")
jest.mock("../../../../library/helpers/secrets_helper")

const CustomerSecrets = require("../customer_secrets")

const subject = () => {
  return new CustomerSecrets({
    secretApplicationName: "4me-app-builder",
    offeringReference: "my-app-reference",
    env4me: "4me-demo.com",
    account: "wna-it",
  })
}

describe(".get()", () => {
  it("returns the secrets for the app customer from AWS", async () => {
    const mockSecrets = {
      "my_secret": "foo",
    }
    SecretsHelper.mockImplementation((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder/my-app-reference")

      return {
        getSecrets: async (key) => {
          expect(key).toEqual("instances/wna-it")
          return mockSecrets
        }
      }
    })

    expect(await subject().get()).toEqual(mockSecrets)
  })
})

describe(".put(newSecrets)", () => {
  it("updates the app customer secrets on AWS and returns them", async () => {
    SecretsHelper.mockImplementation((client, env4me, applicationName) => {
      expect(env4me).toEqual("4me-demo.com")
      expect(applicationName).toEqual("4me-app-builder/my-app-reference")

      return {
        updateSecrets: async (key, secrets) => {
          expect(key).toEqual("instances/wna-it")
          expect(secrets).toEqual({"my_secret": "baz"})

          return {
            secrets: {
              "foo": "bar",
              "my_secret": "baz",
            },
          }
        },
      }
    })

    expect(await subject().put({"my_secret": "baz"})).toEqual(
      {
        "foo": "bar",
        "my_secret": "baz",
      }
    )
  })
})
