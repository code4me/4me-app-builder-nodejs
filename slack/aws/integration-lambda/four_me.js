"use strict"

const Js4meHelper = require("../../../library/helpers/js_4me_helper")
const LoggedError = require("../../../library/helpers/errors/logged_error")

const AppInstance = require("./app_instance")
const Request = require("./request")

class FourMe {
  constructor(params) {
    this.env4me = params.env4me
    this.account = params.account
    this.clientId = params.clientId
    this.clientSecret = params.clientSecret
    this.publicKeyPem = params.publicKeyPem // optional
    this.jwtAlgorithm = params.jwtAlgorithm // optional
    this.jwtAudience = params.jwtAudience // optional

    this.js4meHelper = new Js4meHelper(
      this.env4me,
      this.account,
      this.clientId,
      this.clientSecret,
      this.jwtAlgorithm,
      this.publicKeyPem,
      this.jwtAudience,
    )
  }

  async appInstance(nodeId) {
    const result = await this.#executeGraphQLQuery(
      "Get app instance details",
      `query($nodeId: ID!) {
        node(
          id: $nodeId
        ) {
          id
          ... on AppInstance {
            appOffering { reference }
            customerAccount { id }
            enabledByCustomer
            createdAt
          }
        }
      }`,
      {
        nodeId: nodeId,
      }
    )
    if (!result) {
      console.error("Failure in executeGraphQLQuery.")
      return
    }

    const node = result.node
    if (!node) {
      console.error("Failed to find app instance %s: %j", nodeId, result)
      return
    }

    return new AppInstance({
      id: node.id,
      env4me: this.env4me,
      offeringReference: node.appOffering.reference,
      account: node.customerAccount.id,
      enabledByCustomer: node.enabledByCustomer,
      createdAt: new Date(node.createdAt),
    })
  }

  async activeAppInstance(offeringReference, customFilters = {}) {
    const result = await this.#executeGraphQLQuery(
      "Get app instances details",
      `query($reference: String, $customFilters: [AppInstanceCustomFilter!]) {
        appInstances(
          first: 1,
          order: {
            direction: desc
            field: createdAt
          },
          filter: {
            appOfferingReference: { values: [$reference] }
            customFilters: $customFilters
            disabled: false
            enabledByCustomer: true
            suspended: false
          }
        ) {
          nodes {
            id
            customerAccount { id }
            enabledByCustomer
            createdAt
          }
        }
      }`,
      {
        reference: offeringReference,
        customFilters: Object.entries(customFilters).map(([key, value]) => {
          return {
            name: key,
            values: [value],
          }
        })
      }
    )
    if (!result) {
      console.error("Failure in executeGraphQLQuery.")
      return
    }

    if (!result.appInstances || !result.appInstances.nodes) {
      console.error("Unexpected result from executeGraphQLQuery: %j", result)
      return
    }

    const node = result.appInstances.nodes[0]
    if (!node) { return }

    return new AppInstance({
      id: node.id,
      env4me: this.env4me,
      offeringReference: offeringReference,
      account: node.customerAccount.id,
      enabledByCustomer: node.enabledByCustomer,
      createdAt: new Date(node.createdAt),
    })
  }

  async configureAppInstance(appInstanceId, config) {
    const result = await this.#executeGraphQLMutation(
      "Update app instance",
      `mutation($input: AppInstanceUpdateInput!) {
        appInstanceUpdate(input: $input) {
          errors { path message }
          appInstance {
            id
            customerAccount { id }
            customFields { id value }
          }
        }
      }`,
      {
        input: {
          id: appInstanceId,
          customFields: Object.entries(config).map(([id, value]) => {
            return {id, value}
          }),
        },
      },
    )
    if (!result || !result.appInstance || !result.appInstance.customFields) {
      console.error("Unable to update app instance: %j", result)
      console.error("appInstanceId: %j", appInstanceId)
      console.error("config: %j", config)
      return
    }

    return Object.fromEntries(result.appInstance.customFields.map((customField) => [customField.id, customField.value]))
  }

  async findPersonIdByPrimaryEmail(primaryEmail) {
    const result = await this.#executeGraphQLQuery(
      "Find person Id by primary email",
      `query($primaryEmail: String) {
        people (
          view: all
          first:1
          filter: {
            primaryEmail: {
              values: [$primaryEmail]
            },
            disabled: false,
          }
        ) {
          nodes { id }
        }
      }`,
      {primaryEmail},
    )
    if (!result) {
      console.error("Failure in executeGraphQLQuery.")
      return
    }
    if (!result.people || !result.people.nodes) {
      console.error("Unexpected result from executeGraphQLQuery: %j", result)
      return
    }

    const nodes = result.people.nodes
    if (nodes[0]) {
      return nodes[0].id
    } else {
      return
    }
  }

  async createRequest(requestedForId, subject, note) {
    const result = await this.#executeGraphQLMutation(
      "Create request",
      `mutation($input: RequestCreateInput!) {
        requestCreate(input: $input) {
          errors { path message }
          request {
            id
            requestId
          }
        }
      }`,
      {
        input: {
          subject: subject,
          category: "other",
          requestedForId: requestedForId,
          note: note,
          source: "Slack",
        },
      },
    )

    if (!result) {
      console.error("Failure in executeGraphQLMutation.")
      return
    }

    if (!result.request) {
      console.error("Unexpected result from executeGraphQLMutation: %j", result)
      return
    }

    const account = await this.#findPersonAccountId(requestedForId)
    if (!account) {
      console.error("Failed to find person account id.")
      return
    }

    const env4me = this.env4me
    return new Request({env4me, account, ...result.request})
  }

  async #findPersonAccountId(nodeId) {
    const result = await this.#executeGraphQLQuery(
      "Get person account id",
      `query($nodeId: ID!) {
        node(
          id: $nodeId
        ) {
          id
          ... on Person {
            account { id }
          }
        }
      }`,
      {
        nodeId: nodeId,
      }
    )
    if (!result) {
      console.error("Failure in executeGraphQLQuery.")
      return
    }

    const node = result.node
    if (!node) {
      console.error("Failed to find person %s: %j", nodeId, result)
      return
    }

    if (!node.account) {
      console.error("Unexpected result from executeGraphQLQuery: %j", result)
      return
    }

    return node.account.id
  }

  async #executeGraphQLQuery(description, query, vars) {
    try {
      const accessToken = await this.js4meHelper.getToken()
      const result = await this.js4meHelper.getGraphQLQuery(description, accessToken, query, vars)
      if (result.error) {
        console.error("getGraphQLQuery failed: %j", result.error)
        return
      }

      return result
    } catch (error) {
      if (error instanceof LoggedError) { return }

      console.error("Caught unexpected error: %j", error)
      return
    }
  }

  async #executeGraphQLMutation(description, mutation, vars) {
    try {
      const accessToken = await this.js4meHelper.getToken()
      const result = await this.js4meHelper.executeGraphQLMutation(description, accessToken, mutation, vars)
      if (result.error) {
        console.error("executeGraphQLMutation failed: %j", result.error)
        return
      }

      return result
    } catch (error) {
      if (error instanceof LoggedError) { return }

      console.error("Caught unexpected error: %j", error)
      return
    }
  }
}

module.exports = FourMe
