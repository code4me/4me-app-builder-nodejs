'use strict';

const { SecretsManagerClient, GetSecretValueCommand, CreateSecretCommand, PutSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const AppError = require('./errors/app_error');

class SecretsHelper {
  constructor(secretsClient, env4me, applicationName) {
    this.client = secretsClient || new SecretsManagerClient({ region: process.env.AWS_REGION }); // region based will work for lambda
    this.env4me = env4me;
    this.applicationName = applicationName;
  }

  // Call the AWS API and return a Promise
  async createAwsSecret(secretName, secretString) {
    const command = new CreateSecretCommand({ Name: secretName, SecretString: secretString });
    return await this.client.send(command);
  }
  async putAwsSecret(secretName, secretString) {
    const command = new PutSecretValueCommand({ SecretId: secretName, SecretString: secretString });
    return await this.client.send(command);
  }
  async getAwsSecret(secretName) {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    return await this.client.send(command);
  }

  async upsertSecret(account, secrets) {
    const secretName = this.getSecretName(account);
    try {
      const data = await this.getAwsSecret(secretName);
      console.log(`Updating existing secret: ${secretName}`);
      const value = data.SecretString;
      return await this.updateSecrets(account, secrets);
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        console.log(`Creating new secret: ${secretName}`);
        return await this.createSecrets(account, secrets);
      }
      throw new AppError(error);
    }
  }

  async getSecrets(account) {
    const secretName = this.getSecretName(account);
    try {
      const data = await this.getAwsSecret(secretName);
      const value = data.SecretString;
      return JSON.parse(value);
    } catch (error) {
      console.error(`Unable to get secrets for ${account}: ${error.code}; ${error.message}`);
      return null;
    }
  };

  async createSecrets(account, secrets) {
    const secretName = this.getSecretName(account);
    try {
      const secretString = JSON.stringify(secrets);
      const data = await this.createAwsSecret(secretName, secretString);
      if (!data.ARN) {
        throw new AppError('No ARN returned.');
      }
      return { ...data, secrets: secrets };
    } catch (error) {
      throw new AppError(`Unable to create secret for ${account}: ${error.code}; ${error.message}`);
    }
  };

  async updateSecrets(account, secrets) {
    const currentSecrets = await this.getSecrets(account);
    try {
      if (!currentSecrets) {
        throw new Error('Unable to obtain current secrets.');
      }
      const secretName = this.getSecretName(account);
      // merge secrets
      const newSecrets = Object.assign({}, currentSecrets, secrets);
      // remove null properties
      Object.keys(newSecrets)
        .forEach(key => newSecrets[key] == null && delete newSecrets[key]);

      const secretString = JSON.stringify(newSecrets);
      const data = await this.putAwsSecret(secretName, secretString);
      if (!data.ARN) {
        throw new Error('No ARN returned.');
      }
      return { ...data, secrets: newSecrets };
    } catch (error) {
      throw new AppError(`Unable to update secrets for ${account}: ${error.code}; ${error.message}`);
    }
  };

  getSecretName(account) {
    return `${this.applicationName}/${this.env4me}/${account}`;
  }
}

module.exports = SecretsHelper;