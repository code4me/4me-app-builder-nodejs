'use strict';

const Js4meHelper = require('../../../helpers/js_4me_helper');
jest.mock('../../../helpers/js_4me_helper');

class LambdaContextMocker {
  constructor(customerAccount = null, customerSecrets = {}) {
    this.appName = process.env.PARAM_4ME_DOMAIN;

    this.customerAccount = customerAccount;
    this.customerSecrets = customerSecrets;

    this.providerAccount = process.env.PARAM_BOOTSTRAP_ACCOUNT;
    this.providerSecrets = {
      clientID: 'adda',
      token: '123',
    };
  }

  mockedGetSecrets = async (secretsAccountKey) => {
    if (secretsAccountKey === `instances/${this.customerAccount}`) {
      return this.customerSecrets;
    } else if (secretsAccountKey === this.providerAccount) {
      return this.providerSecrets;
    } else {
      throw new Error(`Unknown key: ${secretsAccountKey}`);
    }
  }

  checkCustomerAndProvider4meHelperCreated = () => {
    this.checkCustomer4meHelperCreated();
    this.checkProvider4meHelperCreated();
  }

  checkCustomer4meHelperCreated = () => {
    const policy = this.customerSecrets.policy || {};

    expect(Js4meHelper).toHaveBeenCalledWith(this.appName,
                                             this.customerAccount,
                                             this.customerSecrets.application.client_id,
                                             this.customerSecrets.application.client_secret,
                                             policy.algorithm, policy.public_key, policy.audience);
  }
  checkProvider4meHelperCreated = () => {
    const providerProfile = this.providerSecrets.policy || {};
    const providerJwtAlg = providerProfile.jwtAlg ? providerProfile.jwtAlg.toUpperCase() : null;

    expect(Js4meHelper).toHaveBeenCalledWith(this.appName,
                                             process.env.PARAM_BOOTSTRAP_ACCOUNT,
                                             this.providerSecrets.clientID,
                                             this.providerSecrets.token,
                                             providerJwtAlg, providerProfile.publicKeyPem, providerProfile.jwtAudience);
  }
}

module.exports = LambdaContextMocker;
