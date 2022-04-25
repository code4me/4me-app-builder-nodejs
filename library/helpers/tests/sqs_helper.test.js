"use strict";

const {SQSClient, SendMessageCommand} = require("@aws-sdk/client-sqs");
jest.mock("@aws-sdk/client-sqs");

const SqsHelper = require("../sqs_helper");

const subject = () => {
  return new SqsHelper();
};

describe(".sendMessage(url, body)", () => {
  it("sends the body to the sqs queue at url", async () => {
    const mockSendMessageCommand = {};
    SendMessageCommand.mockImplementation((params) => {
      expect(params.QueueUrl).toEqual("https://my-queue.example.com");
      expect(params.MessageBody).toEqual("Foo bar");

      return mockSendMessageCommand;
    });
    const mockResponse = {};
    SQSClient.mockImplementation(() => {
      return {
        send: async (sendMessageCommand) => {
          expect(sendMessageCommand).toEqual(mockSendMessageCommand);

          return mockResponse;
        },
      };
    });

    const body = "Foo bar";
    const url = "https://my-queue.example.com";
    expect(await subject().sendMessage(url, body)).toBe(mockResponse);
  });
});
