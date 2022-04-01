"use strict"

const path = require("path")

const AwsConfigHelper = require("../library/helpers/aws_config_helper")
const CliInputHelper = require("../library/helpers/cli_input_helper")
const ConfigFileHelper = require("../library/helpers/config_file_helper")
const Js4meDeployHelper = require("../library/helpers/js_4me_deploy_helper")

const SlackApp = require("./aws/integration-lambda/slack_app")

class Deployment {
  constructor(domain, account, serviceInstanceName, slackAppName) {
    this.domain = domain
    this.account = account
    this.serviceInstanceName = serviceInstanceName
    this.slackAppName = slackAppName

    this.stackName = "app-builder-slack"

    this.js4meDeployHelper = new Js4meDeployHelper()
    this.configFileHelper = new ConfigFileHelper(__dirname, "config", "4me")

    this.offeringReference = this.readOfferingInput().reference
  }

  async loginTo4me(domain, account, clientID, token) {
    const {helper, accessToken} =
      await this.js4meDeployHelper.logInto4me(domain, account, clientID, token)

    this.js4meHelper = helper
    this.accessToken = accessToken
  }

  async loginTo4meUsingAwsClientConfig(domain, account, awsClientConfig) {
    const {helper, accessToken} =
      await this.js4meDeployHelper.logInto4meUsingAwsClientConfig(awsClientConfig, domain, account)

    this.js4meHelper = helper
    this.accessToken = accessToken
  }

  async update4me(s3Bucket, lambdaArn, lambdaUrl, sqsQueueArn, awsRegion) {
    const serviceInstance = await this.findServiceInstance()
    const lambdaProduct = await this.findLambdaProduct()
    const sqsProduct = await this.findSqsProduct()

    await this.assertS3BucketCi(s3Bucket)

    await this.syncIntegrationLambdaCi(lambdaProduct, serviceInstance, lambdaArn, lambdaUrl, awsRegion)

    await this.syncSlackSqsCi(sqsProduct, serviceInstance, sqsQueueArn, awsRegion)

    const offeringInput = this.readOfferingInput()
    const avatar = this.readAvatar()
    const appOffering = await this.createAppOffering(offeringInput, avatar, serviceInstance, lambdaUrl)

    const uiExtensionInput = this.readUiExtensionInput()
    await this.createAppOfferingUiExtension(appOffering, uiExtensionInput)

    return { appOffering }
  }

  async findServiceInstance() {
    const serviceInstanceFilter = {
      name: {
        values: [this.serviceInstanceName],
      },
    }

    return await this.js4meDeployHelper.findServiceInstance(this.js4meHelper, this.accessToken, serviceInstanceFilter)
  }

  async findLambdaProduct() {
    return await this.js4meDeployHelper.findDefaultLambdaProduct(this.js4meHelper, this.accessToken)
  }

  async findSqsProduct() {
    return await this.js4meDeployHelper.findDefaultSqsProduct(this.js4meHelper, this.accessToken)
  }

  async deployIntegrationLambda(awsClientConfig, profile) {
    const samPath = path.resolve(__dirname, 'aws')

    const result = await this.js4meDeployHelper.deployLambdaWithBootstrapSecrets(
      awsClientConfig,
      profile,
      samPath,
      this.stackName,
      this.domain,
      this.account,
      this.offeringReference,
    )

    result.sqsQueueArn = result.stacksOutput['SqsQueueArn']

    return result
  }

  async assertS3BucketCi(s3Bucket) {
    return await this.js4meDeployHelper.findS3BucketConfigurationItem(s3Bucket, this.js4meHelper, this.accessToken)
  }

  async syncIntegrationLambdaCi(lambdaProduct, serviceInstance, lambdaArn, lambdaUrl, awsRegion) {
    const filename = "slack_lambda_ci_input"
    const source = "4me-integration-slack"

    const slackLambdaCiInput = this.readConfigFromFile(filename)

    const extraProps = {
      productId: lambdaProduct.id,
      serviceId: serviceInstance.service.id,
      serviceInstanceIds: [serviceInstance.id],
      location: `Amazon ${awsRegion}`,
      systemID: lambdaArn,
      customFields: [
        {
          id: 'cloudformation_stack',
          value: this.stackName,
        },
        {
          id: 'api_url',
          value: lambdaUrl,
        },
      ],
    }

    const {input, filter} = this.js4meDeployHelper.upsertOnSourceIDData(slackLambdaCiInput, source, filename, extraProps)

    return await this.js4meDeployHelper.syncConfigurationItem(this.js4meHelper, this.accessToken, filter, input)
  }

  async syncSlackSqsCi(sqsProduct, serviceInstance, sqsQueueArn, awsRegion) {
    const filename = "slack_sqs_ci_input"
    const source = "4me-integration-slack"

    const slackSqsCiInput = this.readConfigFromFile(filename)

    const extraProps = {
      productId: sqsProduct.id,
      serviceId: serviceInstance.service.id,
      serviceInstanceIds: [serviceInstance.id],
      location: `Amazon ${awsRegion}`,
      systemID: sqsQueueArn,
      customFields: [
        {
          id: 'cloudformation_stack',
          value: this.stackName,
        },
      ],
    }

    const {input, filter} = this.js4meDeployHelper.upsertOnSourceIDData(slackSqsCiInput, source, filename, extraProps)

    return await this.js4meDeployHelper.syncConfigurationItem(this.js4meHelper, this.accessToken, filter, input)
  }

  async deploySlackApp(awsClientConfig, slackAppConfigurationToken, lambdaUrl) {
    return await SlackApp.deploy(
      slackAppConfigurationToken,
      awsClientConfig,
      this.js4meDeployHelper.secretApplicationName,
      this.domain,
      this.offeringReference,
      this.slackAppName,
      lambdaUrl,
    )
  }

  async createAppOffering(offeringInput, avatar, serviceInstance, configurationUrl) {
    offeringInput.serviceInstanceId = serviceInstance.id
    offeringInput.configurationUriTemplate = configurationUrl

    return await this.js4meDeployHelper.upsertOffering(this.js4meHelper, this.accessToken, offeringInput, avatar)
  }

  async createAppOfferingAutomationRules(offering, offeringRuleInputs) {
    offeringRuleInputs.forEach((rule) => rule.appOfferingId = offering.id)

    const existingRules = offering.automationRules.nodes

    await this.js4meDeployHelper.syncOfferingAutomationRules(
      this.js4meHelper,
      this.accessToken,
      existingRules,
      offeringRuleInputs,
    )
  }

  async createAppOfferingUiExtension(offering, uiExtensionInput) {
    return await this.js4meDeployHelper.syncUiExtensionVersion(this.js4meHelper, this.accessToken, offering, uiExtensionInput)
  }

  readOfferingInput() {
    const filename = "app_offering_input"
    const source = "4me-integration-slack"

    const appOfferingInput = this.readConfigFromFile(filename)
    const {input} = this.js4meDeployHelper.upsertOnSourceIDData(appOfferingInput, source, filename, {})

    return input
  }

  readUiExtensionInput() {
    const filename = "ui_extension_input"
    const source = "4me-integration-slack"

    const uiExtensionInput = this.configFileHelper.readUiExtensionFromFiles(filename)
    const {input} = this.js4meDeployHelper.upsertOnSourceIDData(uiExtensionInput, source, filename, {})

    return input
  }

  readAvatar() {
    const filename = "slack-logo.png"

    return this.configFileHelper.readAvatar(filename)
  }

  readConfigFromFile(filename) {
    return this.configFileHelper.readConfigJsonFile(`${filename}.json`)
  }
}

module.exports = Deployment

Deployment.gatherInput = async () => {
  const inputs = await (new CliInputHelper(__dirname)).gatherInput({
    profile: {"AWS profile": {default: "development"}},
    domain: {"4me domain": {default: "4me-development.com"}},
    account: {"4me account": {default: "wdc"}},
    serviceInstanceName: {"Service instance": {default: "Mainframe 1"}},
    deploySlackApp: {"Deploy Slack App to slack.com?": {default: "Y"}},
  })

  const skipSlackAppDeployment = (inputs.deploySlackApp.toUpperCase() !== "Y")

  let extraInputs = {}
  if (!skipSlackAppDeployment) {
    extraInputs = await (new CliInputHelper(__dirname)).gatherInput({
      slackAppConfigurationToken: "Slack Workspace App Configuration Token",
      slackAppName: {"Slack App name": {default: "4me Development"}},
    })
  }

  return {...inputs, skipSlackAppDeployment, ...extraInputs}
}

Deployment.main = async () => {
  if (require.main !== module) {
    return
  }

  const {profile, domain, account, serviceInstanceName, skipSlackAppDeployment, slackAppConfigurationToken, slackAppName} =
    await Deployment.gatherInput()

  const awsClientConfig =
    await new AwsConfigHelper(profile).getClientConfig()

  const deployment = new Deployment(domain, account, serviceInstanceName, slackAppName)

  await deployment.loginTo4meUsingAwsClientConfig(domain, account, awsClientConfig)

  const {s3Bucket, lambdaArn, lambdaUrl, sqsQueueArn} =
    await deployment.deployIntegrationLambda(awsClientConfig, profile)

  if (!skipSlackAppDeployment) {
    const slackAppId = await deployment.deploySlackApp(
      awsClientConfig,
      slackAppConfigurationToken,
      lambdaUrl,
    )
    if (!slackAppId) {
      console.log("Slack App deployment failed")
      process.exit(1)
    }

    console.log(`Slack App ${slackAppId} deployed to slack.com.`)
  } else {
    console.log("Slack App deployment to slack.com skipped.")
  }

  const result = await deployment.update4me(s3Bucket, lambdaArn, lambdaUrl, sqsQueueArn, awsClientConfig.region)
  if (!result) {
    console.log("4me update failed")
    process.exit(1)
  }

  console.log(`App Offering is available at: https://${account}.${domain}/app_offerings/${result.appOffering.id}`)
  console.log("Deployment successful")
}

Deployment.main()
