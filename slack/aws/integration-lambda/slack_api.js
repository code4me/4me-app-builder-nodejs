"use strict"

const axios = require("axios")
const crypto = require("crypto")

const SLACK_API_URL = "https://slack.com/api"

class SlackApi {
  constructor(params) {
    this.token = params.token
  }

  async userEmail(userId) {
    const response = await axios.get(
      `${SLACK_API_URL}/users.info`,
      {
        headers: {
          "Authorization" : `Bearer ${this.token}`,
        },
        params: {
          user: userId,
        },
      }
    )

    if (response.status !== 200 || !response.data || !response.data.ok) {
      console.error("Failed to read slack user info for %s: %s", userId, response.status)
      console.error("Data: %j", response.data)
      return null
    }

    if (!response.data.user || !response.data.user.profile) {
      console.error("Slack user info does not contain user profile: %j", response.data)
      return null
    }

    return response.data.user.profile.email
  }

  async openModal(trigger_id, view) {
    const response = await axios.post(
      `${SLACK_API_URL}/views.open`,
      {
        trigger_id: trigger_id,
        view: view,
      },
      {
        headers: {
          "Authorization" : `Bearer ${this.token}`,
        },
      }
    )

    if (response.status !== 200 || !response.data) {
      console.error("Failed to open slack view: %s", response.status)
      console.error("Data: %j", response.data)
      return null
    }

    if (!response.data.ok) {
      console.error("Failed to open slack view: %j", response.data)
      return null
    }

    return true
  }
}

SlackApi.validateSignature = (signingSecret, signature, timestamp, body) => {
  if (!signingSecret || !signature) { return false }

  if (Math.abs(Date.now()/1000 - timestamp) > 5 * 60) { return false }

  const expectedSignature = SlackApi.computeSignature(signingSecret, timestamp, body)

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
}

SlackApi.computeSignature = (signingSecret, timestamp, body) => {
  return "v0="
    + crypto.createHmac(
      "SHA256",
      signingSecret
    ).update(
      "v0:" + timestamp + ":" + body
    ).digest("hex")
}

module.exports = SlackApi
