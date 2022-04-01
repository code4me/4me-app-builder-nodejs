"use strict"

const axios = require("axios")

const SLACK_API_URL = "https://slack.com/api"

class SlackManifestApi {
  constructor(appConfigurationToken) {
    this.token = appConfigurationToken
  }

  async createApp(appManifest) {
    const response = await axios.post(
      `${SLACK_API_URL}/apps.manifest.create`,
      {
        manifest: appManifest,
      },
      {
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Content-type": "application/json; charset=utf-8",
        },
      }
    )

    if (response.status !== 200 || !response.data) {
      console.error("Failed to create Slack App: %s", response.status)
      console.error("Response data: %j", response.data)
      return null
    }

    if (!response.data.ok) {
      console.error("Failed to create Slack App: %j", response.data)
      return null
    }

    return {
      id: response.data.app_id,
      clientId: response.data.credentials.client_id,
      clientSecret: response.data.credentials.client_secret,
      signingSecret: response.data.credentials.signing_secret,
    }
  }

  async updateApp(appId, appManifest) {
    const response = await axios.post(
      `${SLACK_API_URL}/apps.manifest.update`,
      {
        app_id: appId,
        manifest: appManifest,
      },
      {
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Content-type": "application/json; charset=utf-8",
        },
      }
    )

    if (response.status !== 200 || !response.data) {
      console.error("Failed to update Slack App: %s", response.status)
      console.error("Response data: %j", response.data)
      return null
    }

    if (!response.data.ok) {
      console.error("Failed to update Slack App: %j", response.data)
      return null
    }

    return response.data.app_id
  }
}

module.exports = SlackManifestApi
