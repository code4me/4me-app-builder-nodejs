"use strict"

const axios = require('axios')
jest.mock("axios")

const SlackApi = require("../slack_api")

const subject = () => {
  return new SlackApi({
    token: "1234567890ABCDEFGH",
  })
}

describe("SlackApi.validateSignature(signingSecret, signature, timestamp, body)", () => {
  it("returns true if the body and timestamp matches the signature", async () => {
    const signingSecret = "SECRET"
    const signature = "v0=4363e665ed83f18bd0666a9a1e715fa797160aa2365c58531593f928efceefd8"
    const timestamp = "foo"
    const body = "bar"

    expect(SlackApi.validateSignature(signingSecret, signature, timestamp, body)).toBe(true)
  })

  it("returns false if the body does not match the signature", async () => {
    const signingSecret = "SECRET"
    const signature = "v0=4363e665ed83f18bd0666a9a1e715fa797160aa2365c58531593f928efceefd8"
    const timestamp = "foo"
    const body = "tampered"

    expect(SlackApi.validateSignature(signingSecret, signature, timestamp, body)).toBe(false)
  })

  it("returns false if the timestamp does not match the signature", async () => {
    const signingSecret = "SECRET"
    const signature = "v0=4363e665ed83f18bd0666a9a1e715fa797160aa2365c58531593f928efceefd8"
    const timestamp = "tampered"
    const body = "bar"

    expect(SlackApi.validateSignature(signingSecret, signature, timestamp, body)).toBe(false)
  })
})

describe(".userEmail(userId)", () => {
  it("returns the email address of the Slack user", async () => {
    const userId = '12345'
    const mockSlackUserInfo = {
      ok: true,
      user: {
        id: userId,
        name: "Howard Tanner",
        profile: {
          email: "howard.tanner@widget.com",
        }
      },
    }

    axios.get.mockImplementation((url, options) => {
      expect(url).toEqual("https://slack.com/api/users.info")
      expect(options.params).toEqual({
        user: "12345",
      })
      expect(options.headers).toEqual({
        Authorization: "Bearer 1234567890ABCDEFGH",
      })

      return {
        "status": 200,
        "data": mockSlackUserInfo,
      }
    })

    expect(await subject().userEmail(userId)).toEqual('howard.tanner@widget.com')
  })
})

describe(".openModal(trigger_id, view)", () => {
  it("opens a modal in a Slack channel", async () => {
    axios.post.mockImplementation((url, data, config) => {
      expect(url).toEqual("https://slack.com/api/views.open")
      expect(data.trigger_id).toEqual("123456.12345678.123456")
      expect(data.view).toEqual({"foo": "bar"})
      expect(config.headers).toEqual({
        Authorization: "Bearer 1234567890ABCDEFGH",
      })

      return {
        "status": 200,
        "data": {
          "ok": true,
        }
      }
    })

    const trigger_id = "123456.12345678.123456"
    const view = {"foo": "bar"}
    expect(await subject().openModal(trigger_id, view)).toEqual(true)
  })
})
