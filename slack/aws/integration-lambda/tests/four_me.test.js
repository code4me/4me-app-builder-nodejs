"use strict"

const Js4meHelper = require("../../../../library/helpers/js_4me_helper")
jest.mock("../../../../library/helpers/js_4me_helper")

const FourMe = require("../four_me")

const subject = () => {
  return new FourMe({
    env4me: "4me-demo.com",
    account: "wdc",
    clientId: "foo",
    clientSecret: "bar",
    publicKeyPem: "qux",
    jwtAlgorithm: "baz",
    jwtAudience: "quux",
  })
}

describe(".appInstance(nodeId)", () => {
  it("returns an appInstance from 4me", async () => {
    Js4meHelper.mockImplementation(() => {
      const mockAccessToken = {}
      return {
        getToken: () => {
          return mockAccessToken
        },
        getGraphQLQuery: async (desc, accessToken, query, vars) => {
          expect(desc).toEqual("Get app instance details")
          expect(accessToken).toBe(mockAccessToken)
          expect(vars).toEqual({ nodeId: "N123456" })

          return {
            node: {
              id: "N123456",
              appOffering: {
                reference: "slack",
              },
              customerAccount: {
                id: "wna-it",
              },
            },
          }
        },
      }
    })

    const nodeId = "N123456"
    const appInstance = await subject().appInstance(nodeId)

    expect(appInstance.account).toEqual("wna-it")
  })
})

describe(".activeAppInstance(offeringReference, customFilters = {})", () => {
  it("returns an appInstance matching the customFilters iff it is enabled", async () => {
    Js4meHelper.mockImplementation(() => {
      const mockAccessToken = {}
      return {
        getToken: () => {
          return mockAccessToken
        },
        getGraphQLQuery: async (desc, accessToken, query, vars) => {
          expect(desc).toEqual("Get app instances details")
          expect(accessToken).toBe(mockAccessToken)
          expect(vars).toEqual({
            reference:"slack",
            customFilters:[],
          })

          return {
            appInstances: {
              nodes: [
                {
                  id: "N123456",
                  appOffering: {
                    reference: "slack",
                  },
                  customerAccount: {
                    id: "wna-it",
                  },
                },
              ],
            },
          }
        },
      }
    })

    const offeringReference = "slack"
    const appInstance = await subject().activeAppInstance(offeringReference)

    expect(appInstance.account).toEqual("wna-it")
  })
})

describe(".configureAppInstance(appInstanceId, config)", () => {
  it("stores the config in the app instance's custom fields in 4me", async () => {
    Js4meHelper.mockImplementation(() => {
      const mockAccessToken = {}
      return {
        getToken: () => {
          return mockAccessToken
        },
        executeGraphQLMutation: async (desc, accessToken, query, vars) => {
          expect(desc).toEqual("Update app instance")
          expect(accessToken).toBe(mockAccessToken)
          expect(vars).toEqual({
            input: {
              id: "A123456",
              customFields: [
                {
                  id: "foo",
                  value: "bar",
                },
              ],
            },
          })

          return {
            appInstance: {
              id: "A123456",
              customerAccount: {
                id: "wna-it",
              },
              customFields: [
                {
                  id: "foo",
                  value: "bar",
                },
              ],
            },
          }
        },
      }
    })

    const appInstanceId = "A123456"
    const config = { foo: "bar" }
    const customFields = await subject().configureAppInstance(appInstanceId, config)

    expect(customFields).toEqual({ foo: "bar" })
  })
})

describe(".findPersonIdByPrimaryEmail(primaryEmail)", () => {
  it("returns the PersonId in 4me for a given primaryEmail", async () => {
    Js4meHelper.mockImplementation(() => {
      const mockAccessToken = {}
      return {
        getToken: () => {
          return mockAccessToken
        },
        getGraphQLQuery: async (desc, accessToken, query, vars) => {
          expect(desc).toEqual("Find person Id by primary email")
          expect(accessToken).toBe(mockAccessToken)
          expect(vars).toEqual({ primaryEmail: "howard.tanner@widget.com" })

          return {
            people: {
              nodes: [
                {
                  id: "P123456",
                },
              ],
            },
          }
        },
      }
    })

    const primaryEmail = "howard.tanner@widget.com"
    expect(await subject().findPersonIdByPrimaryEmail(primaryEmail)).toEqual("P123456")
  })
})

describe(".createRequest(requestedForId, subject, note)", () => {
  it("creats a request in 4me and returns it", async () => {
    Js4meHelper.mockImplementation(() => {
      const mockAccessToken = {}
      return {
        getToken: () => {
          return mockAccessToken
        },
        getGraphQLQuery: async (desc, accessToken, query, vars) => {
          expect(desc).toEqual("Get person account id")
          expect(accessToken).toBe(mockAccessToken)
          expect(vars).toEqual({
            nodeId: "P123456",
          })

          return {
            node: {
              account: {
                id: "widget",
              }
            },
          }
        },
        executeGraphQLMutation: async (desc, accessToken, query, vars) => {
          expect(desc).toEqual("Create request")
          expect(accessToken).toBe(mockAccessToken)
          expect(vars).toEqual({
            input: {
              subject: "Pizza!",
              category: "other",
              requestedForId: "P123456",
              note: "with cheese",
              source: "Slack",
            }
          })

          return {
            request: {
              id: "N0123456",
              requestId: "12345",
            },
          }
        },
      }
    })

    const requestedForId = "P123456"
    const requestSubject = "Pizza!"
    const note = "with cheese"
    const request = await subject().createRequest(requestedForId, requestSubject, note)

    expect(request.id).toEqual("N0123456")
    expect(request.requestId).toEqual("12345")
    expect(request.account).toEqual("widget")
  })
})
