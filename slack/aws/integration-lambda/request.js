"use strict"

class Request {
  constructor(params) {
    this.env4me = params.env4me
    this.account = params.account.id || params.account
    this.id = params.id
    this.requestId = params.requestId
  }

  url() {
    return `https://${this.account}.${this.env4me}/self-service/requests/${this.requestId}`
  }
}

module.exports = Request
