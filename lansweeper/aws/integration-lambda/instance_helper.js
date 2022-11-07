'use strict';

const InstanceHelperBase = require('../../../library/helpers/instance_helper_base');
const TimeHelper = require('../../../library/helpers/time_helper');
const LoggedError = require('../../../library/helpers/errors/logged_error');

class InstanceHelper extends InstanceHelperBase {
  constructor() {
    super();
    this.timeHelper = new TimeHelper();
  }

  customFieldsProcessor(result, customFields) {
    const clientIdField = customFields.find(i => i.id === 'client_id');
    if (clientIdField) {
      result.clientID = clientIdField.value;
    }
    const callbackUrlField = customFields.find(i => i.id === 'callback_url');
    if (callbackUrlField) {
      result.callbackURL = callbackUrlField.value;
    }
    const connectionStatusField = customFields.find(i => i.id === 'connection_status');
    if (connectionStatusField) {
      result.connectionStatus = connectionStatusField.value;
    }
    const lastSyncStartField = customFields.find(i => i.id === 'sync_start_at');
    if (lastSyncStartField) {
      result.lastSyncStart = lastSyncStartField.value;
    }
    const importTypeField = customFields.find(i => i.id === 'import_type');
    if (importTypeField) {
      result.importType = importTypeField.value;
    }
    const assetTypesField = customFields.find(i => i.id === 'asset_types');
    if (assetTypesField) {
      result.selectedAssetTypes = this.splitMultiValueField(assetTypesField.value);
    }
    const installationHandlingField = customFields.find(i => i.id === 'installation_handling');
    if (installationHandlingField) {
      result.installationHandling = installationHandlingField.value;
    }
    result.installationHandling = result.installationHandling || 'all';
    const installationsField = customFields.find(i => i.id === 'installations');
    if (installationsField) {
      result.installationNames = this.splitMultiValueField(installationsField.value);
    }
    result.installationNames = result.installationNames || [];
    const labelGeneratorField = customFields.find(i => i.id === 'label_generator');
    if (labelGeneratorField) {
      result.labelGenerator = labelGeneratorField.value;
    }
  }

  async retrieveAccountsLastSyncedBefore(provider4meHelper, reference, endDate) {
    const filterValue = `<${this.timeHelper.formatDateTime(endDate)}`
    const query = `
      query($reference: String, $value: String!) {
        appInstances(first: 100,
                 filter: {customFilters: [{name: "Start", values: [$value]}],
                          appOfferingReference: { values: [$reference] },
                          disabled: false, suspended: false, enabledByCustomer: true
                 }
        ) { nodes { id customerAccount { id } } }
      }`;

    const accessToken = await provider4meHelper.getToken();
    const result = await provider4meHelper.getGraphQLQuery('find instances to sync',
                                                           accessToken,
                                                           query,
                                                           {reference: reference, value: filterValue});
    if (result.error) {
      console.error('Error retrieving instances to sync:\n%j', result);
      throw new LoggedError('Unable to query 4me');
    } else {
      return result.appInstances.nodes.map(node => node.customerAccount.id);
    }
  }

  splitMultiValueField(value) {
    return (value || '')
      .split(/^\s*\*\s+/m)
      .map(i => i.trim())
      .filter(i => !!i);
  }
}

module.exports = InstanceHelper;