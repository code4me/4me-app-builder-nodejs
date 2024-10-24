'use strict';

const LansweeperApiHelper = require('./lansweeper_api_helper');
const LansweeperHelper = require('./lansweeper_helper');
const LoggedError = require('../../../library/helpers/errors/logged_error');
const LansweeperAuthorizationError = require('./errors/lansweeper_authorization_error');
const LansweeperGraphQLError = require('./errors/lansweeper_graphql_error');

class LansweeperClient {
  constructor(clientId, clientSecret, refreshToken) {
    this.apiHelper = new LansweeperApiHelper(clientId, clientSecret, refreshToken);
    this.helper = new LansweeperHelper();
  }

  async getSiteIds() {
    return (await this.getSites()).map(s => s.id);
  }

  async getSiteName(id) {
    return (await this.getSites()).find(s => s.id === id).name;
  }

  async getSites() {
    if (!this.sites) {
      const result = await this.apiHelper.getGraphQLQuery('accessible Lansweeper sites', '{ authorizedSites { sites { id name } } }');
      if (result.error) {
        console.info(`Unable to query sites: ${result.error}`);
        throw new LansweeperGraphQLError(result.error);
      } else {
        if (!result.authorizedSites) {
          console.error('No authorizedSites in Lansweeper response, got:\n%j', result);
          throw new LoggedError('Not authorized');
        }
        const sites = result.authorizedSites.sites;
        if (!sites || sites.length === 0) {
          console.error('No sites in Lansweeper response, got:\n%j', result);
          throw new LansweeperAuthorizationError('Not authorized for any sites');
        }
        this.sites = sites;
      }
    }
    return this.sites;
  }

  async getAssetTypes(siteId) {
    const query = `query getAssetTypes($siteId: ID!) {
      site(id: $siteId) {
        id
        assetTypes
      }
    }`;

    const result = await this.apiHelper.getGraphQLQuery('asset types',
                                                        query,
                                                        {siteId: siteId});
    if (result.error) {
      return result;
    } else {
      return result.site.assetTypes;
    }
  }

  async getAllInstallationNames() {
    const installationsPerSite = await this.getInstallationsPerSite();
    return [...installationsPerSite.values()]
      .reduce((memo, i) => memo.concat(i))
      .map(i => i.name);
  }

  async getInstallationsPerSite() {
    const result = new Map();
    for (const site of (await this.getSites())) {
      const siteId = site.id;
      let allForSite = await this.getAllInstallations(siteId);
      if (allForSite.error) {
        console.error(`Error querying installations for ${site.name}/${siteId}`);
        allForSite = [];
      }
      result.set(siteId, allForSite);
    }
    return result;
  }

  async getAllInstallations(siteId) {
    if (!this.installationsBySiteId) {
      this.installationsBySiteId = new Map();
    }
    if (this.installationsBySiteId.has(siteId)) {
      return this.installationsBySiteId.get(siteId);
    }

    // the 'id' returned for each installation can be used to filter assets based on their 'installationId' field.
    const query = `query getInstallations($siteId: ID!) {
      site(id: $siteId) {
        allInstallations {
          id
          siteId
          name
          fqdn
          description
          unlinkedOn
          unlinkedBy
          linkStatus
          installationDate
          type
          totalAssets
          syncServerStatus
          lastAvailable
          version
          syncServer
        }
      }
    }`;

    const result = await this.apiHelper.getGraphQLQuery('all installations',
                                                        query,
                                                        {siteId: siteId});
    let allForSite = result;
    if (!result.error) {
      allForSite = result.site.allInstallations;
    }
    this.installationsBySiteId.set(siteId, allForSite);
    return allForSite;
  }

  async getAssetsPaged(siteId, assetCutOffDate, itemsHandler, withIP, installationId, assetTypes) {
    let retrieved = 0;
    let results = [];

    let firstPage = await this.getFirstAssetPage(siteId, assetCutOffDate, withIP, installationId, assetTypes);
    if (firstPage.error) {
      return [firstPage];
    }

    let total = firstPage.total;
    if (firstPage.items) {
      retrieved += firstPage.items.length;
      console.log(`retrieved first ${retrieved} of ${total}`);

      const itemResults = await itemsHandler(firstPage.items);
      firstPage.items = null; // allow garbage collection
      results = [...results, ...itemResults];

      let next = firstPage.pagination.next;
      while (next && retrieved < total) {
        let nextPage = await this.getNextAssetPage(siteId, assetCutOffDate, next, withIP, installationId, assetTypes);
        if (nextPage.error) {
          results = [...results, nextPage];
          break;
        }

        total = nextPage.total;
        if (nextPage.items && nextPage.items.length > 0) {
          retrieved += nextPage.items.length;
          console.log(`retrieved first ${retrieved} of ${total}`);

          const itemResults = await itemsHandler(nextPage.items);
          nextPage.items = null; // allow garbage collection
          results = [...results, ...itemResults];
        }
        next = nextPage.pagination.next
      }
    }
    return results;
  }

  async getFirstAssetPage(siteId, assetCutOffDate, withIP, installationId, assetTypes) {
    return await this.getAssetPage(siteId, {limit: LansweeperClient.pageSize, page: "FIRST"}, withIP, assetCutOffDate, installationId, assetTypes);
  }

  async getNextAssetPage(siteId, assetCutOffDate, next, withIP, installationId, assetTypes) {
    return await this.getAssetPage(siteId, {limit: LansweeperClient.pageSize, page: "NEXT", cursor: next}, withIP, assetCutOffDate, installationId, assetTypes);
  }

  async getAssetPage(siteId, pagination, withIP, assetCutOffDate, installationId, assetTypes) {
    const filters = this.getFilters(withIP, assetCutOffDate, installationId, assetTypes);
    const fields = LansweeperClient.topLevelFields.split(' ');

    LansweeperClient.basicInfoFields
      .split(' ')
      .forEach(field => fields.push(`assetBasicInfo.${field}`));

    LansweeperClient.assetCustomFields
      .split(' ')
      .forEach(field => fields.push(`assetCustom.${field}`));

    LansweeperClient.operatingSystemFields
      .split(' ')
      .forEach(field => fields.push(`operatingSystem.${field}`));

    LansweeperClient.osMetadataFields
      .split(' ')
      .forEach(field => fields.push(`recognitionInfo.osMetadata.${field}`));

    LansweeperClient.usersFields
      .split(' ')
      .forEach(field => fields.push(`users.${field}`));

    LansweeperClient.softwaresFields
      .split(' ')
      .forEach(field => fields.push(`softwares.${field}`));

    LansweeperClient.memoryModulesFields
      .split(' ')
      .forEach(field => fields.push(`memoryModules.${field}`));

    LansweeperClient.processorFields
      .split(' ')
      .forEach(field => fields.push(`processors.${field}`));

    const query = `query getAssetResources($siteId: ID!, $pagination: AssetsPaginationInputValidated, $fields: [String!]!) {
      site(id: $siteId) {
        assetResources(assetPagination: $pagination, fields: $fields, filters: ${filters}) {
          total
          pagination {
            next
          }
          items
        }
      }
    }`;

    const result = await this.apiHelper.getGraphQLQuery('asset page',
                                                        query,
                                                        {siteId: siteId, pagination: pagination, fields: fields});
    if (result.error) {
      return result;
    } else {
      return result.site.assetResources;
    }
  }

  async startExport(siteId, assetCutOffDate, installationId) {
    const filters = this.getFilters(true, assetCutOffDate, installationId);
    const query = `
      mutation export($siteId: ID!) {
        site(id: $siteId) {
          exportFilteredAssets(filters: ${filters}) {
            assetBasicInfo {${LansweeperClient.basicInfoFields}}
            assetCustom {${LansweeperClient.assetCustomFields}}
            operatingSystem {${LansweeperClient.operatingSystemFields}}
            users {${LansweeperClient.usersFields}}
            softwares {${LansweeperClient.softwaresFields}}
            processors {${LansweeperClient.processorFields}}
            memoryModules {${LansweeperClient.memoryModulesFields}}
            recognitionInfo {osMetadata {${LansweeperClient.osMetadataFields}} }
            ${LansweeperClient.topLevelFields}
            exportId
          }
        }
      }`;
    const response = await this.apiHelper.executeGraphQLMutation('start export',
                                                                 query,
                                                                 {siteId: siteId});
    if (response.error) {
      return response;
    } else {
      return response.exportFilteredAssets.exportId;
    }
  }

  async getExportStatus(siteId, exportId) {
    const query = `
      query exportStatus($siteId: ID!, $exportId: ID!) {
        site(id: $siteId) {
          exportStatus(exportId: $exportId) { progress url }
        }
      }`;

    const result = await this.apiHelper.getGraphQLQuery('export status',
                                                        query,
                                                        {siteId: siteId, exportId: exportId});
    if (result.error) {
      return result;
    } else {
      return result.site.exportStatus;
    }
  }

  getFilters(withIP, assetCutOffDate, installationId, assetTypes = null) {
    const conjunctions = [];

    if (assetTypes) {
      const conditions =
        this.getAssetTypeRegExs(assetTypes)
          .map((regEx) => `{ operator: REGEXP, path: "assetBasicInfo.type", value: "${regEx}" }`);
      const assetTypesConjunction = this.createConjunction("OR", ...conditions);
      conjunctions.push(assetTypesConjunction);
    } else {
      if (withIP !== undefined) {
        const ipConjunction = this.createConjunction("AND",
                                                     `{ operator: EXISTS, path: "assetBasicInfo.ipAddress", value: "${withIP}" }`);
        conjunctions.push(ipConjunction);
      }
    }

    const lastSeenConjunction = this.createConjunction("OR",
                                                       `{ operator: GREATER_THAN, path: "assetBasicInfo.lastSeen", value: "${assetCutOffDate.toISOString()}" }`,
                                                       '{ operator: EXISTS, path: "assetBasicInfo.lastSeen", value: "false" }',
    );
    conjunctions.push(lastSeenConjunction);

    if (installationId !== undefined) {
      const installationConjunction = this.createConjunction("AND",
                                                             `{ operator: EQUAL, path: "installationId", value: "${installationId}" }`);
      conjunctions.push(installationConjunction);
    }

    return `
      { conjunction: AND
        groups: [ ${conjunctions.join(",\n")} ]
      }`;
  }

  getAssetTypeRegExs(assetTypes) {
    const [firstRegEx, remainingTypes] = this.firstRegexValue(assetTypes);
    let regExs = [firstRegEx];
    if (remainingTypes.length > 0) {
      regExs.push(...this.getAssetTypeRegExs(remainingTypes));
    }
    return regExs;
  }

  createConjunction(operator, ...conditions) {
    return `{ conjunction: ${operator}\n  conditions: [ ${conditions.join(",\n")} ] }`;
  }

  firstRegexValue(assetTypes) {
    let index = 0;
    let currentRegEx = '';
    let currentLength = -1;
    let currentArray = [];
    while (index < assetTypes.length && currentLength < LansweeperClient.maxFilterFieldLength) {
      let nextType = assetTypes[index];
      let nextLength = nextType.length;
      if (nextLength > LansweeperClient.maxFilterFieldLength) {
        console.error(`AssetType too long (${nextLength}): ${nextType}`);
      } else {
        const nextArray = [...currentArray, nextType];
        const nextRegEx = this.helper.arrayToRegExValue(nextArray);
        if (nextRegEx.length <= LansweeperClient.maxFilterFieldLength) {
          currentArray = nextArray;
          currentRegEx = nextRegEx;
          currentLength = nextRegEx.length;
        } else {
          break;
        }
      }
      index++;
    }
    const remainingArray = assetTypes.slice(index, assetTypes.length);
    return [currentRegEx, remainingArray];
  }
}

LansweeperClient.pageSize = parseInt(process.env.LANSWEEPER_PAGE_SIZE, 10) || 100;
LansweeperClient.maxFilterFieldLength = parseInt(process.env.LANSWEEPER_MAX_FILTER_FIELD_LENGTH, 10) || 100;
LansweeperClient.topLevelFields = '_id key url';
LansweeperClient.basicInfoFields = 'name type description ipAddress firstSeen lastSeen lastChanged userName userDomain';
LansweeperClient.assetCustomFields = 'model manufacturer stateName purchaseDate warrantyDate serialNumber sku';
LansweeperClient.usersFields = 'name email fullName';
LansweeperClient.softwaresFields = 'name';
LansweeperClient.operatingSystemFields = 'name';
LansweeperClient.osMetadataFields = 'name endOfSupportDate';
LansweeperClient.processorFields = 'numberOfCores';
LansweeperClient.memoryModulesFields = 'size';

module.exports = LansweeperClient;
