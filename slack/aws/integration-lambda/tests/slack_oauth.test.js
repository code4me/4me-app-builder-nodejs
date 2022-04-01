"use strict"

const axios = require("axios")
jest.mock("axios")

const SlackOauth = require("../slack_oauth")

const subject = () => {
  return new SlackOauth({
    clientId: "MY_CLIENT_ID",
    clientSecret: "MY_CLIENT_SECRET",
    redirectUrl: "http://example.com/callback",
  })
}

describe(".authorizeUrl(state)", () => {
  it("returns the url to initialize the Slack oauth authorization process", async () => {
    expect(subject().authorizeUrl('12345')).toEqual(
      "https://slack.com/oauth/v2/authorize?scope=commands%2Cusers%3Aread%2Cusers%3Aread.email&client_id=MY_CLIENT_ID&redirect_uri=http%3A%2F%2Fexample.com%2Fcallback&state=12345"
    )
  })
})

describe(".getAuthorizion(code)", () => {
  it("returns Slack authorization", async () => {
    const code = '12345'
    const mockSlackAuthorization = {
      "ok": true,
      "access_token": "foo",
      "team": {
        "name": "My workspace",
        "id": "T9TK3CUKW",
      },
    }

    axios.post.mockImplementation((url, data) => {
      expect(url).toEqual(
        "https://slack.com/api/oauth.v2.access?redirect_uri=http%3A%2F%2Fexample.com%2Fcallback",
      )
      expect(data).toEqual("code=12345&client_id=MY_CLIENT_ID&client_secret=MY_CLIENT_SECRET")

      return {
        "status": 200,
        "data": mockSlackAuthorization,
      }
    })

    expect(await subject().getAuthorization(code)).toEqual(mockSlackAuthorization)
  })
})
