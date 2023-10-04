'use strict';

const LansweeperClient = require('../lansweeper_client');
const LansweeperIntegration = require('../lansweeper_integration');
const Js4meHelper = require('../../../../library/helpers/js_4me_helper');
const Timer = require('../timer');
const ReferencesHelper = require('../references_helper');
const LansweeperHelper = require('../lansweeper_helper');
const {loadTestCredentials} = require('../../../../library/helpers/tests/test_credentials_helper');
const LansweeperApiHelper = require('../lansweeper_api_helper');

describe.skip('integration tests', () => {
  // create a file (ignored by Git) containing your credentials to access 4me's test sites
  // next to this test file to execute these integration tests, without credential file these tests are skipped
  // The `siteId1` and `siteId2` below are internal IDs of test sites we used. It is expected to remain stable,
  // but using other sites it will probably have to change.
  const credentials = loadTestCredentials(`${__dirname}/4me_test.credentials.json`);
  if (!credentials) {
    return;
  }
  const lsCredentials = credentials.lansweeper;
  const lansweeperClient = new LansweeperClient(lsCredentials.clientID, lsCredentials.clientSecret, lsCredentials.refreshToken);
  const siteId1 = 'a58223c9-a25d-425a-84f0-35b215b003f9';
  const installId = 'e3d90a6d-5f9a-4af8-8162-da011bcca979';
  const siteId2 = '261986fd-78b5-4b69-ad12-a6795492f68d';

  const testCredentials = credentials['4me'];
  const accessToken = testCredentials.accessToken;
  const js4meHelper = new Js4meHelper(testCredentials.env, testCredentials.account);
  js4meHelper.getToken = async () => accessToken;

  it.skip('get refresh token', async () => {
    const code = 'abc';
    const host = 'efdg.execute-api.eu-west-1.amazonaws.com';
    const path = '/Prod/integration/wdc/xyz';
    const callbackURL = `https://${host}${path}`;
    const lansweeperApiHelper = new LansweeperApiHelper(lsCredentials.clientID, lsCredentials.clientSecret, null);
    const rt =  await lansweeperApiHelper.getRefreshToken(code, callbackURL);
    console.log(rt);
    expect(rt).not.toBe(null);
  });

  it('loads software references', async () => {
    const refsHelper = new ReferencesHelper(js4meHelper);
    const softwareNames = ["Canonical Ubuntu 9.049.04", "Oracle Database 19c", "Outlook"];
    const softwareFound = await refsHelper.getSoftwareNameToIdMap(softwareNames, accessToken);
    console.log(`Found %j`, Object.fromEntries(softwareFound));
    expect(refsHelper.softwareNotFound).toEqual(["Outlook"]);
    const softwareFound2 = await refsHelper.getSoftwareNameToIdMap(softwareNames, accessToken);
    expect(softwareFound2).toBe(softwareFound);
  });

  it('loads user references', async () => {
    const referencesHelper = new ReferencesHelper(js4meHelper);
    const userNames = ["howard.tanner@widget.com", "ellen.brown@widget.com", "john.doe@example.com", '430245', '430134'];
    const peopleFound = await referencesHelper.getUserNameToIdMap(userNames, accessToken);
    console.log(`Found %j`, Object.fromEntries(peopleFound));
    expect(Object.fromEntries(peopleFound)).toEqual({
                                                      "430245": "NG1lLXN0YWdpbmcuY29tL1BlcnNvbi83NQ",
                                                      "howard.tanner@widget.com": "NG1lLXN0YWdpbmcuY29tL1BlcnNvbi82",
                                                      "430134": "NG1lLXN0YWdpbmcuY29tL1BlcnNvbi82",
                                                      "ellen.brown@widget.com": "NG1lLXN0YWdpbmcuY29tL1BlcnNvbi8yMDU"
                                                    });
    expect(referencesHelper.peopleNotFound).toEqual(["john.doe@example.com"]);
    const peopleFound2 = await referencesHelper.getUserNameToIdMap(userNames, accessToken);
    expect(peopleFound2).toBe(peopleFound2);
  });

  it.skip('process large', async () => {
    // test with large lansweeper response data from file
    jest.setTimeout(6000000);
    const allAssets = require('./assets/asset_array_large.json').filter(a => !!a.assetBasicInfo.ipAddress);
    console.log(allAssets.length);

    const integration = new LansweeperIntegration('client id',
                                                  'secret',
                                                  'refresh token',
                                                  js4meHelper);

    const itemsHandler = async items => await integration.sendAssetsTo4me(items);

    const fakeLansweeper = async () => {
      let myNewArray = []
      const chunk = 100;
      const recentCount = allAssets.length;
      for (let i = 0; i < recentCount; i += chunk) {
        const assetBatch = allAssets.slice(i, i + chunk);
        const nextResut = await itemsHandler(assetBatch);
        myNewArray = [...myNewArray, ...nextResut];
      }
      return myNewArray;
    }

    const sendResults = await fakeLansweeper();
    const jsonResults = await integration.downloadResults(sendResults.map(r => r.mutationResult));
    const overallResult = integration.reduceResults(sendResults, jsonResults);
    console.log('%j', overallResult);
  });

  it('can get site ids', async () => {
    const response = await lansweeperClient.getSiteIds();

    expect(response).toEqual([siteId2, siteId1]);
  });

  it('can get asset types', async () => {
    const response = await lansweeperClient.getAssetTypes(siteId1);

    expect(response).toEqual([
                               "Alarm system",
                               "Automotive",
                               "Cleaner",
                               "Computer",
                               "ESXi server",
                               "Energy",
                               "FTP server",
                               "IOS",
                               "Laptop",
                               "Linux",
                               "Location",
                               "Media system",
                               "Mobile",
                               "Monitor",
                               "NAS",
                               "Network device",
                               "Printer",
                               "Router",
                               "Server",
                               "Smart Home",
                               "Smart TV",
                               "Smoke",
                               "Surveillance Camera",
                               "Switch",
                               "Tablet",
                               "Toy",
                               "VMware Guest",
                               "Virtual Machine",
                               "Weather",
                               "Webserver",
                               "Wifi",
                               "Windows"
                             ]);
  });

  it('can get installation names for all sites', async () => {
    const names = await lansweeperClient.getAllInstallationNames();
    expect(names).toEqual(['Tampa JLerch', 'Widget Belgian HQ']);
  });

  it('can get all installations', async () => {
    const response = await lansweeperClient.getAllInstallations(siteId1);
    console.log('%j', response);

    expect(response.length).toEqual(2);
    expect(response.find(i => i.siteId === siteId1 && i.syncServerStatus === 'Down')).toMatchObject(
      {
        "description": "US Based",
        "fqdn": "",
        "id": installId,
        "installationDate": "2022-09-21T15:32:13.099Z",
        "linkStatus": "Linked",
        "name": "Tampa JLerch",
        "siteId": siteId1,
        "syncServer": "jl-master",
        "syncServerStatus": "Down",
        "type": "IT",
      },
    );
  });

  it('can start export', async () => {
    const exportId = await lansweeperClient.startExport(siteId1, new LansweeperIntegration().assetSeenCutOffDate());

    expect(exportId).not.toEqual(undefined);
    expect(exportId).not.toEqual('');
    console.log(`started export id: ${exportId}`);
  });

  it('can get assets paged', async () => {
    const cutOff = new LansweeperIntegration().assetSeenCutOffDate();
    const results = await lansweeperClient.getAssetsPaged(siteId1, cutOff, items => {
      return items;
    }, true);

    console.log('assets:\n%j', results);
    const h = new LansweeperHelper();
    const un = h.extractUserNames(results);
    expect(results.length).toEqual(55);
  });

  it('can get assets paged for single installation', async () => {
    const cutOff = new LansweeperIntegration().assetSeenCutOffDate();
    const results = await lansweeperClient.getAssetsPaged(siteId1, cutOff, items => {
      return items;
    }, true, installId);

    console.log('assets:\n%j', results);
    const r = results.filter(a => !a.assetBasicInfo.ipAddress);
    expect(r.length).toEqual(22); // should be 0, for some reason we get assets without ipAddress from Lansweeper. We filter them out later, before sending to 4me

    const h = new LansweeperHelper();
    const un = h.extractUserNames(results);
    expect(results.length).toEqual(49);
  });

  it('can get assets paged for single installation and limited asset types', async () => {
    const cutOff = new LansweeperIntegration().assetSeenCutOffDate();
    const results = await lansweeperClient.getAssetsPaged(siteId1, cutOff, items => {
      return items;
    }, true, installId, ['Windows', 'VMware Guest']);

    console.log('assets:\n%j', results);
    const r = results.filter(a => a.assetBasicInfo.type !== 'Windows' && a.assetBasicInfo.type !== 'VMware Guest');
    expect(r.length).toEqual(0);

    const allResults = await lansweeperClient.getAssetsPaged(siteId1, cutOff, items => {
      return items;
    }, undefined, installId);

    // console.log('all assets:\n%j', allResults);
    const filteredResults = allResults.filter(a => a.assetBasicInfo.type === 'Windows' || a.assetBasicInfo.type === 'VMware Guest');
    expect(filteredResults).toEqual(results);
  });

  describe('performance tests', () => {
    it('generate upload all different', async () => {
      function createInput(run) {
        const input = {
          source: 'upload_perf_test',
          physicalAssets: [],
        };

        for (let i = 0; i < 100; i++) {
          const category = {
            meta: {strategy: 'CREATE'},
            reference: `perf_test_a_${run}_${i}`,
            name: `Performance test A ${run} ${i}`,
            products: [],
          };

          const product = {
            meta: {strategy: 'CREATE'},
            sourceID: `perf_test_a_${run}_prod_${i}`,
            name: `Performance test A ${run} prod ${i}`,
            brand: `Brand run ${run} ${i}`,
            model: `Model run ${run} ${i}`,
            configurationItems: [],
          };

          const ci = {
            sourceID: `perf_test_a_${run}_ci_${i}`,
            name: `Performance test A ${run} CI ${i}`,
            systemID: `https://app.lansweeper.com/jest-site/asset/R${run}_${i}/summary`,
            status: 'in_production',
            serialNr: `${run}-${i}`,
          };

          product.configurationItems.push(ci);
          category.products.push(product);
          input.physicalAssets.push(category);
        }
        return input;
      }

      const query = LansweeperIntegration.graphQL4meMutation('id sourceID');

      jest.setTimeout(6000000);
      const totalTimer = new Timer();
      for (let run = 1; run < 101; run++) {
        let i = createInput(run);
        const timer = new Timer();

        const result = await js4meHelper.executeGraphQLMutation(`run ${run}`, accessToken,
                                                                query,
                                                                {input: i});

        timer.stop();
        console.log(`run ${run}: ${timer.getDurationInSeconds()}`)
        if (result.error) {
          console.error(`Error uploading (run ${run}):\n%j`, result);
        } else {
          const timer2 = new Timer();
          const response = await js4meHelper.getAsyncMutationResult('discovered CIs result', result, 30000);
          console.log(`run ${run} results: ${timer2.getDurationInSeconds()}`)
          if (response.error || response.errors) {
            console.error(`Error retrieving result of (run ${run}):\n%j`, response);
          }
        }
      }
      totalTimer.stop();
      console.log(`total: ${totalTimer.getDurationInSeconds()}`)
    });

    it('generate upload one product', async () => {
      function createInput(run) {
        const input = {
          source: 'upload_perf_test',
          physicalAssets: [],
        };

        const category = {
          meta: {strategy: 'CREATE'},
          reference: `perf_test_one_product`,
          name: `Performance test one product`,
          products: [],
        };
        input.physicalAssets.push(category);

        const product = {
          meta: {strategy: 'CREATE'},
          sourceID: `perf_test_one_product_prod`,
          name: `Performance test one product prod`,
          brand: `Brand one product`,
          model: `Model one product`,
          configurationItems: [],
        };
        category.products.push(product);

        for (let i = 0; i < 100; i++) {
          const ci = {
            sourceID: `perf_test_${run}_ci_${i}`,
            name: `Performance test ${run} CI ${i}`,
            systemID: `https://app.lansweeper.com/jest-site/asset/M${run}_${i}/summary`,
            serialNr: `${run}-${i}`,
            status: 'in_production',
          };
          product.configurationItems.push(ci);
        }
        return input;
      }

      const query = LansweeperIntegration.graphQL4meMutation('id sourceID');

      jest.setTimeout(6000000);
      const totalTimer = new Timer();
      for (let run = 1; run < 101; run++) {
        let i = createInput(run);
        const timer = new Timer();

        const result = await js4meHelper.executeGraphQLMutation(`run ${run}`, accessToken,
                                                                query,
                                                                {input: i});

        timer.stop();
        console.log(`run ${run} upload: ${timer.getDurationInSeconds()}`)
        if (result.error) {
          console.error(`Error uploading (run ${run}):\n%j`, result);
        } else {
          const timer2 = new Timer();
          const response = await js4meHelper.getAsyncMutationResult('discovered CIs result', result, 30000);
          console.log(`run ${run} results: ${timer2.getDurationInSeconds()}`)
          if (response.error || response.errors) {
            console.error(`Error retrieving result of (run ${run}):\n%j`, response);
          }
        }
      }
      totalTimer.stop();
      console.log(`total: ${totalTimer.getDurationInSeconds()}`)
    });
  });

  it.skip('can retrieve async result', async () => {
    // to test replace URL value with a value gotten in 4me response to submit query
    const url = 'https://someurlfromAsyncQuery';
    const js4meHelper = new Js4meHelper();

    const result = await js4meHelper.getAsyncQueryResult('discovered CIs result', url, 1000);
    console.log('%j', result);
  });
});

describe("Test dummy", () => {
  it("tests the truth", async () => {
    expect(true).toEqual(true)
  })
})
