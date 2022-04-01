const {SecretsManagerClient} = require("@aws-sdk/client-secrets-manager")

const SlackAppSecrets = require("./slack_app_secrets")
const SlackManifestApi = require("./slack_manifest_api")

class SlackApp {
  constructor(name, lambdaUrl) {
    this.name = name
    this.lambdaUrl = lambdaUrl
  }

  manifest() {
    return {
      display_information: {
        name: this.name,
        description: "Connecting 4me",
        background_color: "#062340",
      },
      features: {
        bot_user: {
          display_name: `${this.name} Bot`,
          always_online: false,
        },
        shortcuts: [
          {
            name: "Create a request",
            type: "message",
            callback_id: "create-request",
            description: "Create a request in 4me",
          },
        ],
        slash_commands: [
          {
            command: "/4me",
            url: this.lambdaUrl,
            description: "Create a request in 4me",
            usage_hint: "[request subject]",
            should_escape: false,
          },
        ]
      },
      oauth_config: {
        redirect_urls: [
          this.lambdaUrl,
        ],
        scopes: {
          user: [
            "users:read.email",
            "users:read",
          ],
          bot: [
            "commands",
          ],
        }
      },
      settings: {
        interactivity: {
          is_enabled: true,
          request_url: this.lambdaUrl,
        },
        org_deploy_enabled: false,
        socket_mode_enabled: false,
        token_rotation_enabled: false,
      }
    }
  }
}

SlackApp.deploy = async (slackAppConfigurationToken, awsClientConfig, secretApplicationName, env4me, offeringReference, slackAppName, lambdaUrl) => {
  const slackAppId = await SlackApp.find(awsClientConfig, secretApplicationName, env4me, offeringReference)
  if (slackAppId) {
    return await SlackApp.update(slackAppConfigurationToken, slackAppId, slackAppName, lambdaUrl)
  } else {
    return await SlackApp.create(
      slackAppConfigurationToken,
      awsClientConfig,
      secretApplicationName,
      env4me,
      offeringReference,
      slackAppName,
      lambdaUrl,
    )
  }
}

SlackApp.find = async (awsClientConfig, secretApplicationName, env4me, offeringReference) => {
  const secretsClient = new SecretsManagerClient(awsClientConfig)
  const slackAppSecrets = new SlackAppSecrets({secretsClient, env4me, secretApplicationName, offeringReference})

  const slackAppCredentials = await slackAppSecrets.get()

  return slackAppCredentials && slackAppCredentials.id
}

SlackApp.create = async (appConfigurationToken, awsClientConfig, secretApplicationName, env4me, offeringReference, name, lambdaUrl) => {
  const appManifest = (new SlackApp(name, lambdaUrl)).manifest()

  const slackAppCredentials = await (new SlackManifestApi(appConfigurationToken)).createApp(appManifest)
  if (!slackAppCredentials || !slackAppCredentials.id) {
    return
  }

  const secretsClient = new SecretsManagerClient(awsClientConfig)
  const slackAppSecrets = new SlackAppSecrets({secretsClient, env4me, secretApplicationName, offeringReference})

  const result = await slackAppSecrets.put({...slackAppCredentials})
  if (!result && !result.secrets) {
    console.log(awsResult)
    return
  }

  return slackAppCredentials.id
}

SlackApp.update = async (appConfigurationToken, appId, name, lambdaUrl) => {
  const appManifest = (new SlackApp(name, lambdaUrl)).manifest()
  return await (new SlackManifestApi(appConfigurationToken)).updateApp(appId, appManifest)
}

module.exports = SlackApp
