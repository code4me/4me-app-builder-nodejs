'use strict';

class InstanceHelper {

  async retrieveInstance(js4meHelper, accessToken, reference, customerAccount) {
    const instance = await this.queryInstanceCustomFields(js4meHelper, accessToken, reference, customerAccount);
    if (instance.error) {
      return instance;
    } else {
      const result = {instanceId: instance.id, suspended: instance.suspended};

      const customFields = instance.customFields;
      const formUrlField = customFields.find(i => i.id === 'form_url');
      if (formUrlField) {
        result.formUrl = formUrlField.value;
      }
      const requestIdField = customFields.find(i => i.id === 'request_id');
      if (requestIdField) {
        result.requestId = requestIdField.value;
      }
      return result;
    }
  }

  async suspendInstance(js4meHelper, accessToken, description, instanceId, suspensionComment) {
    const instanceInput = {
      id: instanceId,
      suspended: true,
      suspensionComment: suspensionComment,
    }
    try {
      const instance = await this.updateIntegrationInstance(js4meHelper, accessToken, instanceInput);
      if (instance.error) {
        console.error('Unable to suspend %s:\n%j',
                      description, instance.error);
      } else {
        console.info('Suspended %s', description);
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
      const instance = await this.updateIntegrationInstance(js4meHelper, accessToken, instanceInput);
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
    const result = await js4meHelper.getGraphQLQuery('get instance details',
                                                     accessToken, `
      query($reference: String, $customerAccount: String!) {
        integrationInstances(first: 1, filter: { 
                                          customerAccount: { values: [$customerAccount] },
                                          integrationReference: { values: [$reference] } } ) {
          nodes {
            id
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
      this.error('%j', result);
      return result;
    } else {
      const nodes = result.integrationInstances.nodes;
      if (!nodes || nodes.length === 0) {
        return {error: `No instances of ${reference} for ${customerAccount}`};
      }
      return nodes[0];
    }
  }

  async updateIntegrationInstance(js4meHelper, accessToken, instanceInput) {
    const result = await js4meHelper.executeGraphQLMutation('Update integration instance',
                                                            accessToken, `
      mutation($input: IntegrationInstanceUpdateInput!) {
        integrationInstanceUpdate(input: $input) {
          errors { path  message }
          integrationInstance { id }
        }
      }`,
                                                            {
                                                              input: instanceInput,
                                                            });
    if (result.error) {
      console.error('Unable to update integration instance: %j', result.error);
      return result;
    }
    return result.integrationInstance;
  }

}

module.exports = InstanceHelper;