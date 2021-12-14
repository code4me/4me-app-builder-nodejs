'use strict';

const Js4meHelper = require('./js_4me_helper');
const SecretsHelper = require('./secrets_helper');

class Lambda4meContextHelper {
  constructor(options) {
    this.applicationName = options.applicationName;
    this.providerAccount = options.providerAccount;
    this.env4me = options.env4me;
    this.offeringReference = options.offeringReference;
  }

  async assemble(customerAccount) {
    const customerContext = await this.getCustomerContext(customerAccount);
    const providerContext = await this.getProviderContext();
    return this.createContext(providerContext, customerContext);
  }

  async assembleCustomerOnly(customerAccount) {
    const customerContext = await this.getCustomerContext(customerAccount);
    return this.createContext(null, customerContext);
  }

  async assembleProviderOnly() {
    const providerContext = await this.getProviderContext();
    return this.createContext(providerContext, null);
  }

  createContext(providerContext, customerContext) {
    const context = {
      env4me: this.env4me,
      applicationName: this.applicationName,
      offeringReference: this.offeringReference,
    };
    if (providerContext) {
      context.providerContext = providerContext;
    }
    if (customerContext) {
      context.customerContext = customerContext;
    }
    return context;
  }

  async getCustomerContext(customerAccount) {
    const secretsApplicationName = `${this.applicationName}/${this.offeringReference}`;
    const secretsAccountKey = `instances/${customerAccount}`;

    const secretsHelper = new SecretsHelper(null, this.env4me, secretsApplicationName);
    const secrets = await secretsHelper.getSecrets(secretsAccountKey);

    if (!secrets) {
      console.error('No secrets found for %j - %j', secretsApplicationName, secretsAccountKey);
      return null;
    }
    if (!secrets.application && !secrets.policy) {
      console.error('No credentials to access 4me, or policy, for %j - %j. Found only: %j',
                   secretsApplicationName, secretsAccountKey, secrets);
      return null;
    }

    if (!secrets.application) {
      console.info('No credentials to access 4me for %j - %j.',
                    secretsApplicationName, secretsAccountKey);
      secrets.application = {};
    }
    const secretClientID = secrets.application.client_id;
    const secretToken = secrets.application.client_secret;

    if (!secrets.policy) {
      console.debug('No policy to verify requests from 4me for %j - %j.',
                   secretsApplicationName, secretsAccountKey);
      secrets.policy = {};
    }
    const policy = secrets.policy;
    const jwtAlg = policy.algorithm;
    const jwtPublicKey = policy.public_key;
    const jwtAudience = policy.audience;

    const js4meHelper = new Js4meHelper(this.env4me, customerAccount,
                                        secretClientID, secretToken,
                                        jwtAlg, jwtPublicKey, jwtAudience);

    return {
      account: customerAccount,
      secretsHelper: secretsHelper,
      secretsAccountKey: secretsAccountKey,
      secrets: secrets,
      js4meHelper: js4meHelper,
    };
  }

  async getProviderContext() {
    const secretsHelper = new SecretsHelper(null, this.env4me, this.applicationName);
    const secrets = await secretsHelper.getSecrets(this.providerAccount);
    if (!secrets) {
      console.error('No Provider secrets found for %j - %j', this.applicationName, this.providerAccount);
      return null;
    }
    if (!secrets.policy && (!secrets.clientID || !secrets.token)) {
      console.error('No credentials to access 4me, or policy, for %j - %j. Found only: %j',
                    this.applicationName, this.providerAccount, secrets);
      return null;
    }
    if (!secrets.clientID || !secrets.token) {
      console.info('No credentials to access 4me for %j - %j.',
                   this.applicationName, this.providerAccount);
    }

    if (!secrets.policy) {
      console.debug('No policy to verify requests from 4me for %j - %j.',
                   this.applicationName, this.providerAccount);
      secrets.policy = {};
    }
    const policy = secrets.policy;
    const jwtAlg = policy.jwtAlg ? policy.jwtAlg.toUpperCase() : null;
    const jwtPublicKey = policy.publicKeyPem;
    const jwtAudience = policy.jwtAudience;

    const js4meHelper = new Js4meHelper(this.env4me, this.providerAccount,
                                        secrets.clientID, secrets.token,
                                        jwtAlg, jwtPublicKey, jwtAudience);

    return {
      account: this.providerAccount,
      secretsHelper: secretsHelper,
      secretsAccountKey: this.providerAccount,
      secrets: secrets,
      js4meHelper: js4meHelper,
    };
  }
}
module.exports = Lambda4meContextHelper;