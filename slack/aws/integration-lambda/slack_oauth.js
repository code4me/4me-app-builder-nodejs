"use strict"

const axios = require("axios")
const querystring = require("querystring")

const SLACK_OAUTH_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize"
const SLACK_OAUTH_TOKEN_URL = "https://slack.com/api/oauth.v2.access"

class SlackOauth {
  constructor(params) {
    this.clientId = params.clientId
    this.clientSecret = params.clientSecret
    this.redirectUrl = params.redirectUrl
  }

  authorizeUrl(state) {
    return `${SLACK_OAUTH_AUTHORIZE_URL}?scope=${encodeURIComponent("commands,users:read,users:read.email")}&client_id=${encodeURIComponent(this.clientId)}&redirect_uri=${encodeURIComponent(this.redirectUrl)}&state=${encodeURIComponent(state)}`
  }

  async getAuthorization(code) {
    const response = await axios.post(
      `${SLACK_OAUTH_TOKEN_URL}?redirect_uri=${encodeURIComponent(this.redirectUrl)}`,
      querystring.stringify(
        {
          code: code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        },
      ),
    )
    if (response.status !== 200) {
      console.error("Failed to get Slack oauth token: %s", response.status)
      console.error("Response data: %j", response.data)
      return null
    }

    return response.data
  }
}

module.exports = SlackOauth
