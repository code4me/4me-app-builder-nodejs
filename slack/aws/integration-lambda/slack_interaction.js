"use strict"

const axios = require("axios")

class SlackInteraction {
  constructor(responseUrl) {
    this.responseUrl = responseUrl
  }

  async sendCreateRequestSuccess(request) {
    return this.send(
      SlackInteraction.renderCreateRequestSuccessMessage(request)
    )
  }

  async sendCreateRequestFailedWithUnknownWorkspace() {
    return this.send(
      SlackInteraction.renderCreateRequestErrorMessage("There is no Slack app in 4me linked to your Slack workspace."),
    )
  }

  async sendCreateRequestFailedWithUnknownUserEmail(userEmail) {
    return this.send(
      SlackInteraction.renderCreateRequestErrorMessage(`Your email address ${userEmail} is unknown in 4me.`),
    )
  }

  async sendCreateRequestFailedWithUnknownError() {
    return this.send(
      SlackInteraction.renderCreateRequestErrorMessage("Unknown error."),
    )
  }

  async send(message) {
    let text
    let blocks

    if (typeof message === 'string') {
      text = message
      blocks = [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": message,
          },
        }
      ]
    } else if (typeof message === 'array') {
      text = "This content can't be displayed."
      blocks = message
    } else {
      text = message.text
      blocks = message.blocks
    }

    try {
      const response = await axios.post(this.responseUrl, {
        "replace_original": "true",
        "response_type": "in_channel",
        "text": text,
        "blocks": blocks,
      })

      if (response.status !== 200) {
        console.error(response.data)
        console.error(response.status)
        return false
      }
    } catch(error) {
      console.error(error.message)
      return false
    }

    return true
  }
}

SlackInteraction.renderScheduleCreateRequestMessage = (result) => {
  if (result) {
    return SlackInteraction.renderSlackTextMessage("Creating a request in 4me...")
  } else {
    return SlackInteraction.renderSlackErrorMessage("Sorry, failed to create the request in 4me.")
  }
}

SlackInteraction.createRequestView = (responseUrl, subject, note) => {
  return JSON.stringify({
    type: 'modal',
    private_metadata: JSON.stringify({responseUrl}),
    title: {
      type: 'plain_text',
      text: 'Submit a request in 4me',
    },
    callback_id: 'create-request',
    submit: {
      type: 'plain_text',
      text: 'Submit',
    },
    blocks: [
      {
        block_id: 'subject_block',
        type: 'input',
        label: {
          type: 'plain_text',
          text: 'Subject',
        },
        element: {
          action_id: 'subject',
          type: 'plain_text_input',
          initial_value: subject || '',
          focus_on_load: !Boolean(subject),
        },
      },
      {
        block_id: 'note_block',
        type: 'input',
        label: {
          type: 'plain_text',
          text: 'Note',
        },
        element: {
          action_id: 'note',
          type: 'plain_text_input',
          initial_value: note || '',
          focus_on_load: Boolean(subject),
          multiline: true,
        },
        optional: true,
      },
    ]
  })
}

SlackInteraction.renderCreateRequestSuccessMessage = (request) => {
  return SlackInteraction.renderSlackTextMessage(`:white_check_mark: Registered request <${request.url()}|#${request.requestId}> for you.`)
}

SlackInteraction.renderCreateRequestErrorMessage = (text) => {
  return SlackInteraction.renderSlackErrorMessage(`Sorry, something went wrong while registering your request: ${text}`)
}

SlackInteraction.renderSlackTextMessage = (text) => {
  return {
    "text": text,
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": text,
        },
      },
    ],
  }
}

SlackInteraction.renderSlackErrorMessage = (text) => {
  return {
    "text": text,
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `:x: ${text}`,
        },
      },
    ],
  }
}

module.exports = SlackInteraction
