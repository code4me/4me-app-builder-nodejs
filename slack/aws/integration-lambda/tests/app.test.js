"use strict"

const LambdaHandler = require("../lambda_handler")
jest.mock("../lambda_handler")

const app = require("../app")

process.env.PARAM_BOOTSTRAP_APP = "4me-app-builder"
process.env.PARAM_BOOTSTRAP_ACCOUNT = "wdc"
process.env.PARAM_4ME_DOMAIN = "4me-demo.com"
process.env.PARAM_OFFERING_REFERENCE = "slack"
process.env.SQS_QUEUE_URL = "https://foo.sqs.aws.com"

describe("app.lambdaHandler(inputLambdaEvent, lambdaContext)", () => {
  it("forwards requests to LambdaHandler", async () => {
    const inputLambdaEvent = require("./fixtures/event.json")
    const lambdaContext = require("./fixtures/context.json")

    const mockLambdaHandlerOutputEvent = {
      "statusCode": 200,
      "body": "foobar",
    }
    LambdaHandler.mockImplementation((params) => {
      expect(params.secretApplicationName).toEqual(process.env.PARAM_BOOTSTRAP_APP)
      expect(params.offeringReference).toEqual(process.env.PARAM_OFFERING_REFERENCE)
      expect(params.env4me).toEqual(process.env.PARAM_4ME_DOMAIN)
      expect(params.provider).toEqual(process.env.PARAM_BOOTSTRAP_ACCOUNT)
      expect(params.sqsQueueUrl).toEqual(process.env.SQS_QUEUE_URL)

      return {
        handle: async (lambdaHandlerInputEvent, lambdaHandlerContext) => {
          expect(lambdaHandlerInputEvent).toBe(inputLambdaEvent)
          expect(lambdaHandlerContext).toBe(lambdaContext)

          return mockLambdaHandlerOutputEvent
        },
      }
    })

    expect(await app.lambdaHandler(inputLambdaEvent, lambdaContext)).toEqual(mockLambdaHandlerOutputEvent)
  })
})
