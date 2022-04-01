"use strict"

const AppInstance = require("../app_instance")

const subject = () => {
  return new AppInstance({
    id: "1234567890",
    env4me: "4me-demo.com",
    account: "wna-it",
  })
}

describe(".externalConfigurationCallbackUrl()", () => {
  it("returns the 4me url where a user should confirm the app configuration", async () => {
    expect(subject().externalConfigurationCallbackUrl()).toEqual(
      "https://wna-it.4me-demo.com/app_instances/1234567890/confirm_configuration",
    )
  })
})
