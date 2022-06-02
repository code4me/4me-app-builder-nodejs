'use strict';

const LansweeperClient = require('../lansweeper_client');
const LansweeperIntegration = require('../lansweeper_integration');
const Js4meHelper = require('../../../../library/helpers/js_4me_helper');
const Timer = require('../timer');
const ReferencesHelper = require('../references_helper');
const LansweeperHelper = require('../lansweeper_helper');
const {loadTestCredentials} = require('../../../../library/helpers/tests/test_credentials_helper');

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
  const helper = new LansweeperClient(lsCredentials.clientID, lsCredentials.clientSecret, lsCredentials.refreshToken);
  const siteId1 = '261986fd-78b5-4b69-ad12-a6795492f68d';
  const siteId2 = 'c4f5026c-e7e1-4b8f-b5e8-2944e4c044bf';

  const testCredentials = credentials['4me'];
  const accessToken = testCredentials.accessToken;
  const js4meHelper = new Js4meHelper(testCredentials.env, testCredentials.account);
  js4meHelper.getToken = async () => accessToken;

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
    const response = await helper.getSiteIds();

    expect(response).toEqual([siteId2, siteId1]);
  });

  it('can start export', async () => {
    const exportId = await helper.startExport(siteId1, new LansweeperIntegration().assetSeenCutOffDate());

    expect(exportId).not.toEqual(undefined);
    expect(exportId).not.toEqual('');
    console.log(`started export id: ${exportId}`);
  });

  it('can get assets paged', async () => {
    const cutOff = new LansweeperIntegration().assetSeenCutOffDate();
    const results = await helper.getAssetsPaged(siteId1, cutOff, items => {
      return items;
    }, true);

    console.log('assets:\n%j', results);
    const h = new LansweeperHelper();
    const un = h.extractUserNames(results);
    expect(results.length).toEqual(35);
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
