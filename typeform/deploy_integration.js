'use strict';

const AwsConfigHelper = require("../library/helpers/aws_config_helper");
const promptly = require('promptly');
const ConfigFileHelper = require('../library/helpers/config_file_helper');
const Js4meDeployHelper = require('../library/helpers/js_4me_deploy_helper');

const path = require('path')
const source = '4me-integration-typeform';
const stackName = 'app-builder-typeform';

class DeployIntegration {
  constructor(stackName) {
    this.stackName = stackName;
    this.js4meDeployHelper = new Js4meDeployHelper();
    this.configFileHelper = new ConfigFileHelper(__dirname, 'config', '4me');
  }

  async gatherInput() {
    const domain = await promptly.prompt('Which 4me domain: ', {default: '4me-demo.com'});
    const account = await promptly.prompt('Which 4me account: ', {default: 'wdc'});
    const serviceInstanceName = await promptly.prompt('Which service instance: ', {default: 'Mainframe 1'});
    const profile = await promptly.prompt('Which AWS profile: ', {default: 'staging'});
    return {domain: domain, account: account, serviceInstanceName: serviceInstanceName, profile: profile};
  }

  readFromFile(filename) {
    return this.configFileHelper.readConfigJsonFile(`${filename}.json`);
  }

  async loginTo4me(clientConfig, domain, account) {
    const {helper, accessToken} = await this.js4meDeployHelper.logInto4meUsingAwsClientConfig(clientConfig,
                                                                                              domain,
                                                                                              account);
    this.js4meHelper = helper;
    this.accessToken = accessToken;
  }

  async findLambdaProduct() {
    return await this.js4meDeployHelper.findDefaultLambdaProduct(this.js4meHelper, this.accessToken);
  }

  async syncConfigurationItem(filename, extraProps) {
    const {input, filter} = this.readUpsertData(filename, extraProps);
    return await this.js4meDeployHelper.syncConfigurationItem(this.js4meHelper,
                                                              this.accessToken,
                                                              filter,
                                                              input);
  }

  readUpsertData(filename, extraProps) {
    const input = this.readFromFile(filename);
    return this.js4meDeployHelper.upsertOnSourceIDData(input, source, filename, extraProps);
  }

  async deployLambda(clientConfig, profile, domain, account) {
    const samPath = path.resolve(__dirname, 'aws');
    const integrationReference = this.getIntegrationInput().reference;
    return await this.js4meDeployHelper.deployLambdaWithBootstrapSecrets(clientConfig,
                                                                         profile,
                                                                         samPath,
                                                                         this.stackName,
                                                                         domain,
                                                                         account,
                                                                         integrationReference);
  }

  async findS3BucketConfigurationItem(s3Bucket) {
    return await this.js4meDeployHelper.findS3BucketConfigurationItem(s3Bucket, this.js4meHelper, this.accessToken);
  }

  async findServiceInstance(serviceInstanceName) {
    const serviceInstanceFilter = {name: {values: [serviceInstanceName]}};
    return await this.js4meDeployHelper.findServiceInstance(this.js4meHelper,
                                                            this.accessToken,
                                                            serviceInstanceFilter);
  }

  getIntegrationInput() {
    return this.readFromFile('integration_input');
  }

  async createIntegration(serviceInstance) {
    const integrationInput = this.getIntegrationInput();
    integrationInput.serviceInstanceId = serviceInstance.id;

    return await this.js4meDeployHelper.upsertIntegration(this.js4meHelper,
                                                          this.accessToken,
                                                          integrationInput);
  }

  async createIntegrationAutomationRules(integration) {
    const existingRules = integration.automationRules.nodes;
    const integrationRuleInputs = this.readFromFile('integration_automation_rules_input');
    integrationRuleInputs.forEach((rule) => rule.integrationId = integration.id);

    await this.js4meDeployHelper.syncIntegrationAutomationRules(this.js4meHelper,
                                                                this.accessToken,
                                                                existingRules,
                                                                integrationRuleInputs);
  }

  async createUiExtension(integration) {
    const uiExtensionInput = this.configFileHelper.readUiExtensionFromFiles('ui_extension_input');

    return await this.js4meDeployHelper.syncUiExtensionVersion(this.js4meHelper,
                                                               this.accessToken,
                                                               integration,
                                                               uiExtensionInput);
  }
}

(async () => {
  const deployIntegration = new DeployIntegration(stackName);
  const {domain, account, serviceInstanceName, profile} = await deployIntegration.gatherInput();

  const clientConfig = await new AwsConfigHelper(profile).getClientConfig();
  await deployIntegration.loginTo4me(clientConfig, domain, account);

  const lambdaProduct = await deployIntegration.findLambdaProduct();

  const {lambdaUrl, lambdaArn, s3Bucket} = await deployIntegration.deployLambda(clientConfig, profile, domain, account);

  // make sure S3 bucket CI is present in 4me
  await deployIntegration.findS3BucketConfigurationItem(s3Bucket);

  const serviceInstance = await deployIntegration.findServiceInstance(serviceInstanceName);

  const location = `Amazon ${clientConfig.region}`;
  await deployIntegration.syncConfigurationItem('typeform_lambda_ci',
                                                 {
                                                   productId: lambdaProduct.id,
                                                   serviceId: serviceInstance.service.id,
                                                   serviceInstanceIds: [serviceInstance.id],
                                                   location: location,
                                                   systemID: lambdaArn,
                                                   customFields: [
                                                     {
                                                       id: 'cloudformation_stack',
                                                       value: stackName,
                                                     },
                                                     {
                                                       id: 'api_url',
                                                       value: lambdaUrl,
                                                     },
                                                   ],
                                                 });

  const integration = await deployIntegration.createIntegration(serviceInstance);
  await deployIntegration.createIntegrationAutomationRules(integration);
  await deployIntegration.createUiExtension(integration);

  console.log(`Success. Integration is available at: https://${account}.${domain}/integrations/${integration.id}`);
})();
