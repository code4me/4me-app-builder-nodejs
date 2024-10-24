'use strict';

const LansweeperClient = require('../lansweeper_client');
const LansweeperApiHelper = require('../lansweeper_api_helper');
jest.mock('../lansweeper_api_helper');

const createClient = () => new LansweeperClient('client id',
                                               'secret',
                                               'refresh token');
describe('retrieving installations with error for one site', () => {
  beforeEach(() => {
    LansweeperApiHelper.mockImplementationOnce(() => ({
      getGraphQLQuery: async (descr, query, vars) => {
        if (query.includes('authorizedSites')) {
          return {authorizedSites: {sites: [{id: 'a', name: 'site A'}, {id: 'b', name: 'site B'}]}};
        } else if (query.includes('allInstallations')) {
          if (vars.siteId === 'a') {
            return {error: `Unable to query ${descr}: [{message: 'You are not authorized'}]`};
          } else {
            return {
              site: {
                allInstallations: [
                  {id: 'a', name: `install A for ${vars.siteId}`, siteId: vars.siteId},
                  {id: 'b', name: `install B for ${vars.siteId}`, siteId: vars.siteId},
                ]
              }
            };
          }
        } else {
          throw Error('not mocked')
        }
      },
    }));
  });

  it('getAllInstallationNames ignores lansweeper error', async () => {
    const client = createClient();

    const result = await client.getAllInstallationNames();
    expect(result).toEqual(['install A for b', 'install B for b']);
  });

  describe('getAllInstallations', () => {
    it('returns lansweeper error for bad site', async () => {
      const client = createClient();

      const result = await client.getAllInstallations('a');
      expect(result).toEqual({error: "Unable to query all installations: [{message: 'You are not authorized'}]"});
    });

    it('returns installations for good site', async () => {
      const client = createClient();

      const result = await client.getAllInstallations('b');
      expect(result).toEqual([{id: "a", name: "install A for b", siteId: "b"}, {id: "b", name: "install B for b", siteId: "b"}]);
    });
  });

  describe('getFilters', () => {
    const checkFilter = async (assetTypes, expectedFilter) => {
      const client = createClient();

      const result = await client.getFilters(undefined, new Date(2024, 9, 2), "e3", assetTypes);
      if (cleanFilter(result) !== cleanFilter(expectedFilter)) {
        expect(result).toEqual(expectedFilter);
      }
    }

    const cleanFilter = (query) => query.replaceAll(/\s+/g, ' ').trim()

    describe('asset filtering', () => {
      it('no asset filtered', async () => {
        const expectedQuery = `
          { conjunction: AND
            groups: [ 
              { conjunction: OR
                conditions: [
                  { operator: GREATER_THAN, path: "assetBasicInfo.lastSeen", value: "2024-10-01T22:00:00.000Z" },
                  { operator: EXISTS, path: "assetBasicInfo.lastSeen", value: "false" } 
                ]
              },
              { conjunction: AND
                conditions: [
                  { operator: EQUAL, path: "installationId", value: "e3" }
                ]
              }
            ]
          }`;
        await checkFilter(null, expectedQuery);
        await checkFilter(undefined, expectedQuery);
      });

      it('few assets', async () => {
        const expectedQuery = `
          { conjunction: AND
            groups: [
              { conjunction: OR
                conditions: [ { operator: REGEXP, path: "assetBasicInfo.type", value: "Windows|Windows CE" } ]
              },
              { conjunction: OR
                conditions: [
                  { operator: GREATER_THAN, path: "assetBasicInfo.lastSeen", value: "2024-10-01T22:00:00.000Z" },
                  { operator: EXISTS, path: "assetBasicInfo.lastSeen", value: "false" }
                ]
              },
              { conjunction: AND
                conditions: [ { operator: EQUAL, path: "installationId", value: "e3" } ]
              }
            ]
          }`;
        await checkFilter(['Windows', 'Windows CE'], expectedQuery);
      });

      it('many assets', async () => {
        const assetTypes = [
          "Automotive",
          "Mobile",
          "Monitor",
          "NAS",
          "Switch",
          "Tablet",
          "Toy",
          "VMware Guest",
          "Virtual Machine",
          "Weather",
          "Webserver",
          "Wifi",
          "Windows",
        ];
        expect(assetTypes.join('|').length).toBeGreaterThan(LansweeperClient.maxFilterFieldLength);

        const expectedFilter = `
        { conjunction: AND
          groups: [
            { conjunction: OR
             conditions: [
                { operator: REGEXP, path: "assetBasicInfo.type", value: "Automotive|Mobile|Monitor|NAS|Switch|Tablet|Toy|VMware Guest|Virtual Machine|Weather|Webserver|Wifi" },
                { operator: REGEXP, path: "assetBasicInfo.type", value: "Windows" }
              ]
            },
            { conjunction: OR
              conditions: [
                { operator: GREATER_THAN, path: "assetBasicInfo.lastSeen", value: "2024-10-01T22:00:00.000Z" },
                { operator: EXISTS, path: "assetBasicInfo.lastSeen", value: "false" }
              ]
            },
            { conjunction: AND
              conditions: [
                { operator: EQUAL, path: "installationId", value: "e3" }
              ]
            }
         ]
        }`;
        await checkFilter(assetTypes, expectedFilter);
      });
    })
  });
});
