'use strict';

const LansweeperClient = require('../lansweeper_client');
const DiscoveryMutationHelper = require('../discovery_mutation_helper');
const {loadTestCredentials} = require('../../../../library/helpers/tests/test_credentials_helper');

it('create input from demo', async () => {
  const referenceData = {
    softwareCis: new Map(),
    users: new Map(),
  }

  const allAssets = require('./assets/asset_array_api_demo.json').filter(a => !!a.assetBasicInfo.ipAddress);
  const allCount = allAssets.length;
  console.log(allCount);

  let myNewArray = []
  const chunk = 100;
  for (let i = 0; i < allCount; i += chunk) {
    myNewArray = [...myNewArray, allAssets.slice(i, i + chunk)];
  }
  console.log(myNewArray.length);
  const input = new DiscoveryMutationHelper(referenceData).toDiscoveryUploadInput(myNewArray[0]);
  console.log('%j', input)
});

describe.skip('integration tests', () => {
  // create a file (ignored by Git) containing your credentials to access Lansweeper's demo site api-demo-data-v2
  // next to this test file to execute these integration tests, without credential file these tests are skipped.
  // The `siteId` below is internal ID of that demo site we saw. It is expected to remain stable, but using another
  // site it will probably have to change.
  const credentials = loadTestCredentials(`${__dirname}/lansweeper-api-demo-data-v2.credentials.json`);
  if (!credentials) {
    return;
  }
  const helper = new LansweeperClient(credentials.clientID, credentials.clientSecret, credentials.refreshToken);
  const siteId = '56d4ed4f-b2ad-4587-91b5-07bd453c5c76';

  it('can get site ids', async () => {
    const response = await helper.getSiteIds();

    expect(response).toEqual([siteId]);
  });

  it('can get site name', async () => {
    const response = await helper.getSiteName(siteId);

    expect(response).toEqual('api-demo-data-v2');
  });

  it('can start export', async () => {
    const exportId = await helper.startExport(siteId, true);

    expect(exportId).not.toEqual(undefined);
    expect(exportId).not.toEqual('');
    console.log(`started export id: ${exportId}`);
  });

  it.skip('can get export status', async () => {
    // update exportId to a value for an export recently started
    const exportId = '61b36006aa8210f7baefe7b9';
    const status = await helper.getExportStatus(siteId, exportId);

    expect(status.error).toBe(undefined);
    expect(status.progress).toEqual('100%');
    expect(status.url).not.toEqual(undefined);
    expect(status.url).not.toEqual('');
    console.log(`export at: ${status.url}`);
  });

  describe('getAssetsPaged', () => {
    beforeEach(() => {
      jest.setTimeout(10000);
    });

    it('can get network assets paged', async () => {
      await getAndCheck(true, 1114);
    });

    it('can get non-network assets paged', async () => {
      await getAndCheck(false, 376);
    });

    it('can get all assets paged', async () => {
      await getAndCheck(undefined, 1490);
    });

    async function getAndCheck(withIP, expectedCount) {
      const results = await helper.getAssetsPaged(siteId, items => {
        return items;
      }, withIP);

      const json = JSON.stringify(results, null, '  ');
      expect(results.length).toEqual(expectedCount);
    }
  });
});
