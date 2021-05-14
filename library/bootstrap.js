'use strict';

const promptly = require('promptly');
const AwsConfigHelper = require("./helpers/aws_config_helper");
const {SecretsManagerClient} = require("@aws-sdk/client-secrets-manager");
const SecretsHelper = require('./helpers/secrets_helper');
const Js4meHelper = require('./helpers/js_4me_helper');
const Js4meDeployHelper = require('./helpers/js_4me_deploy_helper');
const ConfigFileHelper = require('./helpers/config_file_helper');
const path = require('path')

const stackName = 'app-builder-engine';
const secretsPolicyAlg = 'es512';

class Bootstrap {
  constructor() {
    this.configFileHelper = new ConfigFileHelper(__dirname, 'config_4me');
    this.js4meDeployHelper = new Js4meDeployHelper();
    this.secretApplicationName = this.js4meDeployHelper.secretApplicationName;
    this.source = this.js4meDeployHelper.bootstrapSource;
  }

  async gatherInput() {
    const domain = await promptly.prompt('Which 4me domain: ', {default: '4me-demo.com'});
    const account = await promptly.prompt('Which 4me account: ', {default: 'wdc'});
    const serviceInstanceName = await promptly.prompt('Which service instance (for integration engine): ',
                                                      {default: 'Mainframe 1'});

    const clientID = await promptly.prompt('Your client ID: ');
    const token = await promptly.password('Your application token: ',
                                          {
                                            replace: '*',
                                            default: undefined,
                                          });
    return {
      domain: domain,
      account: account,
      clientID: clientID,
      token: token,
      serviceInstanceName: serviceInstanceName
    };
  }

  async upsertSecrets(secretsClient, domain, account, secrets) {
    const secretsHelper = new SecretsHelper(secretsClient, domain, this.secretApplicationName);
    return await secretsHelper.upsertSecret(account, secrets);
  }

  async deployLambda(clientConfig, profile, domain, account) {
    const samPath = path.resolve(__dirname, 'aws');
    const parameterOverrides = [
      `4MeDomainParameter=${domain}`,
      `BootstrapSecretApplicationParameter=${this.secretApplicationName}`,
      `BootstrapSecretAccountParameter=${account}`,
    ];
    return await this.js4meDeployHelper.deployLambda(clientConfig,
                                                     profile,
                                                     samPath,
                                                     stackName,
                                                     parameterOverrides);
  }

  async getAccessToken(domain, account, clientID, token) {
    if (!this.accessToken) {
      const js4meHelper = this.get4meHelper(domain, account, clientID, token);
      this.accessToken = await js4meHelper.getToken();
    }
    return this.accessToken;
  }

  get4meHelper(domain, account, clientID, token) {
    if (!this.js4meHelper) {
      this.js4meHelper = new Js4meHelper(domain, account, clientID, token);
    }
    return this.js4meHelper;
  }

  async syncUiExtension(filename, extraProps) {
    const uiExtensionInput = this.configFileHelper.readUiExtensionFromFiles(filename);
    const {input, filter} = this.js4meDeployHelper.upsertOnSourceIDData(uiExtensionInput, this.source, filename, extraProps);
    const uiExtension = await this.js4meDeployHelper
      .syncUiExtension(this.js4meHelper,
                       this.accessToken,
                       filter,
                       input);

    if (uiExtension.error) {
      process.exit(6);
    }

    return uiExtension;
  }

  async syncProduct(filename, extraProps) {
    const {input, filter} = this.readUpsertData(filename, extraProps);
    const product = this.js4meDeployHelper.syncProduct(this.js4meHelper,
                                                       this.accessToken,
                                                       filter,
                                                       input);
    if (product.error) {
      process.exit(7);
    }

    return product;
  }

  async syncConfigurationItem(filename, extraProps) {
    const {input, filter} = this.readUpsertData(filename, extraProps);
    const ci = this.js4meDeployHelper.syncConfigurationItem(this.js4meHelper,
                                                            this.accessToken,
                                                            filter,
                                                            input);
    if (ci.error) {
      process.exit(8);
    }

    return ci;
  }

  readUpsertData(filename, extraProps) {
    const input = this.configFileHelper.readConfigJsonFile(`${filename}.json`);
    return this.js4meDeployHelper.upsertOnSourceIDData(input, this.source, filename, extraProps);
  }

  async findServiceInstance(serviceInstanceName) {
    const serviceInstanceFilter = {name: {values: [serviceInstanceName]}};
    return await this.js4meDeployHelper.findServiceInstance(this.js4meHelper,
                                                            this.accessToken,
                                                            serviceInstanceFilter,
                                                            'id service { id } supportTeam { id }');
  }

  async findWebhookPolicy(id) {
    const result = await this.js4meHelper.getGraphQLQuery('Webhook policy', this.accessToken,
                                                          `query($id: ID!) {
                node(id: $id) {
                    ... on WebhookPolicy {
                        id
                        name
                        jwtAlg
                    }
                }
            }`,
                                                          {id: id});
    if (result.error) {
      console.error('%j', result);
      return result;
    } else {
      return result.node;
    }
  }

  async createWebhookPolicy(domain, account) {
    const result = await this.js4meHelper.executeGraphQLMutation('Create policy', this.accessToken,
                                                                 `mutation($algorihtm: WebhookPolicyJwtAlg!, $audience: String) {
            webhookPolicyCreate(input: { jwtAlg: $algorihtm, jwtAudience: $audience }) {
                errors {
                    path
                    message
                }
                webhookPolicy {
                    id
                    name
                    jwtAlg
                    jwtAudience
                    publicKeyPem
                }
            }
        }`,
                                                                 {
                                                                   algorihtm: secretsPolicyAlg,
                                                                   audience: `integrations provided by ${account}@${domain}`,
                                                                 });
    if (result.error) {
      console.error('Unable to create policy: %j', result.error);
      throw new Error('Unable to create policy');
    }
    return result.webhookPolicy;
  }

  async findWebhook(id) {
    const result = await this.js4meHelper.getGraphQLQuery('Webhook', this.accessToken,
                                                          `query($id: ID!) {
                node(id: $id) {
                    ... on Webhook {
                        id
                        name
                        uri
                        webhookPolicy { id }
                    }
                }
            }`,
                                                          {id: id});
    if (result.error) {
      console.error('%j', result);
      return result;
    } else {
      return result.node;
    }
  }

  async createWebhook(uri, policyId) {
    const result = await this.js4meHelper
      .executeGraphQLMutation('Create webhook', this.accessToken, `
        mutation($uri: String!, $policyId: ID!) {
          webhookCreate(input: { event: "app_instance.secrets-update", uri: $uri, webhookPolicyId: $policyId }) {
            errors {
                path
                message
            }
            webhook {
                id
                name
                uri
            }
          }
        }`,
                              {
                                uri: uri,
                                policyId: policyId,
                              });
    if (result.error) {
      console.error('Unable to create webhook: %j', result.error);
      throw new Error('Unable to create webhook');
    }
    return result.webhook;
  }
}

(async () => {
  const bootstrap = new Bootstrap();
  const input = await bootstrap.gatherInput();
  const domain = input.domain;
  const account = input.account;
  var secrets = {...input};
  delete secrets.domain;
  delete secrets.account;
  delete secrets.serviceInstanceName;

  // Create a secrets manager client and use it to store user supplied values
  const profile = await promptly.prompt('Which AWS profile: ', {default: 'staging'});
  const clientConfig = await new AwsConfigHelper(profile).getClientConfig();
  const secretsClient = new SecretsManagerClient(clientConfig);

  // Store secrets provided by user in secrets manager
  const awsResponse = await bootstrap.upsertSecrets(secretsClient, domain, account, secrets);
  secrets = awsResponse.secrets;

  await bootstrap.getAccessToken(domain, account, input.clientID, input.token);

  const si = await bootstrap.findServiceInstance(input.serviceInstanceName);
  if (!si) {
    console.error(`No service instance found for: ${input.serviceInstanceName}`)
    process.exit(-1);
  } else if (si.error) {
    console.error('Error retrieving service instance: %j', si.error)
    process.exit(-2);
  }
  if (!si.supportTeam) {
    console.error(`No support team found for service instance: ${input.serviceInstanceName}. Please configure one`)
    process.exit(-3);
  }

  // Upsert products for AWS Lambda and S3
  const s3Product = await bootstrap.syncProduct('s3_product', {supportTeamId: si.supportTeam.id});
  if (s3Product.error) {
    process.exit(1);
  }

  const uiExtension = await bootstrap.syncUiExtension('lambda_ui_extension');
  if (uiExtension.error) {
    process.exit(2);
  }
  const lambdaProduct = await bootstrap.syncProduct('lambda_product',
                                                    {
                                                      uiExtensionId: uiExtension.id,
                                                      supportTeamId: si.supportTeam.id,
                                                    });
  if (lambdaProduct.error) {
    process.exit(3);
  }

  // Upsert webhook policy
  if (secrets.policy) {
    const policy = await bootstrap.findWebhookPolicy(secrets.policy.id);
    if (!policy || policy.error || policy.jwtAlg !== secretsPolicyAlg) {
      delete secrets.policy;
    }
  }

  if (secrets.policy) {
    console.log(`Found webhook policy: ${secrets.policy.name}`);
  } else {
    const policy = await bootstrap.createWebhookPolicy(domain, account);
    console.log(`Created webhook policy: ${policy.name}`);

    const awsResponse2 = await bootstrap.upsertSecrets(secretsClient, domain, account, {policy: policy});
    secrets = awsResponse2.secrets;
    console.log('Policy stored in secrets');
  }

  // Deploy secrets webhook lambda
  const stackOutputs = await bootstrap.deployLambda(clientConfig, profile, domain, account);
  const s3Bucket = stackOutputs['SourceBucket'];
  const lambdaUrl = stackOutputs['SecretsApi'];
  console.log(`Created lambda at: ${lambdaUrl}`)

  // Upsert S3 and lambda CIs
  const lambdaArn = stackOutputs['SecretsFunction'];
  const location = `Amazon ${clientConfig.region}`;
  const s3Ci = await bootstrap.syncConfigurationItem('s3_ci',
                                                     {
                                                       systemID: s3Bucket,
                                                       productId: s3Product.id,
                                                       serviceId: si.service.id,
                                                       location: location,
                                                     });
  if (s3Ci.error) {
    process.exit(5);
  }
  const lambdaCi = await bootstrap.syncConfigurationItem('secrets_lambda_ci',
                                                         {
                                                           productId: lambdaProduct.id,
                                                           serviceId: si.service.id,
                                                           serviceInstanceIds: [si.id],
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
  if (lambdaCi.error) {
    process.exit(6);
  }

  // Create secrets webhook
  if (secrets.webhook) {
    const webhook = await bootstrap.findWebhook(secrets.webhook.id);
    if (!webhook) {
      console.info(`Unable to find previously created webhook ${secrets.webhook.id}`);
      secrets.webhook = null;
    } else if (webhook.uri !== lambdaUrl) {
      console.error(`Incorrect URL in webhook: ${webhook.name}: ${webhook.uri}`);
      secrets.webhook = null;
    } else if (webhook.webhookPolicy.id !== secrets.policy.id) {
      console.error(`Incorrect policy in webhook: ${webhook.name}: ${webhook.webhookPolicy.id}`);
      secrets.webhook = null;
    }
  }
  if (secrets.webhook) {
    console.log(`Webhook up to date: ${secrets.webhook.name}`);
  } else {
    const webhook = await bootstrap.createWebhook(lambdaUrl, secrets.policy.id);
    console.log(`Created webhook: ${webhook.name}`);
    const awsResponse3 = await bootstrap.upsertSecrets(secretsClient, domain, account, {webhook: webhook});
    secrets = awsResponse3.secrets;
    console.log('Webhook stored in secrets');
  }
})();
