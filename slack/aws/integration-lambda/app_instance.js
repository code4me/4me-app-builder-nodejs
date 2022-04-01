"use strict"

class AppInstance {
  constructor(params) {
    this.id = params.id
    this.env4me = params.env4me
    this.offeringReference = params.offeringReference
    this.account = params.account
    this.createdAt = params.createdAt
    this.enabledByCustomer = params.enabledByCustomer
  }

  externalConfigurationCallbackUrl() {
    return `https://${this.account}.${this.env4me}/app_instances/${this.id}/confirm_configuration`
  }
}

module.exports = AppInstance
