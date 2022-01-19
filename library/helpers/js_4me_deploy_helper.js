'use strict';

const {SecretsManagerClient} = require('@aws-sdk/client-secrets-manager');
const SecretsHelper = require('./secrets_helper');
const Js4meHelper = require('./js_4me_helper');
const AwsDeployHelper = require('./aws_deploy_helper');
const AppError = require('./errors/app_error');

class Js4meDeployHelper {
  constructor() {
    this.secretApplicationName = '4me-app-builder';
    this.bootstrapSource = '4me-app-bootstrap';

    this.mutationErrorResponseFields = 'errors { path  message }';

    this.defaultOfferingResponseFields = `
      appOffering {
        id
        reference
        uiExtensionVersion { id uiExtension { id } }
        automationRules(first: 100) {
          nodes { id name }
        }
      }`;
  }

  async logInto4meUsingAwsClientConfig(clientConfig, domain, account) {
    const secrets = await this.getSecrets(clientConfig, domain, account);
    return await this.logInto4me(domain, account, secrets.clientID, secrets.token);
  }

  async logInto4me(domain, account, clientID, token) {
    const js4meHelper = new Js4meHelper(domain, account, clientID, token);
    const accessToken = await js4meHelper.getToken();
    if (accessToken.length === 0) {
      this.deploymentFailed('Unable to login to 4me');
    }
    return {helper: js4meHelper, accessToken: accessToken}
  }

  async getSecrets(clientConfig, domain, account) {
    const secretsHelper = new SecretsHelper(this.getSecretsClient(clientConfig), domain, this.secretApplicationName);
    return await secretsHelper.getSecrets(account);
  }

  async addSecrets(clientConfig, domain, account, newSecrets) {
    const secretsHelper = new SecretsHelper(this.getSecretsClient(clientConfig), domain, this.secretApplicationName);
    return await secretsHelper.upsertSecret(account, newSecrets);
  }

  getSecretsClient(clientConfig) {
    if (!this.secretsClient) {
      this.secretsClient = new SecretsManagerClient(clientConfig);
    }
    return this.secretsClient;
  }

  async deployLambdaWithBootstrapSecrets(clientConfig,
                                         profile,
                                         samPath,
                                         stackName,
                                         domain,
                                         account,
                                         offeringReference) {
    const parameterOverrides = [
      `4MeDomainParameter=${domain}`,
      `BootstrapSecretApplicationParameter=${this.secretApplicationName}`,
      `BootstrapSecretAccountParameter=${account}`,
      `OfferingReferenceParameter=${offeringReference}`,
    ];
    const stackOutputs = await this.deployLambda(clientConfig, profile, samPath, stackName, parameterOverrides)

    const lambdaUrl = stackOutputs['IntegrationApi'];
    if (!lambdaUrl) {
      this.deploymentFailed('Failed to deploy lambda: %j', stackOutputs);
    }
    const lambdaArn = stackOutputs['IntegrationFunction'];
    console.log('Created lambda %j at: %j', lambdaArn, lambdaUrl);

    const s3Bucket = stackOutputs['SourceBucket'];
    console.log('Used S3 bucket %s for storage', s3Bucket);

    return {lambdaUrl: lambdaUrl, lambdaArn: lambdaArn, s3Bucket: s3Bucket, stacksOutput: stackOutputs};
  }

  async deployLambda(clientConfig, profile, samPath, stackName, parameterOverrides) {
    const deployHelper = new AwsDeployHelper(clientConfig, profile);
    const deployExitCode = await deployHelper.deploy(samPath, stackName, parameterOverrides);
    if (deployExitCode === 0) {
      const deployedStackOutputs = await deployHelper.getStackOutputs(stackName);
      deployedStackOutputs['SourceBucket'] = await deployHelper.getDefaultSamCliBucket();
      return deployedStackOutputs;
    } else {
      return null;
    }
  }

  async findServiceInstance(js4meHelper, accessToken, filter, responseFields = 'id service { id }') {
    const result = await js4meHelper.getGraphQLQuery('Service Instance',
                                                     accessToken, `
       query($filter: ServiceInstanceFilter) {
         serviceInstances(first: 1, filter: $filter ) {
           nodes { ${responseFields} }
         }
       }`,
                                                     {
                                                       filter: filter,
                                                     });
    if (result.error) {
      this.deploymentFailed('Failed to find service instance with filter %j: %j', filter, result.error);
    }

    const nodes = result.serviceInstances.nodes;
    if (!nodes || nodes.length === 0) {
      this.deploymentFailed('No service instance found for filter: %j}', filter);
    }
    return nodes[0];
  }

  async findOffering(js4meHelper, accessToken, reference) {
    const result = await js4meHelper.getGraphQLQuery('App Offering',
                                                     accessToken, `
       query($reference: String) {
         appOfferings(first: 1, filter: { published: false, reference: { values: [$reference] } } ) {
           nodes {
             id
             name
             scopes { id actions }
           }
         }
       }`,
                                                     {
                                                       reference: reference,
                                                     });
    if (result.error) {
      console.error('%j', result);
      return result;
    } else {
      const nodes = result.appOfferings.nodes;
      if (!nodes || nodes.length === 0) {
        return null;
      }
      return nodes[0];
    }
  }

  async createOffering(js4meHelper, accessToken, offeringInput, offeringMutationResponseFields) {
    const result = await js4meHelper.executeGraphQLMutation('Create app offering',
                                                            accessToken, `
      mutation($input: AppOfferingCreateInput!) {
        appOfferingCreate(input: $input) {
          ${this.mutationErrorResponseFields}
          ${offeringMutationResponseFields}
        }
      }`,
                                                            {
                                                              input: offeringInput,
                                                            });
    if (result.error) {
      console.error('Unable to create app offering: %j', result.error);
      return result;
    }
    return result.appOffering;
  }

  async updateOffering(js4meHelper, accessToken, offeringInput, offeringMutationResponseFields) {
    const result = await js4meHelper.executeGraphQLMutation('Update app offering',
                                                            accessToken, `
      mutation($input: AppOfferingUpdateInput!) {
        appOfferingUpdate(input: $input) {
          ${this.mutationErrorResponseFields}
          ${offeringMutationResponseFields}
        }
      }`,
                                                            {
                                                              input: offeringInput,
                                                            });
    if (result.error) {
      console.error('Unable to update app offering: %j', result.error);
      return result;
    }
    return result.appOffering;
  }

  async upsertOffering(js4meHelper,
                       accessToken,
                       offeringInput,
                       offeringMutationResponseFields = this.defaultOfferingResponseFields) {
    let offering = await this.findOffering(js4meHelper, accessToken, offeringInput.reference);
    if (!offering) {
      offering = await this.createOffering(js4meHelper,
                                           accessToken,
                                           offeringInput,
                                           offeringMutationResponseFields);
    } else if (offering && !offering.error) {
      const updateInput = {...offeringInput, id: offering.id};

      const currentScopes = offering.scopes || [];
      for (let i = 0; i < currentScopes.length; i++) {
        if (i < updateInput.newScopes.length) {
          updateInput.newScopes[i].id = currentScopes[i].id;
        } else {
          if (!updateInput.scopesToDelete) {
            updateInput.scopesToDelete = [];
          }
          updateInput.scopesToDelete.push(currentScopes[i].id);
        }
      }

      offering = await this.updateOffering(js4meHelper,
                                           accessToken,
                                           updateInput,
                                           offeringMutationResponseFields);
    }

    if (offering.error) {
      this.deploymentFailed('Failed to upsert app offering: %j', offering.error)
    }
    if (!offering.id) {
      this.deploymentFailed('No app offering created!');
    }

    return offering;
  }

  async createOfferingAutomationRule(js4meHelper,
                                     accessToken,
                                     offeringRuleInput,
                                     offeringAutomationRuleMutationResponseFields) {
    const result = await js4meHelper.executeGraphQLMutation('Create app offering automation rule',
                                                            accessToken, `
      mutation($input: AppOfferingAutomationRuleCreateInput!) {
        appOfferingAutomationRuleCreate(input: $input) {
          ${this.mutationErrorResponseFields}
          ${offeringAutomationRuleMutationResponseFields}
        }
      }`,
                                                            {
                                                              input: offeringRuleInput,
                                                            });
    if (result.error) {
      console.error('Unable to create app offering automation rule: %j', result.error);
      return result;
    }
    return result.appOfferingAutomationRule;
  }

  async updateOfferingAutomationRule(js4meHelper,
                                     accessToken,
                                     offeringRuleInput,
                                     offeringAutomationRuleMutationResponseFields) {
    const result = await js4meHelper.executeGraphQLMutation('Update app offering automation rule',
                                                            accessToken, `
      mutation($input: AppOfferingAutomationRuleUpdateInput!) {
        appOfferingAutomationRuleUpdate(input: $input) {
          ${this.mutationErrorResponseFields}
          ${offeringAutomationRuleMutationResponseFields}
        }
      }`,
                                                            {
                                                              input: offeringRuleInput,
                                                            });
    if (result.error) {
      console.error('Unable to update app offering automation rule: %j', result.error);
      return result;
    }
    return result.appOfferingAutomationRule;
  }

  async upsertOfferingAutomationRule(js4meHelper,
                                     accessToken,
                                     ruleId,
                                     offeringRuleInput,
                                     offeringAutomationRuleMutationResponseFields) {
    let rule;
    if (!ruleId) {
      rule = await this.createOfferingAutomationRule(js4meHelper,
                                                     accessToken,
                                                     offeringRuleInput,
                                                     offeringAutomationRuleMutationResponseFields);
    } else {
      const updateInput = {...offeringRuleInput, id: ruleId};
      delete updateInput.appOfferingId;
      rule = await this.updateOfferingAutomationRule(js4meHelper,
                                                     accessToken,
                                                     updateInput,
                                                     offeringAutomationRuleMutationResponseFields);
    }
    return rule;
  }

  async deleteOfferingAutomationRule(js4meHelper, accessToken, ruleId) {
    return await js4meHelper.deleteRecord(accessToken, 'app_offering_automation_rules', ruleId);
  }

  async syncOfferingAutomationRules(js4meHelper,
                                    accessToken,
                                    existingRules,
                                    offeringRuleInputs,
                                    offeringAutomationRuleMutationResponseFields = 'appOfferingAutomationRule { id name }') {
    const results = [];
    const currentRules = existingRules || [];
    for (let i = 0; i < currentRules.length; i++) {
      const ruleId = currentRules[i].id;
      if (i < offeringRuleInputs.length) {
        const newRule = offeringRuleInputs[i];
        const upsertResult = await this.upsertOfferingAutomationRule(js4meHelper,
                                                                     accessToken,
                                                                     ruleId,
                                                                     newRule,
                                                                     offeringAutomationRuleMutationResponseFields);
        if (upsertResult.error) {
          this.deploymentFailed('Unable to sync rule %j: %j', i, upsertResult.error);
        } else {
          results.push(upsertResult);
        }
      } else {
        const deleteResult = await this.deleteOfferingAutomationRule(js4meHelper, accessToken, ruleId);
        if (deleteResult.error) {
          this.deploymentFailed('Unable to delete rule %j: %j', i, deleteResult.error);
        }
      }
    }
    for (let i = currentRules.length; i < offeringRuleInputs.length; i++) {
      const newRule = offeringRuleInputs[i];
      const createResult = await this.createOfferingAutomationRule(js4meHelper,
                                                                   accessToken,
                                                                   newRule,
                                                                   offeringAutomationRuleMutationResponseFields);
      if (createResult.error) {
        this.deploymentFailed('Unable to create rule %j: %j', i, createResult.error);
      } else {
        results.push(createResult);
      }
    }
    return results;
  }

  upsertOnSourceIDData(input, source, sourceID, extraProps) {
    if (source.length > 30) {
      throw new AppError(`Source field cannot be longer than 30 characters. '${source}' is ${source.length} long.`);
    }
    if (sourceID.length > 128) {
      throw new AppError(`SourceID field cannot be longer than 128 characters. '${sourceID}' is ${sourceID.length} long.`);
    }
    if (extraProps) {
      input = {...input, ...extraProps};
    }
    input.source = source;
    input.sourceID = sourceID;

    const filter = {
      source: {values: [source]},
      sourceID: {values: [sourceID]},
    };
    return {input: input, filter: filter};
  }

  async findS3BucketConfigurationItem(s3Bucket, js4meHelper, accessToken) {
    const filter = {systemID: {values: [s3Bucket]}};
    const ci = await this.findConfigurationItem(js4meHelper, accessToken, filter);

    this.validateQueryResult(ci, 's3 configuration item');

    return ci;
  }

  async findDefaultLambdaProduct(js4meHelper, accessToken) {
    const filter = {
      source: {values: [this.bootstrapSource]},
      sourceID: {values: ['lambda_product']},
    };

    const product = await this.findProduct(js4meHelper, accessToken, filter);

    this.validateQueryResult(product, 'lambda product');

    return product;
  }

  async findDefaultSqsProduct(js4meHelper, accessToken) {
    const filter = {
      source: {values: [this.bootstrapSource]},
      sourceID: {values: ['sqs_product']},
    };

    const product = await this.findProduct(js4meHelper, accessToken, filter);

    this.validateQueryResult(product, 'sqs product');

    return product;
  }

  async findProduct(js4meHelper, accessToken, filter) {
    const result = await js4meHelper.getGraphQLQuery('Product',
                                                     accessToken, `
       query($filter: ProductFilter) {
         products(first: 1, filter: $filter ) {
           nodes { id }
         }
       }`,
                                                     {
                                                       filter: filter,
                                                     });
    if (result.error) {
      console.error('%j', result.error);
      return result;
    } else {
      const nodes = result.products.nodes;
      if (!nodes || nodes.length === 0) {
        return null;
      }
      return nodes[0];
    }
  }

  async createProduct(js4meHelper, accessToken, productInput, productMutationResponseFields) {
    const result = await js4meHelper.executeGraphQLMutation('Create product',
                                                            accessToken, `
      mutation($input: ProductCreateInput!) {
        productCreate(input: $input) {
          ${this.mutationErrorResponseFields}
          ${productMutationResponseFields}
        }
      }`,
                                                            {
                                                              input: productInput,
                                                            });
    if (result.error) {
      console.error('Unable to create product: %j', result.error);
      return result;
    }
    return result.product;
  }

  async updateProduct(js4meHelper, accessToken, productInput, productMutationResponseFields) {
    const result = await js4meHelper.executeGraphQLMutation('Update product',
                                                            accessToken, `
      mutation($input: ProductUpdateInput!) {
        productUpdate(input: $input) {
          ${this.mutationErrorResponseFields}
          ${productMutationResponseFields}
        }
      }`,
                                                            {
                                                              input: productInput,
                                                            });
    if (result.error) {
      console.error('Unable to update product: %j', result.error);
      return result;
    }
    return result.product;
  }

  async syncProduct(js4meHelper,
                    accessToken,
                    filter,
                    productInput,
                    productMutationResponseFields = 'product { id }') {
    let product = await this.findProduct(js4meHelper, accessToken, filter);

    if (!product) {
      product = await this.createProduct(js4meHelper,
                                         accessToken,
                                         productInput,
                                         productMutationResponseFields);
    } else if (product && !product.error) {
      const updateInput = {...productInput, id: product.id};
      product = await this.updateProduct(js4meHelper,
                                         accessToken,
                                         updateInput,
                                         productMutationResponseFields);
    }
    return product;
  }

  async findConfigurationItem(js4meHelper, accessToken, filter) {
    const result = await js4meHelper.getGraphQLQuery('Configuration item',
                                                     accessToken, `
       query($filter: ConfigurationItemFilter) {
         configurationItems(first: 1, filter: $filter ) {
           nodes { id }
         }
       }`,
                                                     {
                                                       filter: filter,
                                                     });
    if (result.error) {
      console.error('%j', result);
      return result;
    } else {
      const nodes = result.configurationItems.nodes;
      if (!nodes || nodes.length === 0) {
        return null;
      }
      return nodes[0];
    }
  }

  async createConfigurationItem(js4meHelper, accessToken, ciInput, ciMutationResponseFields) {
    const result = await js4meHelper.executeGraphQLMutation('Create configuration item',
                                                            accessToken, `
      mutation($input: ConfigurationItemCreateInput!) {
        configurationItemCreate(input: $input) {
          ${this.mutationErrorResponseFields}
          ${ciMutationResponseFields}
        }
      }`,
                                                            {
                                                              input: ciInput,
                                                            });
    if (result.error) {
      console.error('Unable to create configuration item: %j', result.error);
      return result;
    }
    return result.configurationItem;
  }

  async updateConfigurationItem(js4meHelper, accessToken, ciInput, ciMutationResponseFields) {
    const result = await js4meHelper.executeGraphQLMutation('Update configuration item',
                                                            accessToken, `
      mutation($input: ConfigurationItemUpdateInput!) {
        configurationItemUpdate(input: $input) {
          ${this.mutationErrorResponseFields}
          ${ciMutationResponseFields}
        }
      }`,
                                                            {
                                                              input: ciInput,
                                                            });
    if (result.error) {
      console.error('Unable to update configuration item: %j', result.error);
      return result;
    }
    return result.configurationItem;
  }

  async syncConfigurationItem(js4meHelper,
                              accessToken,
                              filter,
                              ciInput,
                              ciMutationResponseFields = 'configurationItem { id }') {
    let ci = await this.findConfigurationItem(js4meHelper, accessToken, filter);

    if (!ci) {
      ci = await this.createConfigurationItem(js4meHelper,
                                              accessToken,
                                              ciInput,
                                              ciMutationResponseFields);
    } else if (ci && !ci.error) {
      const updateInput = {...ciInput, id: ci.id};
      ci = await this.updateConfigurationItem(js4meHelper,
                                              accessToken,
                                              updateInput,
                                              ciMutationResponseFields);
    }
    this.validateQueryResult(ci, 'configuration item');

    return ci;
  }

  async findUiExtension(js4meHelper, accessToken, filter) {
    const result = await js4meHelper.getGraphQLQuery('UI Extension',
                                                     accessToken, `
       query($filter: UiExtensionFilter) {
         uiExtensions(first: 1, filter: $filter ) {
           nodes { id }
         }
       }`,
                                                     {
                                                       filter: filter,
                                                     });
    if (result.error) {
      console.error('%j', result);
      return result;
    } else {
      const nodes = result.uiExtensions.nodes;
      if (!nodes || nodes.length === 0) {
        return null;
      }
      return nodes[0];
    }
  }

  async createUiExtensionVersion(js4meHelper, accessToken, uiExtensionInput, uiExtensionMutationResponseFields) {
    const result = await js4meHelper.executeGraphQLMutation('Create UI extension (version)', accessToken, `
      mutation($input: UiExtensionCreateInput!) {
        uiExtensionCreate(input: $input) {
          ${this.mutationErrorResponseFields}
          ${uiExtensionMutationResponseFields}
        }
      }`,
                                                            {
                                                              input: uiExtensionInput,
                                                            });
    if (result.error) {
      console.error('Unable to create UI extension (version): %j', result.error);
    }
    return result;
  }

  async updateUiExtensionVersion(js4meHelper, accessToken, uiExtensionInput, uiExtensionMutationResponseFields) {
    const result = await js4meHelper.executeGraphQLMutation('Update UI extension (version)', accessToken, `
      mutation($input: UiExtensionUpdateInput!) {
        uiExtensionUpdate(input: $input) {
          ${this.mutationErrorResponseFields}
          ${uiExtensionMutationResponseFields}
        }
      }`,
                                                            {
                                                              input: uiExtensionInput,
                                                            });
    if (result.error) {
      console.error('Unable to update UI extension (version): %j', result.error);
    }
    return result;
  }

  extractUiExtensionVersion(uiExtension) {
    if (!uiExtension || !uiExtension.id) {
      return {error: 'UI extension not available'};
    }
    const uiExtensionVersion = uiExtension.activeVersion;
    if (!uiExtensionVersion || !uiExtensionVersion.id) {
      console.error('No activeVersion in: %j', result);
      return {error: 'UI extension not activated'};
    }
    uiExtensionVersion.uiExtension = uiExtension;
    return uiExtensionVersion;
  }

  async upsertUiExtensionVersion(js4meHelper,
                                 accessToken,
                                 offering,
                                 uiExtensionInput,
                                 uiExtensionMutationResponseFields) {
    let uiExtension = null;
    if (offering.uiExtensionVersion) {
      uiExtension = offering.uiExtensionVersion.uiExtension;
    }
    const result = await this.upsertUiExtension(js4meHelper,
                                                accessToken,
                                                uiExtension,
                                                uiExtensionInput,
                                                uiExtensionMutationResponseFields);
    if (result.error) {
      return result;
    }
    return this.extractUiExtensionVersion(result);
  }

  async upsertUiExtension(js4meHelper, accessToken, uiExtension, uiExtensionInput,
                          uiExtensionMutationResponseFields) {
    let uiExtensionResult;
    if (uiExtension && uiExtension.id) {
      const updateInput = {...uiExtensionInput, id: uiExtension.id};
      uiExtensionResult = await this.updateUiExtensionVersion(js4meHelper,
                                                              accessToken,
                                                              updateInput,
                                                              uiExtensionMutationResponseFields);
    } else {
      uiExtensionResult = await this.createUiExtensionVersion(js4meHelper,
                                                              accessToken,
                                                              uiExtensionInput,
                                                              uiExtensionMutationResponseFields);
    }
    return uiExtensionResult.uiExtension;
  }

  async syncUiExtension(js4meHelper,
                        accessToken,
                        filter,
                        uiExtensionInput,
                        uiExtensionMutationResponseFields = 'uiExtension { id }') {
    const currentUiExtension = await this.findUiExtension(js4meHelper, accessToken, filter);
    if (currentUiExtension && currentUiExtension.error) {
      return currentUiExtension;
    }

    return await this.upsertUiExtension(js4meHelper,
                                        accessToken,
                                        currentUiExtension,
                                        uiExtensionInput,
                                        uiExtensionMutationResponseFields);
  }

  async syncUiExtensionVersion(js4meHelper,
                               accessToken,
                               offering,
                               uiExtensionInput,
                               uiExtensionMutationResponseFields = 'uiExtension { id name activeVersion { id } }') {
    const uiExtensionVersion = await this.upsertUiExtensionVersion(js4meHelper,
                                                                   accessToken,
                                                                   offering,
                                                                   uiExtensionInput,
                                                                   uiExtensionMutationResponseFields);

    this.validateQueryResult(uiExtensionVersion, 'UI Extension Version');

    if (!offering.uiExtensionVersion || offering.uiExtensionVersion.id !== uiExtensionVersion.id) {
      const offeringWithUiExtension = await this.updateOffering(js4meHelper, accessToken, {
                                                                  id: offering.id,
                                                                  uiExtensionVersionId: uiExtensionVersion.id,
                                                                },
                                                                'appOffering { id }');
      if (offeringWithUiExtension.error) {
        this.deploymentFailed('Failed to link UI Extension to app offering: %j', offeringWithUiExtension.error);
      }
    }

    return uiExtensionVersion;
  }

  validateQueryResult(queryResult, type) {
    if (!queryResult) {
      this.deploymentFailed('Missing %j', type);
    }
    if (queryResult.error) {
      this.deploymentFailed('Error querying %j: %j', type, queryResult.error);
    }
    if (!queryResult.id) {
      this.deploymentFailed('Missing %j: %j', type, queryResult);
    }
  }

  deploymentFailed(message, ...data) {
    if (data && data.length > 0) {
      console.error(message, ...data);
    } else {
      console.error(message);
    }
    process.exit(1);
  }
}

module.exports = Js4meDeployHelper;
