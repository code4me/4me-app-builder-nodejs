"use strict"

const SQSHelper = require('../../../library/helpers/sqs_helper')

class SqsQueue {
  constructor(url) {
    this.url = url
    this.sqsHelper = new SQSHelper()
  }

  async sendMessage(body) {
    return await this.sqsHelper.sendMessage(this.url, body)
  }
}

module.exports = SqsQueue
