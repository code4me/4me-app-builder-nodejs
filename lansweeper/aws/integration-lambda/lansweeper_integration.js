'use strict';

const LansweeperClient = require('./lansweeper_client');
const DiscoveryMutationHelper = require('./discovery_mutation_helper');
const ReferenceHelper = require('./references_helper');
const TimeHelper = require('../../../library/helpers/time_helper');
const LoggedError = require('../../../library/helpers/errors/logged_error');
const Js4meAuthorizationError = require('../../../library/helpers/errors/js_4me_authorization_error');
const LansweeperGraphQLError = require('./errors/lansweeper_graphql_error');

class LansweeperIntegration {
  constructor(clientId, clientSecret, refreshToken, customer4meHelper) {
    this.lansweeperClient = new LansweeperClient(clientId, clientSecret, refreshToken);
    this.customer4meHelper = customer4meHelper;
    this.referenceHelper = new ReferenceHelper(customer4meHelper);
  }

  async validateCredentials() {
    const siteIds = await this.lansweeperClient.getSiteIds();
    console.info(`Validated lansweeper access. Can access sites: ${siteIds.length}`);
    const accessToken = await this.customer4meHelper.getToken();
    console.info('Validated 4me customer account access.');
    return true;
  }

  async processSites(networkedAssetsOnly) {
    let siteIds;
    try {
      siteIds = await this.lansweeperClient.getSiteIds();
    } catch (error) {
      if (error instanceof LansweeperGraphQLError) {
        return {error: error.message};
      }
      throw error;
    }

    const result = {};
    for (const siteId of siteIds) {
      const siteResult = await this.processSite(siteId, networkedAssetsOnly);
      const siteName = await this.lansweeperClient.getSiteName(siteId);
      result[siteName] = siteResult;
    }
    console.log(`User lookup: found ${this.referenceHelper.peopleFound.size} people (not found ${this.referenceHelper.peopleNotFound.length})`);
    return result;
  }

  async processSite(siteId, networkedAssetsOnly) {
    const siteName = await this.lansweeperClient.getSiteName(siteId);
    console.log(`processing site ${siteName}. NetworkedAssetsOnly: ${networkedAssetsOnly}`);
    const itemsHandler = async items => await this.sendAssetsTo4me(items, networkedAssetsOnly);
    const sendResults = await this.lansweeperClient.getAssetsPaged(siteId, itemsHandler, networkedAssetsOnly);
    const jsonResults = await this.downloadResults(sendResults.map(r => r.mutationResult));
    const overallResult = this.reduceResults(sendResults, jsonResults);

    return overallResult;
  }

  async sendAssetsTo4me(assets, networkedAssetsOnly = false) {
    const errors = [];
    const result = {errors: errors, uploadCount: 0};
    if (assets.length !== 0) {
      console.log(`found ${assets.length} assets`);
      let assetsToProcess = this.removeAssetsNotSeenRecently(assets);
      if (networkedAssetsOnly) {
        // Lansweeper bug: empty IP address is returned from API call for discovered monitors
        assetsToProcess = this.removeAssetsWithoutIP(assets);
      }
      if (assetsToProcess.length !== 0) {
        try {
          const referenceData = await this.referenceHelper.lookup4meReferences(assetsToProcess);
          const discoveryHelper = new DiscoveryMutationHelper(referenceData);
          const input = discoveryHelper.toDiscoveryUploadInput(assetsToProcess);
          const mutationResult = await this.uploadTo4me(input);

          if (mutationResult.error) {
            errors.push(mutationResult.error);
          } else if (mutationResult.errors) {
            errors.push(...this.mapErrors(mutationResult.errors));
          } else {
            result.mutationResult = mutationResult;
          }
        } catch (e) {
          if (e instanceof Js4meAuthorizationError) {
            // no need to keep process going
            throw e;
          }
          console.error(e);
          errors.push(`Unable to upload assets to 4me.`);
        }
      }
    }
    return [result];
  }

  removeAssetsNotSeenRecently(assets) {
    const recentCutOff = new TimeHelper().getMsSinceEpoch() - LansweeperIntegration.LAST_SEEN_DAYS * 24 * 60 * 60 * 1000;
    const recentAssets = assets.filter(asset => !asset.assetBasicInfo.lastSeen || (Date.parse(asset.assetBasicInfo.lastSeen) > recentCutOff));
    if (recentAssets.length < assets.length) {
      console.info(`Skipping ${assets.length - recentAssets.length} assets that have not been seen in ${LansweeperIntegration.LAST_SEEN_DAYS} days.`)
    }
    return recentAssets;
  }

  removeAssetsWithoutIP(assets) {
    const assetsWithIP = assets.filter(asset => !!asset.assetBasicInfo.ipAddress);
    if (assetsWithIP.length < assets.length) {
      console.info(`Skipping ${assets.length - assetsWithIP.length} assets that have no IP address.`)
    }
    return assetsWithIP;
  }

  async downloadResults(mutationResultsToRetrieve) {
    console.log('Downloading all asynchronous query results');
    const jsonResults = new Map();
    const jsonRetrievalCalls = mutationResultsToRetrieve
      .filter(r => !!r)
      .map(async r => jsonResults.set(r, await this.downloadResult(r)));
    await Promise.all(jsonRetrievalCalls);
    console.log('All asynchronous query results downloaded');
    return jsonResults;
  }

  async downloadResult(mutationResult) {
    const descr = `discovered CIs result ${mutationResult.asyncQuery.id}`;
    try {
      const helper = this.customer4meHelper;
      return await helper.getAsyncMutationResult(descr, mutationResult, LansweeperIntegration.ASYNC_TIMEOUT);
    } catch (e) {
      return {error: e.message};
    }
  }

  reduceResults(sendResults, jsonResults) {
    const overallResult = {errors: [], uploadCount: 0};
    sendResults.forEach(sendResult => {
      if (sendResult.mutationResult) {
        const json = jsonResults.get(sendResult.mutationResult);
        if (json.error) {
          sendResult.errors.push(json.error);
        } else if (json.errors) {
          sendResult.errors.push(...this.mapErrors(json.errors));
        }
        if (json.configurationItems) {
          sendResult.uploadCount = json.configurationItems.length;
        }
      }
      if (sendResult.errors) {
        // 4me errors
        overallResult.errors.push(...sendResult.errors);
      }
      if (sendResult.error) {
        // lansweeper errors
        overallResult.errors.push(sendResult.error);
      }
      if (sendResult.uploadCount) {
        overallResult.uploadCount = overallResult.uploadCount + sendResult.uploadCount;
      }
    });
    if (overallResult.errors.length === 0) {
      delete overallResult.errors;
    }
    return overallResult;
  }

  mapErrors(errors) {
    return errors.map(e => e.message || e);
  }

  async uploadTo4me(input) {
    const query = LansweeperIntegration.graphQL4meMutation('id sourceID');
    const accessToken = await this.customer4meHelper.getToken();
    const result = await this.customer4meHelper.executeGraphQLMutation('discovered CIs',
                                                                       accessToken,
                                                                       query,
                                                                       {input: input});
    if (result.error) {
      console.error('Error uploading:\n%j', result);
      throw new LoggedError('Unable to upload to 4me');
    } else {
      return result;
    }
  }
}

LansweeperIntegration.graphQL4meMutation = (ciResponseFields) => {
  return `
      mutation($input: DiscoveredConfigurationItemsInput!) {
        discoveredConfigurationItems(input: $input) {
          errors { path message }
          configurationItems { ${ciResponseFields} }
          asyncQuery { id errorCount resultUrl resultCount }
        }
      }`;
}
LansweeperIntegration.ASYNC_TIMEOUT = parseInt(process.env.DOWNLOAD_RESULT_TIMEOUT, 10) || 300000;
LansweeperIntegration.LAST_SEEN_DAYS = parseInt(process.env.LAST_SEEN_DAYS, 10) || 30;

module.exports = LansweeperIntegration;
