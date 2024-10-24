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
});
