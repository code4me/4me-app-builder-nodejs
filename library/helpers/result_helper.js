'use strict';

class ResultHelper {
  cleanupResult(result) {
    const keys = Object.keys(result);
    for (const key of keys) {
      const keyValue = result[key];
      if (keyValue == null || (typeof keyValue === 'object' && (keyValue.length === 0 || Object.keys(keyValue).length === 0))) {
        delete result[key];
      }
    }
    return result;
  }
}

module.exports = ResultHelper;
