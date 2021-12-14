'use strict';

const TimeHelper = require('./time_helper');

class InstanceHelperBase {

  async retrieveInstanceWithRetry(js4meHelper, accessToken, reference, customerAccount) {
    let config = await this.retrieveInstance(js4meHelper, accessToken, reference, customerAccount);

    if (config.error) {
      const timeout = InstanceHelperBase.RETRY_WAIT;
      console.log('Unable to query instance. Too quick after app offering installation? Will retry in %sms.', timeout);
      await new TimeHelper().wait(timeout);
      config = await this.retrieveInstance(js4meHelper, accessToken, reference, customerAccount);
    }
    return config;
  }

  async retrieveInstance(js4meHelper, accessToken, reference, customerAccount) {
    const instance = await this.queryInstanceCustomFields(js4meHelper, accessToken, reference, customerAccount);
    if (instance.error) {
      return instance;
    } else {
      const result = {instanceId: instance.id, suspended: instance.suspended, appOfferingId: instance.appOffering.id};

      const customFields = instance.customFields;
      this.customFieldsProcessor(result, customFields);
      return result;
    }
  }

  customFieldsProcessor(result, customFields) {
    result.customFields = customFields;
  }

  async suspendInstance(js4meHelper, accessToken, description, instanceId, suspensionComment) {
    const instanceInput = {
      id: instanceId,
      suspended: true,
      suspensionComment: suspensionComment,
    }
    try {
      const instance = await this.updateAppInstance(js4meHelper, accessToken, instanceInput);
      if (instance.error) {
        console.error('Unable to suspend %s:\n%j',
                      description, instance.error);
      } else {
        return {instanceId: instance.id};
      }
    } catch (e) {
      console.error('Unable to suspend %s', description);
      console.info(e);
    }
    return {error: `Unable to suspend ${description}`};
  }

  async unsuspendInstance(js4meHelper, accessToken, description, instanceId) {
    const instanceInput = {
      id: instanceId,
      suspended: false,
    }
    try {
      const instance = await this.updateAppInstance(js4meHelper, accessToken, instanceInput);
      if (instance.error) {
        console.error('Unable to unsuspend %s:\n%j',
                      description, instance.error);
      } else {
        console.info('Unsuspended %s', description);
        return {instanceId: instance.id};
      }
    } catch (e) {
      console.error('Unable to unsuspend %s', description);
      console.info(e);
    }
    return {error: `Unable to unsuspend ${description}`};
  }

  async queryInstanceCustomFields(js4meHelper, accessToken, reference, customerAccount) {
    const result = await js4meHelper.getGraphQLQuery('get app instance details',
                                                     accessToken, `
      query($reference: String, $customerAccount: String!) {
        appInstances(first: 1, filter: { 
                                          customerAccount: { values: [$customerAccount] },
                                          appOfferingReference: { values: [$reference] } } ) {
          nodes {
            id
            appOffering { id }
            suspended
            customFields { id value }
          }
        }
      }`,
                                                     {
                                                       customerAccount: customerAccount,
                                                       reference: reference,
                                                     });
    if (result.error) {
      console.error('%j', result);
      return result;
    } else {
      const nodes = result.appInstances.nodes;
      if (!nodes || nodes.length === 0) {
        return {error: `No instances of ${reference} for ${customerAccount}`};
      }
      return nodes[0];
    }
  }

  async updateAppInstance(js4meHelper, accessToken, instanceInput) {
    const result = await js4meHelper.executeGraphQLMutation('Update app instance',
                                                            accessToken, `
      mutation($input: AppInstanceUpdateInput!) {
        appInstanceUpdate(input: $input) {
          errors { path  message }
          appInstance { id }
        }
      }`,
                                                            {
                                                              input: instanceInput,
                                                            });
    if (result.error) {
      console.error('Unable to update app instance: %j', result.error);
      return result;
    }
    return result.appInstance;
  }
}

InstanceHelperBase.RETRY_WAIT = parseInt(process.env.INSTANCE_RETRY_TIMEOUT, 10) || 2000;

module.exports = InstanceHelperBase;