"use strict"

const Request = require("../request")

const subject = () => {
  return new Request({
    id: "123456789012345678901234",
    account: "wna-it",
    requestId: "123456",
  })
}

describe(".id", () => {
  it("returns the internal request id", async () => {
    expect(subject().id).toEqual("123456789012345678901234")
  })
})

describe(".requestId", () => {
  it("returns the external request id", async () => {
    expect(subject().requestId).toEqual("123456")
  })
})

describe(".account", () => {
  it("returns the account of the request", async () => {
    expect(subject().account).toEqual("wna-it")
  })
})
