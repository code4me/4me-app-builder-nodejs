'use strict';

const DiscoveryMutationHelper = require('../discovery_mutation_helper');
const assetArray = require('./assets/asset_array.json');
const LansweeperHelper = require('../lansweeper_helper');
const referenceData = {
  softwareCis: new Map(),
  users: new Map(),
}

it('generates object without resolved references', () => {
  const helper = new DiscoveryMutationHelper(referenceData);
  const input = helper.toDiscoveryUploadInput(assetArray);

  expect(input.source).toEqual('Lansweeper');
  expect(input.physicalAssets.length).toEqual(13);

  const webserver = input.physicalAssets.find(a => a.name === 'Webserver');
  expect(webserver.meta).toEqual({strategy: 'CREATE'});
  expect(webserver.reference).toEqual('webserver');
  expect(webserver.products.length).toEqual(1);

  const webserverProduct = webserver.products[0];
  expect(webserverProduct.meta).toEqual({strategy: 'CREATE'});
  expect(webserverProduct.name).toEqual('Webserver Unknown gSOAP/2.8');
  expect(webserverProduct.brand).toEqual('Unknown');
  expect(webserverProduct.model).toEqual('gSOAP/2.8');
  expect(webserverProduct.sourceID).toEqual('webserver_unknown_gsoap_2_8');
  expect(webserverProduct.configurationItems.length).toEqual(3);

  const ci = webserverProduct.configurationItems.find(ci => ci.sourceID === 'MjYtQXNzZXQtZjNmNGRiMjMtMWJlNS00MDk1LWIyYTktODY5ZWE3YzFhZjEw');
  expect(ci.name).toEqual('192.168.69.71');
  expect(ci.status).toEqual('in_production');
  expect(ci.systemID).toEqual(
    'https://app.lansweeper.com/jest-site/asset/MjYtQXNzZXQtZjNmNGRiMjMtMWJlNS00MDk1LWIyYTktODY5ZWE3YzFhZjEw/summary');
  expect(ci.hasOwnProperty('inUseSince')).toBeFalsy();
  expect(ci.hasOwnProperty('warrantyExpiryDate')).toBeFalsy();

  const computer = input.physicalAssets.find(a => a.name === 'Computer');
  const computerProduct = computer.products[0];

  const ci2 = computerProduct.configurationItems.find(ci => ci.sourceID === 'OS1Bc3NldC1mM2Y0ZGIyMy0xYmU1LTQwOTUtYjJhOS04NjllYTdjMWFmMTA=');
  expect(ci2.name).toEqual('jl_newdell_mebx.jestnet.lan');
  expect(ci2.status).toEqual('in_production');
  expect(ci2.inUseSince).toEqual('2016-05-23');
  expect(ci2.warrantyExpiryDate).toEqual('2019-05-24');
});

it('generates object with references', () => {
  referenceData.softwareCis.set('Microsoft Visual C++ 2010 x86 Runtime', 'nodeID2')
    .set('Microsoft Windows Server 2019 Standard Evaluation', 'nodeID4');
  referenceData.users.set('jest', 'nodeID1').set('fred@4me.com', 'nodeID3');

  // call helper to ensure assetArray is manipulated as expected
  const usernames = new LansweeperHelper().extractUserNames(assetArray);

  const helper = new DiscoveryMutationHelper(referenceData);
  const input = helper.toDiscoveryUploadInput(assetArray);
  console.log('%j', input);

  expect(input.source).toEqual('Lansweeper');
  expect(input.referenceStrategies).toEqual({ciUserIds: {strategy: 'APPEND'}});
  expect(input.physicalAssets.length).toEqual(13);

  const windows = input.physicalAssets.find(a => a.name === 'Windows');
  expect(windows.meta).toEqual({strategy: 'CREATE'});
  expect(windows.reference).toEqual('windows');
  expect(windows.products.length).toEqual(6);

  const winVmWare = windows.products[0];
  expect(winVmWare.meta).toEqual({strategy: 'CREATE'});
  expect(winVmWare.name).toEqual('Windows VMware, Inc. VMware Virtual Platform');
  expect(winVmWare.configurationItems.length).toEqual(8);

  const ciBoth = winVmWare.configurationItems.find(ci => ci.sourceID === 'Mi1Bc3NldC1mM2Y0ZGIyMy0xYmU1LTQwOTUtYjJhOS04NjllYTdjMWFmMTA=');
  expect(ciBoth.name).toEqual('JL-MASTER');
  expect(ciBoth.userIds).toEqual(['nodeID1', 'nodeID3']);
  expect(ciBoth.ciRelations.childIds).toEqual(['nodeID2', 'nodeID4']);

  const ciNeither = winVmWare.configurationItems.find(ci => ci.sourceID === 'NDEtQXNzZXQtZjNmNGRiMjMtMWJlNS00MDk1LWIyYTktODY5ZWE3YzFhZjEw');
  expect(ciNeither.name).toEqual('JL-DM-003');
  expect(ciNeither.hasOwnProperty('userIds')).toBeFalsy();
  expect(ciNeither.hasOwnProperty('ciRelations')).toBeFalsy();

  const ciOnlyChildren = winVmWare.configurationItems.find(ci => ci.sourceID === 'NjQtQXNzZXQtZjNmNGRiMjMtMWJlNS00MDk1LWIyYTktODY5ZWE3YzFhZjEw');
  expect(ciOnlyChildren.name).toEqual('JL-DM-001');
  expect(ciOnlyChildren.hasOwnProperty('userIds')).toBeFalsy();
  expect(ciOnlyChildren.ciRelations.childIds).toEqual(['nodeID2']);

  const ciOnlyUser = winVmWare.configurationItems.find(ci => ci.sourceID === 'NTAtQXNzZXQtZjNmNGRiMjMtMWJlNS00MDk1LWIyYTktODY5ZWE3YzFhZjEw');
  expect(ciOnlyUser.name).toEqual('JL-2016-000');
  expect(ciOnlyUser.userIds).toEqual(['nodeID1']);
  expect(ciOnlyUser.hasOwnProperty('ciRelations')).toBeFalsy();

  const ci2019 = windows.products[5].configurationItems.find(ci => ci.sourceID === 'NjYtQXNzZXQtZjNmNGRiMjMtMWJlNS00MDk1LWIyYTktODY5ZWE3YzFhZjEw');
  expect(ci2019.name).toEqual('JL-2019');
  expect(ci2019.userIds).toEqual(undefined);
  expect(ci2019.ciRelations.childIds).toEqual(['nodeID4']);

  const vm71prod = windows.products.find(p => p.sourceID === 'windows_vmware_inc_vmware7_1');
  const ciOneUnkownUser = vm71prod.configurationItems.find(ci => ci.sourceID === 'NDQtQXNzZXQtZjNmNGRiMjMtMWJlNS00MDk1LWIyYTktODY5ZWE3YzFhZjEw');
  expect(ciOneUnkownUser.name).toEqual('JL-DM-000');
  expect(ciOneUnkownUser.userIds).toEqual(['nodeID3']);
  expect(ciOneUnkownUser.hasOwnProperty('ciRelations')).toBeFalsy();
});

it('processes assets without IP address', () => {
  const nonIPAssets = require('./assets/non_network_assets.json');

  const helper = new DiscoveryMutationHelper(referenceData);
  const input = helper.toDiscoveryUploadInput(nonIPAssets);

  expect(input.source).toEqual('Lansweeper');
  const productCategoryNames = input.physicalAssets.map(pa => pa.name);
  expect(productCategoryNames).not.toContain('Location');
  expect(productCategoryNames).toContain('iPhone',
                                         'Windows Phone',
                                         'Android',
                                         'Azure Resource Group',
                                         'VMware Guest',
                                         'Monitor',
                                         'Music system',
                                         'Windows',
                                         'AWS EC2 VPC',
                                         'Chrome OS',
                                         'Hyper-V guest',
                                         'Citrix Guest',
                                         'Citrix Pool',
                                         'Rack');
});

describe('check dates', () => {
  it('purchase and warranty date before 1970 are ignored', () => {
    const helper = new DiscoveryMutationHelper(referenceData);
    const asset = assetArray[0];
    asset.assetCustom.purchaseDate = new Date(Date.parse('1968-01-01'));
    asset.assetCustom.warrantyDate = new Date(Date.parse('1968-12-01'));

    const input = helper.toDiscoveryUploadInput([asset]);

    const configurationItem = input.physicalAssets[0].products[0].configurationItems[0];
    expect(configurationItem.inUseSince).toEqual(undefined);
    expect(configurationItem.warrantyExpiryDate).toEqual(undefined);
  });

  it('warranty date before purchase date is ignored', () => {
    const helper = new DiscoveryMutationHelper(referenceData);
    const asset = assetArray[0];
    asset.assetCustom.purchaseDate = new Date(Date.parse('2021-01-01'));
    asset.assetCustom.warrantyDate = new Date(Date.parse('2020-12-01'));

    const input = helper.toDiscoveryUploadInput([asset]);

    const configurationItem = input.physicalAssets[0].products[0].configurationItems[0];
    expect(configurationItem.inUseSince).toEqual('2021-01-01');
    expect(configurationItem.warrantyExpiryDate).toEqual(undefined);
  });

  it('warranty date without purchase date is supported', () => {
    const helper = new DiscoveryMutationHelper(referenceData);
    const asset = assetArray[0];
    asset.assetCustom.purchaseDate = undefined;
    asset.assetCustom.warrantyDate = new Date(Date.parse('2020-12-01'));

    const input = helper.toDiscoveryUploadInput([asset]);

    const configurationItem = input.physicalAssets[0].products[0].configurationItems[0];
    expect(configurationItem.warrantyExpiryDate).toEqual('2020-12-01');
  });
});