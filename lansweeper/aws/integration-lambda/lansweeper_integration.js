'use strict';

const LansweeperClient = require('./lansweeper_client');
const DiscoveryMutationHelper = require('./discovery_mutation_helper');
const ReferenceHelper = require('./references_helper');
const TimeHelper = require('../../../library/helpers/time_helper');
const LoggedError = require('../../../library/helpers/errors/logged_error');
const Js4meAuthorizationError = require('../../../library/helpers/errors/js_4me_authorization_error');
const LansweeperGraphQLError = require('./errors/lansweeper_graphql_error');
const ResultHelper = require('../../../library/helpers/result_helper');
const OsCiMutationHelper = require('./os_ci_mutation_helper');

class LansweeperIntegration {
  constructor(clientId, clientSecret, refreshToken, customer4meHelper) {
    this.lansweeperClient = new LansweeperClient(clientId, clientSecret, refreshToken);
    this.customer4meHelper = customer4meHelper;
    this.referenceHelper = new ReferenceHelper(customer4meHelper);
    this.resultHelper = new ResultHelper();
  }

  async validateCredentials() {
    const siteIds = await this.lansweeperClient.getSiteIds();
    console.info(`Validated lansweeper access. Can access sites: ${siteIds.length}`);
    const accessToken = await this.customer4meHelper.getToken();
    console.info('Validated 4me customer account access.');
    return true;
  }

  async processSites(networkedAssetsOnly, configAssetTypes, generateLabels, installationFilter, extraInstallations) {
    let siteIds;
    try {
      siteIds = await this.lansweeperClient.getSiteIds();
    } catch (error) {
      if (error instanceof LansweeperGraphQLError) {
        return {error: error.message};
      }
      throw error;
    }

    const allInstallationNames = await this.lansweeperClient.getAllInstallationNames();
    if (allInstallationNames.error) {
      return allInstallationNames;
    }
    const installationNames = [...new Set([...allInstallationNames, ...extraInstallations])];

    const result = {uploadCounts: {}, errorCounts: {}, info: {}, errors: {}};
    for (const siteId of siteIds) {
      const siteName = await this.lansweeperClient.getSiteName(siteId);
      let siteError = null;

      let assetTypes = null;
      if (configAssetTypes) {
        const allAssetTypes = await this.getSelectedAssetTypes(siteId, configAssetTypes);
        if (allAssetTypes.error) {
          siteError = allAssetTypes.error;
        } else {
          assetTypes = allAssetTypes;
        }
      }

      if (!siteError) {
        const installations = await this.lansweeperClient.getAllInstallations(siteId);
        if (installations.error) {
          siteError = installations.error;
        } else {
          const selectedInstallations = installations.filter(i => installationFilter(i.name));
          if (selectedInstallations.length === 0) {
            result.info[siteName] = 'No installations in this site matched selection';
          } else {
            if (selectedInstallations.length > 1) {
              console.log('Will process the following installations: %j', selectedInstallations.map(i => i.name));
            }
            for (const installation of selectedInstallations) {
              const installationResult = await this.processSite(siteId,
                                                                networkedAssetsOnly,
                                                                generateLabels,
                                                                installation,
                                                                installationNames,
                                                                assetTypes);
              result.uploadCounts[siteName] = result.uploadCounts[siteName] || {};
              result.uploadCounts[siteName][installation.name] = installationResult.uploadCount;
              if (installationResult.errors) {
                result.errorCounts[siteName] = result.errorCounts[siteName] || {};
                result.errorCounts[siteName][installation.name] = installationResult.errors.length;
                result.errors[siteName] = result.errors[siteName] || {};
                result.errors[siteName][installation.name] = installationResult.errors;
              }
            }
          }
        }
      }
      if (siteError) {
        result.errors[siteName] = siteError;
      }
    }
    const allOperatingSystems = this.referenceHelper.allOperatingSystems;
    if (allOperatingSystems.length > 0) {
      const osCiMutationHelper = new OsCiMutationHelper(this.referenceHelper, this.customer4meHelper);
      const {cisErrored, cisUpdated} = await osCiMutationHelper.processOSUpdates(allOperatingSystems);
      if (cisErrored && cisErrored.length > 0) {
        result.errors['operatingSystems'] = `Unable to store end-of-support for: ${cisErrored.join(', ')}`;
      } else if (cisUpdated) {
        result.info['operatingSystems'] = `Stored end-of-support for ${cisUpdated.length} item(s)`;
      }
    }
    if (this.referenceHelper.peopleFound.size > 0 || this.referenceHelper.peopleNotFound.length > 0) {
      console.log(`User lookup: found ${this.referenceHelper.peopleFound.size} people (not found ${this.referenceHelper.peopleNotFound.length})`);
    }
    return this.resultHelper.cleanupResult(result);
  }

  async processSite(siteId, networkedAssetsOnly, generateLabels, installation, installationNames, assetTypes) {
    const siteName = await this.lansweeperClient.getSiteName(siteId);
    const installationName = installation.name;
    console.log(`processing site ${siteName}, installation ${installationName}. NetworkedAssetsOnly: ${networkedAssetsOnly}.${generateLabels ? ' Using asset name as label.' : ''}`);
    const itemsHandler = async items => await this.sendAssetsTo4me(items, networkedAssetsOnly, generateLabels, installationName, installationNames);
    const sendResults = await this.lansweeperClient.getAssetsPaged(siteId, this.assetSeenCutOffDate(), itemsHandler, networkedAssetsOnly, installation.id, assetTypes);
    const jsonResults = await this.downloadResults(sendResults.map(r => r.mutationResult));
    const overallResult = this.reduceResults(sendResults, jsonResults);
    console.log(`processed site ${siteName}, installation ${installationName}. Upload count: ${overallResult.uploadCount}, error count: ${overallResult.errors ? overallResult.errors.length : 0}`);

    return overallResult;
  }

  async sendAssetsTo4me(assets, networkedAssetsOnly = false, generateLabels = false, installation = null, installations = []) {
    const errors = [];
    const result = {uploadCount: 0, errors: errors};
    if (assets.length !== 0) {
      let assetsToProcess = this.removeAssetsNotSeenRecently(assets);
      if (assetsToProcess.length !== 0) {
        try {
          const referenceData = await this.referenceHelper.lookup4meReferences(assetsToProcess);
          const discoveryHelper = new DiscoveryMutationHelper(referenceData, generateLabels, installations);
          const input = discoveryHelper.toDiscoveryUploadInput(installation, assetsToProcess);
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
          if (!(e instanceof LoggedError)) {
            console.error(e);
          }
          errors.push(`Unable to upload assets to 4me.`);
        }
      }
    }
    return [result];
  }

  removeAssetsNotSeenRecently(assets) {
    const recentCutOff = this.assetSeenCutOffDate().getTime();
    const recentAssets = assets.filter(asset => !asset.assetBasicInfo.lastSeen || (Date.parse(asset.assetBasicInfo.lastSeen) > recentCutOff));
    if (recentAssets.length < assets.length) {
      console.info(`Skipping ${assets.length - recentAssets.length} assets that have not been seen in ${LansweeperIntegration.LAST_SEEN_DAYS} days.`)
    }
    return recentAssets;
  }

  assetSeenCutOffDate() {
    return new Date(new TimeHelper().getMsSinceEpoch() - LansweeperIntegration.LAST_SEEN_DAYS * 24 * 60 * 60 * 1000);
  }

  async downloadResults(mutationResultsToRetrieve) {
    const jsonResults = new Map();
    if (mutationResultsToRetrieve.length === 0) {
      console.log('No asynchronous queries results to retrieve');
    } else {
      console.log('Downloading all asynchronous query results');
      const jsonRetrievalCalls = mutationResultsToRetrieve
        .filter(r => !!r)
        .map(async r => jsonResults.set(r, await this.downloadResult(r)));
      await Promise.all(jsonRetrievalCalls);
    }
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
    const overallResult = {uploadCount: 0, errors: []};
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
    return this.resultHelper.cleanupResult(overallResult);
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

  async getSelectedAssetTypes(siteId, configAssetTypes) {
    let allAssetTypes = await this.lansweeperClient.getAssetTypes(siteId);
    if (allAssetTypes.error) {
      return allAssetTypes;
    } else {
      const tooLongAssetTypes = allAssetTypes.filter(t => t.length > LansweeperClient.maxFilterFieldLength);
      if (tooLongAssetTypes.length > 0) {
        console.warn(`Encountered ${tooLongAssetTypes.length} too long asset types: [${tooLongAssetTypes.join(',')}]`)
      }
      const allLower = allAssetTypes.map(t => t.toLowerCase());
      const configLower = configAssetTypes.map(t => t.toLowerCase());
      const assetTypes = configLower.filter(at => allLower.includes(at));
      if (assetTypes.length === 0) {
        const typesStr = allAssetTypes.join('; ');
        allAssetTypes = {error: `No assets matched selected asset types. Available types: ${typesStr}`};
      } else {
        if (assetTypes.length !== configAssetTypes.length) {
          const missing = configLower.filter(at => !allLower.includes(at));
          console.warn('Not all asset types configured found. Found: %j. Missing: %j', assetTypes, missing);
        }
        allAssetTypes = assetTypes;
      }
    }
    return allAssetTypes;
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
