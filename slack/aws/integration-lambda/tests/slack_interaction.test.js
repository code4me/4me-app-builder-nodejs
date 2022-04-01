"use strict"

const axios = require("axios")
jest.mock("axios")

const SlackInteraction = require("../slack_interaction")

const subject = () => {
  return new SlackInteraction("https://hooks.slack.com/foobarbaz/")
}

describe(".send(text)", () => {
  it("sends the text as an interaction response to Slack and returns true", async () => {
    axios.post.mockImplementation((url, data) => {
      expect(url).toEqual("https://hooks.slack.com/foobarbaz/")
      expect(data.replace_original).toEqual("true")
      expect(data.response_type).toEqual("in_channel")
      expect(data.blocks[0].text.text).toEqual("Foo bar")

      return {
        "status": 200,
        "data": "",
      }
    })

    const text = "Foo bar"
    expect(await subject().send(text)).toEqual(true)
  })
})

describe("SlackInteraction.createRequestView(subject)", () => {
  it("return a Slack view to create a request", async () => {
    const responseUrl = "https://foo.example.com"
    const subject = "Pizza!"
    const note = "With ananas and cheese"

    const result = SlackInteraction.createRequestView(responseUrl, subject, note)

    expect(JSON.parse(result).type).toEqual("modal")
    expect(JSON.parse(JSON.parse(result).private_metadata).responseUrl).toEqual("https://foo.example.com")
  })
})
