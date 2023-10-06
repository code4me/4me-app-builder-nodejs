'use strict';

const LoggedError = require('../../../library/helpers/errors/logged_error');

class OsCiMutationHelper {
  constructor(referenceHelper, customer4meHelper) {
    this.customer4meHelper = customer4meHelper;
    this.referenceHelper = referenceHelper;
  }

  async processOSUpdates(allOperatingSystems) {
    console.log('Encountered operating systems: %j', allOperatingSystems);
    const ciIds = new Map();
    for (const operatingSystem of allOperatingSystems) {
      const ciId = this.referenceHelper.softwareFound.get(operatingSystem);
      if (ciId) {
        ciIds.set(operatingSystem, ciId);
      }
    }
    console.log(`Operating systems known in 4me: ${ciIds.size} / ${allOperatingSystems.length}`);

    return await this.storeEndOfSupportDates(this.referenceHelper.osEndOfSupports, ciIds);
  }

  async storeEndOfSupportDates(osEndOfSupports, ciIds) {
    if (osEndOfSupports.size === 0) {
      return {};
    }
    console.log('End of support dates: %j', osEndOfSupports);
    const cisToUpdate = [];
    for (const osCaption of osEndOfSupports.keys()) {
      const ciId = ciIds.get(osCaption);
      if (ciId) {
        const endOfSupportDate = osEndOfSupports.get(osCaption);
        cisToUpdate.push({id: ciId, endOfSupportDate: endOfSupportDate});
      }
    }
    if (cisToUpdate.length === 0) {
      return {};
    }
    return await this.updateOSCis(cisToUpdate);
  }

  async updateOSCis(cisToUpdate) {
    console.log(`Will update ${cisToUpdate.length} operating systems to set end of support`);
    const query = OsCiMutationHelper.graphQL4meOsMutation('id');
    const accessToken = await this.customer4meHelper.getToken();
    const cisUpdated = [];
    const cisErrored = [];
    for (const ciToUpdate of cisToUpdate) {
      const id = ciToUpdate.id;
      try {
        const result = await this.customer4meHelper.executeGraphQLMutation(`end of support CI update for ${id}`,
                                                                           accessToken,
                                                                           query,
                                                                           {input: ciToUpdate});
        if (result.error) {
          console.error('Error updating end of support for %s:\n%j', id, result);
          cisErrored.push(id);
        } else {
          cisUpdated.push(id);
        }
      } catch (error) {
        console.error(`Error thrown updating OS CI: ${id}`);
        if (!(error instanceof LoggedError)) {
          console.info(error);
        }
        cisErrored.push(id);
      }
    }
    return {cisErrored: cisErrored, cisUpdated: cisUpdated};
  }
}
OsCiMutationHelper.graphQL4meOsMutation = (ciResponseFields) => {
  return `
      mutation($input: ConfigurationItemUpdateInput!) {
        configurationItemUpdate(input: $input) {
          errors { path message }
          configurationItem { ${ciResponseFields} }
        }
      }`;
}

module.exports = OsCiMutationHelper;
