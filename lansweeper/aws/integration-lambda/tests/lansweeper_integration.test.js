'use strict';

const LansweeperIntegration = require('../lansweeper_integration');
const assetArray = require('./assets/asset_array.json');

const LansweeperClient = require('../lansweeper_client');
jest.mock('../lansweeper_client');

const ReferencesHelper = require('../references_helper');
jest.mock('../references_helper');

const DiscoveryMutationHelper = require('../discovery_mutation_helper');
jest.mock('../discovery_mutation_helper');

const OsCiMutationHelper = require('../os_ci_mutation_helper');
jest.mock('../os_ci_mutation_helper');

const TimeHelper = require('../../../../library/helpers/time_helper');
const LansweeperAuthorizationError = require('../errors/lansweeper_authorization_error');
const Js4meAuthorizationError = require('../../../../library/helpers/errors/js_4me_authorization_error');
const LansweeperGraphQLError = require('../errors/lansweeper_graphql_error');
const LoggedError = require('../../../../library/helpers/errors/logged_error');
jest.mock('../../../../library/helpers/time_helper');

describe('downloadAndReduceSiteResults', () => {
  const integration = new LansweeperIntegration('client id',
                                                'secret',
                                                'refresh token',
                                                null);
  const siteName = 'my_site';

  it('combines uploads from 2 installations', async () => {
    const result = {uploadCounts: {}, errorCounts: {}, info: {}, errors: {}};

    const resultDownloadFunctions = new Map();
    resultDownloadFunctions.set({id: '0', name: 'installation1'},
                                async () => ({uploadCount: 2}));
    resultDownloadFunctions.set({id: '1', name: 'installation2'},
                                async () => ({uploadCount: 6}));

    await integration.downloadAndReduceSiteResults(resultDownloadFunctions, result, siteName);
    expect(result).toEqual(
      {
        errorCounts: {},
        info: {},
        errors: {},
        uploadCounts: {
          my_site: {
            installation1: 2,
            installation2: 6,
          },
        },
      });
  });

  it('combines errors from 2 installations', async () => {
    const result = {uploadCounts: {}, errorCounts: {}, info: {}, errors: {}};

    const resultDownloadFunctions = new Map();
    resultDownloadFunctions.set({id: '0', name: 'installation1'},
                                async () => ({errors: ['a', 'c']}));
    resultDownloadFunctions.set({id: '1', name: 'installation2'},
                                async () => ({errors: ['b']}));

    await integration.downloadAndReduceSiteResults(resultDownloadFunctions, result, siteName);
    expect(result).toEqual(
      {
        errorCounts: {
          my_site: {
            installation1: 2,
            installation2: 1,
          },
        },
        info: {},
        errors: {
          my_site: {
            installation1: ['a', 'c'],
            installation2: ['b'],
          },
        },
        uploadCounts: {
          my_site: {
            installation1: 0,
            installation2: 0,
          },
        },
      });
  });

  it('combines error and upload from 2 installations', async () => {
    const result = {uploadCounts: {}, errorCounts: {}, info: {}, errors: {}};

    const resultDownloadFunctions = new Map();
    resultDownloadFunctions.set({id: '0', name: 'installation1'},
                                async () => ({errors: ['a', 'c']}));
    resultDownloadFunctions.set({id: '1', name: 'installation2'},
                                async () => ({uploadCount: 2}));

    await integration.downloadAndReduceSiteResults(resultDownloadFunctions, result, siteName);
    expect(result).toEqual(
      {
        errorCounts: {
          my_site: {
            installation1: 2,
          },
        },
        info: {},
        errors: {
          my_site: {
            installation1: ['a', 'c'],
          },
        },
        uploadCounts: {
          my_site: {
            installation1: 0,
            installation2: 2,
          },
        },
      });
  });
});

describe('processSite', () => {
  const discoveryUploadQuery = `
      mutation($input: DiscoveredConfigurationItemsInput!) {
        discoveredConfigurationItems(input: $input) {
          errors { path message }
          configurationItems { id sourceID }
          asyncQuery { id errorCount resultUrl resultCount }
        }
      }`;

  const installations = [{id: 1, name: 'a'}, {id: 3, name: 'b'}];

  beforeEach(() => {
    TimeHelper.mockImplementation(() => ({
      getMsSinceEpoch: () => new Date(2021, 7, 30, 10, 0, 0).getTime(),
    }));
  });

  const processSite = async (integration, siteId, networkedAssetsOnly, generateLabels, installation, installationNames, assetTypes) => {
    const resultDownloadFunction = await integration.enqueueMutationsForInstallation(siteId, networkedAssetsOnly, generateLabels, installation, installationNames, assetTypes);
    return await resultDownloadFunction.call();
  }

  it('handles successful pages', async () => {
    const siteId = 'abdv';

    const discoveryUploadInput = [{dataReturnedByDiscoveryHelper: true}];

    const mutationResult = {
      configurationItems: null,
      asyncQuery: {resultUrl: 'https://s3/results.json'}
    };
    const graphQLResult = {
      configurationItems: [
        {id: 'nodeID 1', sourceID: 'sourceID 1'},
        {id: 'nodeID 2', sourceID: 'sourceID 2'},
      ]
    };
    const customerAccessToken = {access_token: 'foo.bar'};
    const mockedJs4meHelper = {
      getToken: jest.fn(async () => customerAccessToken),
      executeGraphQLMutation: jest.fn(async (descr, token, query, vars) => {
        expect(token).toBe(customerAccessToken);
        expect(query.trim()).toEqual(discoveryUploadQuery.trim());
        expect(vars).toEqual({input: discoveryUploadInput});
        return mutationResult;
      }),
      getAsyncMutationResult: jest.fn(async (descr, result, maxWait) => {
        expect(result).toEqual(mutationResult);
        expect(maxWait).toEqual(300000);
        return graphQLResult;
      }),
    };

    const refData = {refDat: true};
    ReferencesHelper.mockImplementationOnce((js4meHelper) => {
      expect(js4meHelper).toBe(mockedJs4meHelper);
      return {
        lookup4meReferences: async (assets) => {
          expect(assets).toEqual(assetArray);
          return refData;
        }
      }
    });

    DiscoveryMutationHelper.mockImplementation((referenceData, generateLabels) => {
      expect(referenceData).toBe(refData);
      expect(generateLabels).toBe(true);
      return {
        toDiscoveryUploadInput: (installation, assets) => {
          expect(assets).toEqual(assetArray);
          return discoveryUploadInput;
        },
      };
    });

    LansweeperClient.mockImplementationOnce(() => ({
      getSiteName: async (id) => {
        expect(id).toBe(siteId);
        return 'site 1';
      },
      getAssetsPaged: async (id, cutOffDate, handler, withIP) => {
        expect(id).toBe(siteId);
        expect(withIP).toEqual(true);
        const result1 = await handler(assetArray);
        const result2 = await handler(assetArray);
        return [...result1, ...result2];
      },
    }));

    const integration = new LansweeperIntegration('client id',
                                                  'secret',
                                                  'refresh token',
                                                  mockedJs4meHelper);

    const result = await processSite(integration, siteId, true, true, installations[0], installations, null);
    const uploadCount = graphQLResult.configurationItems.length * 2;
    expect(result).toEqual({uploadCount: uploadCount});
  });

  it('handles logged error preparing upload', async () => {
    const siteId = 'abddda';
    TimeHelper.mockImplementation(() => ({
      getMsSinceEpoch: () => Date.UTC(2021, 8, 29, 7, 12, 33),
    }));

    DiscoveryMutationHelper.mockImplementation((referenceData, generateLabels) => {
      expect(generateLabels).toBe(false);
      return ({
        toDiscoveryUploadInput: () => { throw new LoggedError('broken') },
      });
    });

    LansweeperClient.mockImplementationOnce(() => ({
      getSiteName: async (id) => {
        expect(id).toBe(siteId);
        return 'site 2';
      },
      getAssetsPaged: async (id, cutOffDate, handler) => {
        expect(id).toBe(siteId);
        return await handler(assetArray);
      },
    }));

    const consoleErrorSpy = jest.spyOn(console, 'error');
    const integration = new LansweeperIntegration('client id',
                                                  'secret',
                                                  'refresh token',
                                                  null);

    const result = await processSite(integration, siteId, false, false, installations[0], installations, null);
    expect(result).toEqual({errors: ['Unable to upload assets to 4me.'], uploadCount: 0});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('handles non-logged error preparing upload', async () => {
    const siteId = 'sadsa';
    TimeHelper.mockImplementation(() => ({
      getMsSinceEpoch: () => Date.UTC(2021, 8, 29, 7, 12, 33),
    }));

    DiscoveryMutationHelper.mockImplementation((referenceData, generateLabels) => {
      expect(generateLabels).toBe(false);
      return ({
        toDiscoveryUploadInput: () => { throw new Error('broken') },
      });
    });

    LansweeperClient.mockImplementationOnce(() => ({
      getSiteName: async (id) => {
        expect(id).toBe(siteId);
        return 'site 2';
      },
      getAssetsPaged: async (id, cutOffDate, handler) => {
        expect(id).toBe(siteId);
        return await handler(assetArray);
      },
    }));
    const consoleErrorSpy = jest.spyOn(console, 'error');

    const integration = new LansweeperIntegration('client id',
                                                  'secret',
                                                  'refresh token',
                                                  null);

    const result = await processSite(integration, siteId, false, false, installations[0], installations, null);
    expect(result).toEqual({errors: ['Unable to upload assets to 4me.'], uploadCount: 0});
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('handles error on first page upload', async () => {
    const siteId = 'abddda';
    TimeHelper.mockImplementation(() => ({
      getMsSinceEpoch: () => Date.UTC(2021, 8, 29, 7, 12, 33),
    }));

    const discoveryUploadInput = [{dataReturnedByDiscoveryHelper: true}];

    const mutationResult1 = {
      errors: ['Unable to upload'],
    };
    const mutationResult2 = {
      configurationItems: null,
      asyncQuery: {resultUrl: 'https://s3/results.json'}
    };
    const graphQLResult = {
      configurationItems: [
        {id: 'nodeID 1', sourceID: 'sourceID 1'},
        {id: 'nodeID 2', sourceID: 'sourceID 2'},
      ]
    };
    const customerAccessToken = {access_token: 'foo.bar'};
    const mockedJs4meHelper = {
      getToken: jest.fn(async () => customerAccessToken),
      executeGraphQLMutation: jest.fn()
        .mockImplementationOnce(async (descr, token, query, vars) => {
          expect(token).toBe(customerAccessToken);
          expect(query.trim()).toEqual(discoveryUploadQuery.trim());
          expect(vars).toEqual({input: discoveryUploadInput});
          return mutationResult1;
        })
        .mockImplementationOnce(async (descr, token, query, vars) => {
          expect(token).toBe(customerAccessToken);
          expect(query.trim()).toEqual(discoveryUploadQuery.trim());
          expect(vars).toEqual({input: discoveryUploadInput});
          return mutationResult2;
        }),
      getAsyncMutationResult: jest.fn(async (descr, result, maxWait) => {
        expect(result).toEqual(mutationResult2);
        expect(maxWait).toEqual(300000);
        return graphQLResult;
      }),
    };

    DiscoveryMutationHelper.mockImplementation((referenceData, generateLabels) => {
      expect(generateLabels).toBe(false);
      return ({
        toDiscoveryUploadInput: (installation, assets) => {
          const recentAssets = integration.removeAssetsNotSeenRecently(assetArray);
          expect(assets).toEqual(recentAssets);
          expect(assets).not.toEqual(assetArray);
          return discoveryUploadInput;
        },
      });
    });

    LansweeperClient.mockImplementationOnce(() => ({
      getSiteName: async (id) => {
        expect(id).toBe(siteId);
        return 'site 2';
      },
      getAssetsPaged: async (id, cutOffDate, handler) => {
        expect(id).toBe(siteId);
        const result1 = await handler(assetArray);
        const result2 = await handler(assetArray);
        return [...result1, ...result2];
      },
    }));

    const integration = new LansweeperIntegration('client id',
                                                  'secret',
                                                  'refresh token',
                                                  mockedJs4meHelper);

    const result = await processSite(integration, siteId, false, false, installations[0], installations, null);
    const uploadCount = graphQLResult.configurationItems.length;
    expect(result).toEqual({errors: ['Unable to upload'], uploadCount: uploadCount});
  });

  it('handles failure on download for first page', async () => {
    const siteId = 'abdv';
    const discoveryUploadInput = [{dataReturnedByDiscoveryHelper: true}];

    const mutationResult1 = {
      configurationItems: null,
      asyncQuery: {resultUrl: 'https://s3/results1.json'}
    };
    const mutationResult2 = {
      configurationItems: null,
      asyncQuery: {resultUrl: 'https://s3/results2.json'}
    };
    const graphQLResult = {
      configurationItems: [
        {id: 'nodeID 1', sourceID: 'sourceID 1'},
        {id: 'nodeID 2', sourceID: 'sourceID 2'},
      ]
    };
    const customerAccessToken = {access_token: 'foo.bar'};
    const mockedJs4meHelper = {
      getToken: jest.fn(async () => customerAccessToken),
      executeGraphQLMutation: jest.fn()
        .mockImplementationOnce(async (descr, token, query, vars) => {
          expect(token).toBe(customerAccessToken);
          expect(query.trim()).toEqual(discoveryUploadQuery.trim());
          expect(vars).toEqual({input: discoveryUploadInput});
          return mutationResult1;
        })
        .mockImplementationOnce(async (descr, token, query, vars) => {
          expect(token).toBe(customerAccessToken);
          expect(query.trim()).toEqual(discoveryUploadQuery.trim());
          expect(vars).toEqual({input: discoveryUploadInput});
          return mutationResult2;
        }),
      getAsyncMutationResult: jest.fn()
        .mockImplementationOnce(async (descr, result, maxWait) => {
          expect(result).toEqual(mutationResult1);
          expect(maxWait).toEqual(300000);
          return {...graphQLResult, errors: [{message: 'unable to create ci1'}]};
        })
        .mockImplementationOnce(async (descr, result, maxWait) => {
          expect(result).toEqual(mutationResult2);
          expect(maxWait).toEqual(300000);
          return graphQLResult;
        }),
    };

    DiscoveryMutationHelper.mockImplementation(() => ({
      toDiscoveryUploadInput: (installation, assets) => {
        expect(assets).toEqual(assetArray);
        return discoveryUploadInput;
      },
    }));

    LansweeperClient.mockImplementationOnce(() => ({
      getSiteName: async (id) => {
        expect(id).toBe(siteId);
        return 'site 1';
      },
      getAssetsPaged: async (id, cutOffDate, handler) => {
        expect(id).toBe(siteId);
        const result1 = await handler(assetArray);
        const result2 = await handler(assetArray);
        return [...result1, ...result2];
      },
    }));

    const integration = new LansweeperIntegration('client id',
                                                  'secret',
                                                  'refresh token',
                                                  mockedJs4meHelper);

    const result = await processSite(integration, siteId, undefined, false, installations[0], installations, null);
    const uploadCount = graphQLResult.configurationItems.length * 2;
    expect(result).toEqual({errors: ['unable to create ci1'], uploadCount: uploadCount});
  });

  it('does not handle lansweeper authentication error', async () => {
    const error = new LansweeperAuthorizationError('oops');
    LansweeperClient.mockImplementationOnce(() => ({
      getSiteIds: async () => {
        throw error;
      },
    }));

    const integration = new LansweeperIntegration('client id',
                                                  'secret',
                                                  'refresh token',
                                                  null);

    await expect(integration.processSites(true, null, false, (_) => true, []))
      .rejects
      .toThrow(error);
  });

  it('does not handle 4me authentication error', async () => {
    const siteId = 'abddda';
    TimeHelper.mockImplementation(() => ({
      getMsSinceEpoch: () => Date.UTC(2021, 8, 29, 7, 12, 33),
    }));

    const discoveryUploadInput = [{dataReturnedByDiscoveryHelper: true}];

    const error = new Js4meAuthorizationError('Unable to get access token: Invalid client credentials');
    const mockedJs4meHelper = {
      getToken: async () => {
        throw error
      },
    };

    DiscoveryMutationHelper.mockImplementation(() => ({
      toDiscoveryUploadInput: (installation, assets) => {
        const recentAssets = integration.removeAssetsNotSeenRecently(assetArray);
        expect(assets).toEqual(recentAssets);
        expect(assets).not.toEqual(assetArray);
        return discoveryUploadInput;
      },
    }));

    LansweeperClient.mockImplementationOnce(() => ({
      getSiteName: async (id) => {
        expect(id).toBe(siteId);
        return 'site 2';
      },
      getAssetsPaged: async (id, cutOffDate, handler) => {
        expect(id).toBe(siteId);
        const result1 = await handler(assetArray);
        return [...result1];
      },
    }));

    const integration = new LansweeperIntegration('client id',
                                                  'secret',
                                                  'refresh token',
                                                  mockedJs4meHelper);

    await expect(processSite(integration, siteId, undefined, false, installations[0], installations, null))
      .rejects
      .toThrow(error);
  });

  it('handles lansweeper error when retrieving sites', async () => {
    const error = new LansweeperGraphQLError('Unable to query accessible Lansweeper sites');
    LansweeperClient.mockImplementationOnce(() => ({
      getSiteIds: async () => {
        throw error;
      },
    }));

    const integration = new LansweeperIntegration('client id',
                                                  'secret',
                                                  'refresh token',
                                                  null);

    const result = await integration.processSites(true, null, false, (_) => true, []);
    expect(result).toEqual({error: error.message});
  });

  it('handles lansweeper error when retrieving installations for one site', async () => {
    const allInstallationNames = ['a for b', 'b for b', 'd for c'];
    const extraInstallationNames = ['e', 'a for c', 'b for b'];
    LansweeperClient.mockImplementationOnce(() => ({
      getSiteIds: async () => ['a', 'b', 'c'],
      getAllInstallationNames: async () => allInstallationNames,
      getAllInstallations: async (siteId) => {
        if (siteId === 'a') {
          return {error: 'No installations for site a'};
        } else {
          return installations.map(i => ({...i, name: `${i.name} for ${siteId}`}));
        }
      },
      getSiteName: async (id) => {
        return `site ${id}`;
      },
      getAssetsPaged: async (id, cutOffDate, handler, networkedAssetsOnly, installationKey) => {
        expect(id).toBe('b');
        const installation = installations.find(i => i.id === installationKey);
        expect(installation).not.toBeUndefined();
        const result1 = await handler(assetArray, networkedAssetsOnly, false, installation.name, installations.map(i => i.name));
        return [...result1];
      },
    }));

    const discoveryUploadInput = [{dataReturnedByDiscoveryHelper: true}];

    const mutationResult = {
      configurationItems: null,
      asyncQuery: {resultUrl: 'https://s3/results.json'}
    };
    const graphQLResult = {
      configurationItems: [
        {id: 'nodeID 1', sourceID: 'sourceID 1'},
        {id: 'nodeID 2', sourceID: 'sourceID 2'},
      ]
    };
    const customerAccessToken = {access_token: 'foo.bar'};
    const mockedJs4meHelper = {
      getToken: jest.fn(async () => customerAccessToken),
      executeGraphQLMutation: jest.fn(async (descr, token, query, vars) => {
        expect(token).toBe(customerAccessToken);
        expect(query.trim()).toEqual(discoveryUploadQuery.trim());
        expect(vars).toEqual({input: discoveryUploadInput});
        return mutationResult;
      }),
      getAsyncMutationResult: jest.fn(async (descr, result, maxWait) => {
        expect(result).toEqual(mutationResult);
        expect(maxWait).toEqual(300000);
        return graphQLResult;
      }),
    };
    const refData = {refDat: true};
    ReferencesHelper.mockImplementationOnce((js4meHelper) => {
      expect(js4meHelper).toBe(mockedJs4meHelper);
      const softwareFound =
        new Map()
          .set('Winzip', 'xyz')
          .set('Windows 7', 'def')
          .set('Windows 11', 'abc')
      return {
        lookup4meReferences: async (assets) => {
          expect(assets).toEqual(assetArray);
          return refData;
        },
        allOperatingSystems: ['Windows 11', 'Windows Server', 'Windows 7'],
        softwareFound: softwareFound,
        osEndOfSupports: new Map(),
        peopleFound: [],
        peopleNotFound: ['a'],
      }
    });

    OsCiMutationHelper.mockImplementationOnce((referencesHelpers, js4meHelper) => ({
      processOSUpdates: async (allOperatingSystems) => {
        expect(allOperatingSystems).toEqual(['Windows 11', 'Windows Server', 'Windows 7']);
        return {cisErrored: ['def'], cisUpdated: []};
      },
    }));

    DiscoveryMutationHelper.mockImplementation((referenceData, generateLabels, installationNames) => {
      expect(referenceData).toBe(refData);
      expect(generateLabels).toBe(false);
      // allInstallationNames + extraInstallations with duplicates removed
      expect(installationNames).toEqual(['a for b', 'b for b', 'd for c', 'e', 'a for c']);
      return {
        toDiscoveryUploadInput: (installation, assets) => {
          expect(assets).toEqual(assetArray);
          expect(installationNames.indexOf(installation)).not.toEqual(-1);
          return discoveryUploadInput;
        },
      };
    });

    const integration = new LansweeperIntegration('client id',
                                                  'secret',
                                                  'refresh token',
                                                  mockedJs4meHelper);

    const result = await integration.processSites(true, null, false, (i) => !i.endsWith(' for c'), extraInstallationNames);
    expect(result).toEqual({
                             uploadCounts: {'site b': {'a for b': 2, 'b for b': 2}},
                             info: {'site c': 'No installations in this site matched selection'},
                             errors: {
                               'operatingSystems': 'Unable to store end-of-support for: def',
                               'site a': 'No installations for site a'},
                           });
  });

  it('handles no matching asset types for one site', async () => {
    const allInstallationNames = ['a for b', 'b for b', 'd for c'];
    const extraInstallationNames = ['e', 'a for c', 'b for b'];
    LansweeperClient.mockImplementationOnce(() => ({
      getSiteIds: async () => ['a', 'b', 'c'],
      getAssetTypes: async (siteId) =>{
        if (siteId === 'a') {
          return ['ipad', 'Kassa'];
        } else {
          return [... new Set(assetArray.map(a => a.assetBasicInfo.type))];
        }
      },
      getAllInstallationNames: async () => allInstallationNames,
      getAllInstallations: async (siteId) => {
        return installations.map(i => ({...i, name: `${i.name} for ${siteId}`}));
      },
      getSiteName: async (id) => {
        return `site ${id}`;
      },
      getAssetsPaged: async (id, cutOffDate, handler, networkedAssetsOnly, installationKey) => {
        expect(id).toBe('b');
        const installation = installations.find(i => i.id === installationKey);
        expect(installation).not.toBeUndefined();
        const result1 = await handler(assetArray, networkedAssetsOnly, false, installation.name, installations.map(i => i.name));
        return [...result1];
      },
    }));

    const discoveryUploadInput = [{dataReturnedByDiscoveryHelper: true}];

    const mutationResult = {
      configurationItems: null,
      asyncQuery: {resultUrl: 'https://s3/results.json'}
    };
    const graphQLResult = {
      configurationItems: [
        {id: 'nodeID 1', sourceID: 'sourceID 1'},
        {id: 'nodeID 2', sourceID: 'sourceID 2'},
      ]
    };
    const customerAccessToken = {access_token: 'foo.bar'};
    const mockedJs4meHelper = {
      getToken: jest.fn(async () => customerAccessToken),
      executeGraphQLMutation: jest.fn(async (descr, token, query, vars) => {
        expect(token).toBe(customerAccessToken);
        expect(query.trim()).toEqual(discoveryUploadQuery.trim());
        expect(vars).toEqual({input: discoveryUploadInput});
        return mutationResult;
      }),
      getAsyncMutationResult: jest.fn(async (descr, result, maxWait) => {
        expect(result).toEqual(mutationResult);
        expect(maxWait).toEqual(300000);
        return graphQLResult;
      }),
    };
    const refData = {refDat: true};
    ReferencesHelper.mockImplementationOnce((js4meHelper) => {
      expect(js4meHelper).toBe(mockedJs4meHelper);
      return {
        lookup4meReferences: async (assets) => {
          expect(assets).toEqual(assetArray);
          return refData;
        },
        allOperatingSystems: [],
        peopleFound: [],
        peopleNotFound: ['a'],
      }
    });

    DiscoveryMutationHelper.mockImplementation((referenceData, generateLabels, installationNames) => {
      expect(referenceData).toBe(refData);
      expect(generateLabels).toBe(false);
      // allInstallationNames + extraInstallations with duplicates removed
      expect(installationNames).toEqual(['a for b', 'b for b', 'd for c', 'e', 'a for c']);
      return {
        toDiscoveryUploadInput: (installation, assets) => {
          expect(assets).toEqual(assetArray);
          expect(installationNames.indexOf(installation)).not.toEqual(-1);
          return discoveryUploadInput;
        },
      };
    });

    const integration = new LansweeperIntegration('client id',
                                                  'secret',
                                                  'refresh token',
                                                  mockedJs4meHelper);

    const result = await integration.processSites(true, ['VMware Guest', 'bla'], false, (i) => !i.endsWith(' for c'), extraInstallationNames);
    expect(result).toEqual({
                             uploadCounts: {'site b': {'a for b': 2, 'b for b': 2}},
                             info: {'site c': 'No installations in this site matched selection'},
                             errors: {'site a': 'No assets matched selected asset types. Available types: ipad; Kassa'},
                           });
  });

  it('finds matching configured asset types case insensitive', async () => {
    LansweeperClient.mockImplementationOnce(() => ({
      getAssetTypes: async (siteId) =>{
        return ['bla', 'iPad', 'lInux'];
      },
    }));

    const integration = new LansweeperIntegration('client id',
                                                  'secret',
                                                  'refresh token',
                                                  null);
    const result = await integration.getSelectedAssetTypes('a', ['ipad', 'LINUX', 'Windows', 'Bla']);
    expect(result).toEqual(['ipad', 'linux', 'bla']);
  });

  it('handles lansweeper error when retrieving assets for one site', async () => {
    const allInstallationNames = ['a for b', 'b for b', 'd for c'];
    const extraInstallationNames = ['e', 'a for c', 'b for b'];
    const allAssetTypes = ['Linux', 'Windows', 'iPad'];
    LansweeperClient.mockImplementationOnce(() => ({
      getSiteIds: async () => ['a', 'b', 'c'],
      getAssetTypes: async (siteId) => {
        if (siteId === 'a') {
          return {error: 'No assets for site a'};
        } else {
          return allAssetTypes.map(a => a.toLowerCase());
        }
      },
      getAllInstallationNames: async () => allInstallationNames,
      getAllInstallations: async (siteId) => {
        expect(siteId).not.toEqual('a');
        return installations.map(i => ({...i, name: `${i.name} for ${siteId}`}));
      },
      getSiteName: async (id) => {
        return `site ${id}`;
      },
      getAssetsPaged: async (id, cutOffDate, handler, networkedAssetsOnly, installationKey, assetTypes) => {
        expect(assetTypes).toEqual(['ipad', 'linux']);
        const installation = installations.find(i => i.id === installationKey);
        expect(installation).not.toBeUndefined();
        const result1 = await handler(assetArray, networkedAssetsOnly, false, installation.name, installations.map(i => i.name));
        return [...result1];
      },
    }));

    const discoveryUploadInput = [{dataReturnedByDiscoveryHelper: true}];

    const mutationResult = {
      configurationItems: null,
      asyncQuery: {resultUrl: 'https://s3/results.json'}
    };
    const graphQLResult = {
      configurationItems: [
        {id: 'nodeID 1', sourceID: 'sourceID 1'},
        {id: 'nodeID 2', sourceID: 'sourceID 2'},
      ]
    };
    const customerAccessToken = {access_token: 'foo.bar'};
    const mockedJs4meHelper = {
      getToken: jest.fn(async () => customerAccessToken),
      executeGraphQLMutation: jest.fn(async (descr, token, query, vars) => {
        expect(token).toBe(customerAccessToken);
        expect(query.trim()).toEqual(discoveryUploadQuery.trim());
        expect(vars).toEqual({input: discoveryUploadInput});
        return mutationResult;
      }),
      getAsyncMutationResult: jest.fn(async (descr, result, maxWait) => {
        expect(result).toEqual(mutationResult);
        expect(maxWait).toEqual(300000);
        return graphQLResult;
      }),
    };
    const refData = {refDat: true};
    ReferencesHelper.mockImplementationOnce((js4meHelper) => {
      expect(js4meHelper).toBe(mockedJs4meHelper);
      return {
        lookup4meReferences: async (assets) => {
          expect(assets).toEqual(assetArray);
          return refData;
        },
        allOperatingSystems: [],
        peopleFound: [],
        peopleNotFound: ['a'],
      }
    });

    DiscoveryMutationHelper.mockImplementation((referenceData, generateLabels, installationNames) => {
      expect(referenceData).toBe(refData);
      expect(generateLabels).toBe(false);
      // allInstallationNames + extraInstallations with duplicates removed
      expect(installationNames).toEqual(['a for b', 'b for b', 'd for c', 'e', 'a for c']);
      return {
        toDiscoveryUploadInput: (installation, assets) => {
          expect(assets).toEqual(assetArray);
          expect(installationNames.indexOf(installation)).not.toEqual(-1);
          return discoveryUploadInput;
        },
      };
    });

    const integration = new LansweeperIntegration('client id',
                                                  'secret',
                                                  'refresh token',
                                                  mockedJs4meHelper);

    const result = await integration.processSites(true, ['ipad', 'linux', 'vmware'], false, (i) => !i.endsWith(' for c'), extraInstallationNames);
    expect(result).toEqual({
                             uploadCounts: {'site b': {'a for b': 2, 'b for b': 2}},
                             info: {'site c': 'No installations in this site matched selection'},
                             errors: {'site a': 'No assets for site a'},
                           });
  });

  it('handles lansweeper error', async () => {
    const siteId = 'abdv';

    const discoveryUploadInput = [{dataReturnedByDiscoveryHelper: true}];

    const mutationResult = {
      configurationItems: null,
      asyncQuery: {resultUrl: 'https://s3/results.json'}
    };
    const graphQLResult = {
      configurationItems: [
        {id: 'nodeID 1', sourceID: 'sourceID 1'},
        {id: 'nodeID 2', sourceID: 'sourceID 2'},
      ]
    };
    const customerAccessToken = {access_token: 'foo.bar'};
    const mockedJs4meHelper = {
      getToken: jest.fn(async () => customerAccessToken),
      executeGraphQLMutation: jest.fn(async (descr, token, query, vars) => {
        expect(token).toBe(customerAccessToken);
        expect(query.trim()).toEqual(discoveryUploadQuery.trim());
        expect(vars).toEqual({input: discoveryUploadInput});
        return mutationResult;
      }),
      getAsyncMutationResult: jest.fn(async (descr, result, maxWait) => {
        expect(result).toEqual(mutationResult);
        expect(maxWait).toEqual(300000);
        return graphQLResult;
      }),
    };

    DiscoveryMutationHelper.mockImplementation(() => ({
      toDiscoveryUploadInput: (installation, assets) => {
        expect(assets).toEqual(assetArray);
        return discoveryUploadInput;
      },
    }));

    LansweeperClient.mockImplementationOnce(() => ({
      getSiteName: async (id) => {
        expect(id).toBe(siteId);
        return 'site 1';
      },
      getAssetsPaged: async (id, cutOffDate, handler) => {
        expect(id).toBe(siteId);
        const result1 = await handler(assetArray);
        const result2 = {error: 'Unable to query abc'};
        return [...result1, result2];
      },
    }));

    const integration = new LansweeperIntegration('client id',
                                                  'secret',
                                                  'refresh token',
                                                  mockedJs4meHelper);

    const result = await processSite(integration, siteId, undefined, false, installations[0], installations, null);
    const uploadCount = graphQLResult.configurationItems.length;
    expect(result).toEqual({errors: ['Unable to query abc'], uploadCount: uploadCount});
  });

  it('updates end of support dates', async () => {
    const allInstallationNames = ['a for b', 'b for b', 'd for c'];
    const extraInstallationNames = ['e', 'a for c', 'b for b'];
    LansweeperClient.mockImplementationOnce(() => ({
      getSiteIds: async () => ['a', 'b', 'c'],
      getAllInstallationNames: async () => allInstallationNames,
      getAllInstallations: async (siteId) => {
        if (siteId === 'a') {
          return {error: 'No installations for site a'};
        } else {
          return installations.map(i => ({...i, name: `${i.name} for ${siteId}`}));
        }
      },
      getSiteName: async (id) => {
        return `site ${id}`;
      },
      getAssetsPaged: async (id, cutOffDate, handler, networkedAssetsOnly, installationKey) => {
        expect(id).toBe('b');
        const installation = installations.find(i => i.id === installationKey);
        expect(installation).not.toBeUndefined();
        const result1 = await handler(assetArray, networkedAssetsOnly, false, installation.name, installations.map(i => i.name));
        return [...result1];
      },
    }));

    const discoveryUploadInput = [{dataReturnedByDiscoveryHelper: true}];

    const mutationResult = {
      configurationItems: null,
      asyncQuery: {resultUrl: 'https://s3/results.json'}
    };
    const graphQLResult = {
      configurationItems: [
        {id: 'nodeID 1', sourceID: 'sourceID 1'},
        {id: 'nodeID 2', sourceID: 'sourceID 2'},
      ]
    };
    const customerAccessToken = {access_token: 'foo.bar'};
    const ciUpdateMutationQuery = `
      mutation($input: ConfigurationItemUpdateInput!) {
        configurationItemUpdate(input: $input) {
          errors { path message }
          configurationItem { id }
        }
      }`.trim();
    const mockedJs4meHelper = {
      getToken: jest.fn(async () => customerAccessToken),
      executeGraphQLMutation: jest.fn(async (descr, token, query, vars) => {
        expect(token).toBe(customerAccessToken);
        if (query.includes('discoveredConfigurationItems')) {
          expect(query.trim()).toEqual(discoveryUploadQuery.trim());
          expect(vars).toEqual({input: discoveryUploadInput});
          return mutationResult;
        } else {
          expect(query.trim()).toEqual(ciUpdateMutationQuery);
          expect(vars).toEqual({input: {id: 'def', endOfSupportDate: '2023-10-10T16:00:00.000Z'}});
          return {configurationItem: {id: 'def'}};
        }
      }),
      getAsyncMutationResult: jest.fn(async (descr, result, maxWait) => {
        expect(result).toEqual(mutationResult);
        expect(maxWait).toEqual(300000);
        return graphQLResult;
      }),
    };
    const refData = {refDat: true};

    OsCiMutationHelper.mockImplementationOnce((referencesHelpers, js4meHelper) => ({
      processOSUpdates: async (allOperatingSystems) => {
        return {cisErrored: [], cisUpdated: ['def']};
      },
    }));

    ReferencesHelper.mockImplementationOnce((js4meHelper) => {
      expect(js4meHelper).toBe(mockedJs4meHelper);
      const softwareFound =
        new Map()
          .set('Winzip', 'xyz')
          .set('Windows 7', 'def')
          .set('Windows 11', 'abc')
      const osEndOfSupports =
        new Map()
          .set('Windows 7', '2023-10-10T16:00:00.000Z')
      return {
        lookup4meReferences: async (assets) => {
          expect(assets).toEqual(assetArray);
          return refData;
        },
        allOperatingSystems: ['Windows 11', 'Windows Server', 'Windows 7'],
        softwareFound: softwareFound,
        osEndOfSupports: osEndOfSupports,
        peopleFound: [],
        peopleNotFound: ['a'],
      }
    });

    DiscoveryMutationHelper.mockImplementation((referenceData, generateLabels, installationNames) => {
      expect(referenceData).toBe(refData);
      expect(generateLabels).toBe(false);
      // allInstallationNames + extraInstallations with duplicates removed
      expect(installationNames).toEqual(['a for b', 'b for b', 'd for c', 'e', 'a for c']);
      return {
        toDiscoveryUploadInput: (installation, assets) => {
          expect(assets).toEqual(assetArray);
          expect(installationNames.indexOf(installation)).not.toEqual(-1);
          return discoveryUploadInput;
        },
      };
    });

    const integration = new LansweeperIntegration('client id',
                                                  'secret',
                                                  'refresh token',
                                                  mockedJs4meHelper);

    const result = await integration.processSites(true, null, false, (i) => !i.endsWith(' for c'), extraInstallationNames);
    expect(result).toEqual({
                             uploadCounts: {'site b': {'a for b': 2, 'b for b': 2}},
                             info: {
                               'operatingSystems': 'Stored end-of-support for 1 item(s)',
                               'site c': 'No installations in this site matched selection',
                             },
                             errors: {'site a': 'No installations for site a'},
                           });
  });


  it('adds an errorCount for all errors received from 4me', async () => {
    const allInstallationNames = ['a for b', 'b for b', 'd for c'];
    const extraInstallationNames = ['e', 'a for c', 'b for b'];
    LansweeperClient.mockImplementationOnce(() => ({
      getSiteIds: async () => ['a', 'b', 'c'],
      getAllInstallationNames: async () => allInstallationNames,
      getAllInstallations: async (siteId) => {
        if (siteId === 'a') {
          return {error: 'No installations for site a'};
        } else {
          return installations.map(i => ({...i, name: `${i.name} for ${siteId}`}));
        }
      },
      getSiteName: async (id) => {
        return `site ${id}`;
      },
      getAssetsPaged: async (id, cutOffDate, handler, networkedAssetsOnly, installationKey) => {
        expect(id).toBe('b');
        const installation = installations.find(i => i.id === installationKey);
        expect(installation).not.toBeUndefined();
        const result1 = await handler(assetArray, networkedAssetsOnly, false, installation.name, installations.map(i => i.name));
        return [...result1];
      },
    }));

    const discoveryUploadInput = [{dataReturnedByDiscoveryHelper: true}];

    const mutationResult = {
      configurationItems: null,
      asyncQuery: {resultUrl: 'https://s3/results.json'}
    };
    const graphQLResult = {
      configurationItems: [
        {id: 'nodeID 1'},
        {id: 'nodeID 2'},
      ],
    };
    const customerAccessToken = {access_token: 'foo.bar'};
    const ciUpdateMutationQuery = `
      mutation($input: ConfigurationItemUpdateInput!) {
        configurationItemUpdate(input: $input) {
          errors { path message }
          configurationItem { id }
        }
      }`.trim();
    let asyncResultCount = 0;
    const mockedJs4meHelper = {
      getToken: jest.fn(async () => customerAccessToken),
      executeGraphQLMutation: jest.fn(async (descr, token, query, vars) => {
        expect(token).toBe(customerAccessToken);
        if (query.includes('discoveredConfigurationItems')) {
          expect(query.trim()).toEqual(discoveryUploadQuery.trim());
          expect(vars).toEqual({input: discoveryUploadInput});
          return mutationResult;
        } else {
          expect(query.trim()).toEqual(ciUpdateMutationQuery);
          expect(vars).toEqual({input: {id: 'def', endOfSupportDate: '2023-10-10T16:00:00.000Z'}});
          return {configurationItem: {id: 'def'}};
        }
      }),
      getAsyncMutationResult: jest.fn(async (descr, result, maxWait) => {
        expect(result).toEqual(mutationResult);
        expect(maxWait).toEqual(300000);
        asyncResultCount++;
        return {...graphQLResult, errors: [{message: `Oops ${asyncResultCount}`, path: ['a', 'b']}]};
      }),
    };
    const refData = {refDat: true};

    OsCiMutationHelper.mockImplementationOnce((referencesHelpers, js4meHelper) => ({
      processOSUpdates: async (allOperatingSystems) => {
        return {cisErrored: [], cisUpdated: ['def']};
      },
    }));

    ReferencesHelper.mockImplementationOnce((js4meHelper) => {
      expect(js4meHelper).toBe(mockedJs4meHelper);
      return {
        lookup4meReferences: async (assets) => {
          expect(assets).toEqual(assetArray);
          return refData;
        },
        allOperatingSystems: [],
        softwareFound: new Map(),
        osEndOfSupports: new Map(),
        peopleFound: [],
        peopleNotFound: ['a'],
      }
    });

    DiscoveryMutationHelper.mockImplementation((referenceData, generateLabels, installationNames) => {
      expect(referenceData).toBe(refData);
      expect(generateLabels).toBe(false);
      // allInstallationNames + extraInstallations with duplicates removed
      expect(installationNames).toEqual(['a for b', 'b for b', 'd for c', 'e', 'a for c']);
      return {
        toDiscoveryUploadInput: (installation, assets) => {
          expect(assets).toEqual(assetArray);
          expect(installationNames.indexOf(installation)).not.toEqual(-1);
          return discoveryUploadInput;
        },
      };
    });

    const integration = new LansweeperIntegration('client id',
                                                  'secret',
                                                  'refresh token',
                                                  mockedJs4meHelper);

    const result = await integration.processSites(true, null, false, (i) => !i.endsWith(' for c'), extraInstallationNames);
    expect(result).toEqual({
                             uploadCounts: {'site b': {'a for b': 2, 'b for b': 2}},
                             errorCounts: {'site b': {'a for b': 1, 'b for b': 1}},
                             info: {
                               'site c': 'No installations in this site matched selection',
                             },
                             errors: {
                               'site a': 'No installations for site a',
                               'site b': {
                                 'a for b': ['Oops 1'],
                                 'b for b': ['Oops 2'],
                               },
                             },
                           });
  });
});

describe('validateCredentials', () => {
  it('returns true if 4me and lansweeper tokens are ok', async () => {
    const expectedClientId = 'client id';
    const expectedClientSecret = 'secret';
    const expectedRefreshToken = 'refresh token';
    const mockedJs4meHelper = {
      getToken: jest.fn(async () => ({access_token: 'abc'})),
    };

    LansweeperClient.mockImplementationOnce((clientId, clientSecret, refreshToken) => {
      expect(clientId).toBe(expectedClientId);
      expect(clientSecret).toBe(expectedClientSecret);
      expect(refreshToken).toBe(expectedRefreshToken);
      return ({
        getSiteIds: async () => (['a', 'b']),
      });
    });

    const integration = new LansweeperIntegration(expectedClientId,
                                                  expectedClientSecret,
                                                  expectedRefreshToken,
                                                  mockedJs4meHelper);

    const result = await integration.validateCredentials();
    expect(result).toBe(true);
  });

  it('throws if lansweeper token is not ok', async () => {
    const mockedJs4meHelper = {
      getToken: jest.fn(async () => ({access_token: 'abc'})),
    };

    const error = new LansweeperAuthorizationError('no');
    LansweeperClient.mockImplementationOnce(() => ({
      getSiteIds: async () => {
        throw error
      },
    }));

    const integration = new LansweeperIntegration('client id',
                                                  'secret',
                                                  'refresh token',
                                                  mockedJs4meHelper);

    await expect(integration.validateCredentials())
      .rejects
      .toThrow(error);
  });

  it('throws if customer account token is not ok', async () => {
    const error = new Js4meAuthorizationError('no');
    const mockedJs4meHelper = {
      getToken: jest.fn(async () => {
        throw error
      }),
    };

    LansweeperClient.mockImplementationOnce(() => ({
      getSiteIds: async () => (['a', 'b']),
    }));

    const integration = new LansweeperIntegration('client id',
                                                  'secret',
                                                  'refresh token',
                                                  mockedJs4meHelper);
    await expect(integration.validateCredentials())
      .rejects
      .toThrow(error);
  });
});

it('filters out assets with old last seen date', () => {
  TimeHelper.mockImplementation(() => ({
    getMsSinceEpoch: () => Date.UTC(2021, 8, 30, 7, 12, 33),
  }));

  const integration = new LansweeperIntegration('client id',
                                                'secret',
                                                'refresh token',
                                                null);
  // only assets without last seen and server last seen 2021-08-31T07:12:33.820Z
  expect(integration.removeAssetsNotSeenRecently(require('./assets/asset_array_older.json')).length).toEqual(8);
});

it('determines cut off date for query', () => {
  TimeHelper.mockImplementation(() => ({
    getMsSinceEpoch: () => Date.UTC(2021, 8, 30, 7, 12, 33),
  }));

  const integration = new LansweeperIntegration();
  const actual = integration.assetSeenCutOffDate();
  expect(actual.toISOString()).toEqual('2021-08-31T07:12:33.000Z')
});
