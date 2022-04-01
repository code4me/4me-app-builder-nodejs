"use strict"

class UnsupportedEventHandler {
  async handle(event, context) {
    console.error("Unsupported Event: %j", event)
    return this.#respondWithBadRequest()
  }

  #respondWithBadRequest() {
    return {
      "statusCode": 400,
    }
  }
}

module.exports = UnsupportedEventHandler
