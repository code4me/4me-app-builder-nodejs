'use strict';

const {SQSClient, SendMessageCommand} = require('@aws-sdk/client-sqs');

class SQSHelper {
  constructor(sqsClient) {
    this.client = sqsClient || new SQSClient({region: process.env.AWS_REGION}); // region based will work for lambda
  }

  async sendMessage(url, body) {
    const command = new SendMessageCommand({QueueUrl: url, MessageBody: body});
    return await this.client.send(command);
  }
}

module.exports = SQSHelper;