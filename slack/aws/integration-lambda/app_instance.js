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
}

module.exports = AppInstance
