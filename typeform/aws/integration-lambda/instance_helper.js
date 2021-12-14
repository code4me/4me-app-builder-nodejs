'use strict';

const InstanceHelperBase = require('../../../library/helpers/instance_helper_base');

class InstanceHelper extends InstanceHelperBase {
  customFieldsProcessor(result, customFields) {
    const formUrlField = customFields.find(i => i.id === 'form_url');
    if (formUrlField) {
      result.formUrl = formUrlField.value;
    }
    const requestIdField = customFields.find(i => i.id === 'request_id');
    if (requestIdField) {
      result.requestId = requestIdField.value;
    }
  }
}

module.exports = InstanceHelper;