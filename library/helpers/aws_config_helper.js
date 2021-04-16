'use strict';

const { fromIni, parseKnownFiles } = require("@aws-sdk/credential-provider-ini");
const { STS } = require("@aws-sdk/client-sts");
const promptly = require('promptly');

class AwsConfigHelper {
  constructor(awsProfile, mfaCode = null) {
    this.mfaCode = mfaCode;
    this.fromIniInit = { profile: awsProfile, roleAssumer: this.assume.bind(this), mfaCodeProvider: this.mfa.bind(this) };
  }

  async getRegion() {
    if (!this.region) {
      const profiles = await parseKnownFiles({});
      this.region = profiles[this.fromIniInit.profile].region;
    }
    return this.region;
  }

  async getClientConfig() {
    const region = await this.getRegion();
    return { credentials: fromIni(this.fromIniInit), region: region };
  }

  async mfa(serialID) {
    if (!this.mfaCode) {
      this.mfaCode = await promptly.prompt(`Please supply your MFA code (${serialID}): `);
    }
    return this.mfaCode;
  }

  // assume a role using the sourceCreds
  async assume(sourceCreds, params) {
    if (!this.credentials) {
      const region = await this.getRegion();
      const sts = new STS({ credentials: sourceCreds, region: region });
      const result = await sts.assumeRole(params);
      if (!result.Credentials) {
        throw new Error("unable to assume credentials - empty credential object");
      }
      this.credentials = {
        accessKeyId: result.Credentials.AccessKeyId,
        secretAccessKey: result.Credentials.SecretAccessKey,
        sessionToken: result.Credentials.SessionToken
      };
    }
    return this.credentials;
  }
}

module.exports = AwsConfigHelper;