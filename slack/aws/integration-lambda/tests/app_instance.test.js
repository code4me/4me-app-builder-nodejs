"use strict"

const AppInstance = require("../app_instance")

const subject = () => {
  return new AppInstance({
    id: "1234567890",
    env4me: "4me-demo.com",
    account: "wna-it",
  })
}

describe(".id", () => {
  it("returns the instance id", async () => {
    expect(subject().id).toEqual("1234567890")
  })
})

describe(".env4me", () => {
  it("returns the env4me", async () => {
    expect(subject().env4me).toEqual("4me-demo.com")
  })
})

describe(".account", () => {
  it("returns the account", async () => {
    expect(subject().account).toEqual("wna-it")
  })
})
