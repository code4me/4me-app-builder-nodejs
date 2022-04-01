"use strict"

const {SQSClient, SendMessageCommand} = require("@aws-sdk/client-sqs")
jest.mock("@aws-sdk/client-sqs")

const SqsQueue = require("../sqs_queue")

const subject = () => {
  return new SqsQueue("https://my-queue.example.com")
}

describe(".sendMessage(body)", () => {
  it("sends the body to the AWS sqs queue", async () => {
    const mockSendMessageCommand = {}
    SendMessageCommand.mockImplementation((params) => {
      expect(params.QueueUrl).toEqual("https://my-queue.example.com")
      expect(params.MessageBody).toEqual("Foo bar")

      return mockSendMessageCommand
    })
    const mockResponse = {}
    SQSClient.mockImplementation(() => {
      return {
        send: async (sendMessageCommand) => {
          expect(sendMessageCommand).toEqual(mockSendMessageCommand)

          return mockResponse
        },
      }
    })

    const body = "Foo bar"
    expect(await subject().sendMessage(body)).toBe(mockResponse)
  })
})
