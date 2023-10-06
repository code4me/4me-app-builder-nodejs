'use strict';

const OsCiMutationHelper = require('../os_ci_mutation_helper');

describe('processOSUpdates', () => {
  const ciUpdateMutationQuery = `
      mutation($input: ConfigurationItemUpdateInput!) {
        configurationItemUpdate(input: $input) {
          errors { path message }
          configurationItem { id }
        }
      }`.trim();

  it('updates end of support dates', async () => {
    const customerAccessToken = {access_token: 'foo.bar'};
    const mockedJs4meHelper = {
      getToken: jest.fn(async () => customerAccessToken),
      executeGraphQLMutation: jest.fn(async (descr, token, query, vars) => {
        expect(token).toBe(customerAccessToken);
        expect(query.trim()).toEqual(ciUpdateMutationQuery);
        const input = vars.input;
        if (input.id === 'def') {
          expect(input).toEqual({id: 'def', endOfSupportDate: '2023-10-10T16:00:00.000Z'});
        } else {
          expect(input).toEqual({id: 'abc', endOfSupportDate: '2025-10-10T16:00:00.000Z'});
        }
        return {configurationItem: {id: input.id}};
      }),
    };
    const mockedReferenceHelper = {
      allOperatingSystems: ['Windows 11', 'Windows Server', 'Windows 7'],
      softwareFound: new Map()
        .set('Winzip', 'xyz')
        .set('Windows 7', 'def')
        .set('Windows 11', 'abc'),
      osEndOfSupports: new Map()
        .set('Windows 11', '2025-10-10T16:00:00.000Z')
        .set('Windows 7', '2023-10-10T16:00:00.000Z'),
    };

    const allOperatingSystems = mockedReferenceHelper.allOperatingSystems;
    const osCiMutationHelper = new OsCiMutationHelper(mockedReferenceHelper, mockedJs4meHelper);
    const {cisErrored, cisUpdated} = await osCiMutationHelper.processOSUpdates(allOperatingSystems);
    expect(cisUpdated).toEqual(['abc', 'def']);
    expect(cisErrored).toEqual([]);
  });

  it('handles no known OS CIs', async () => {
    const mockedReferenceHelper = {
      allOperatingSystems: ['Windows 11', 'Windows Server', 'Windows 7'],
      softwareFound: new Map()
        .set('Winzip', 'xyz')
        .set('Windows 11', 'abc'),
      osEndOfSupports: new Map(),
    };

    const allOperatingSystems = mockedReferenceHelper.allOperatingSystems;
    const osCiMutationHelper = new OsCiMutationHelper(mockedReferenceHelper, null);
    const {cisErrored, cisUpdated} = await osCiMutationHelper.processOSUpdates(allOperatingSystems);
    expect(cisUpdated).toEqual(undefined);
    expect(cisErrored).toEqual(undefined);
  });

  it('handles no known end of support dates', async () => {
    const mockedReferenceHelper = {
      allOperatingSystems: ['Windows 11', 'Windows Server', 'Windows 7'],
      softwareFound: new Map()
        .set('Winzip', 'xyz')
        .set('Windows 7', 'def')
        .set('Windows 11', 'abc'),
      osEndOfSupports: new Map(),
    };

    const allOperatingSystems = mockedReferenceHelper.allOperatingSystems;
    const osCiMutationHelper = new OsCiMutationHelper(mockedReferenceHelper, null);
    const {cisErrored, cisUpdated} = await osCiMutationHelper.processOSUpdates(allOperatingSystems);
    expect(cisUpdated).toEqual(undefined);
    expect(cisErrored).toEqual(undefined);
  });

  it('handles exception trying to update end of support dates', async () => {
    const customerAccessToken = {access_token: 'foo.bar'};
    const mockedJs4meHelper = {
      getToken: jest.fn(async () => customerAccessToken),
      executeGraphQLMutation: jest.fn(async (descr, token, query, vars) => {
        const input = vars.input;
        if (input.id === 'def') {
          expect(input).toEqual({id: 'def', endOfSupportDate: '2023-10-10T16:00:00.000Z'});
          throw new Error('Broken!');
        } else {
          expect(input).toEqual({id: 'abc', endOfSupportDate: '2026-10-10T16:00:00.000Z'});
          return {configurationItem: {id: input.id}};
        }
      }),
    };
    const mockedReferenceHelper = {
      allOperatingSystems: ['Windows 11', 'Windows Server', 'Windows 7'],
      softwareFound: new Map()
        .set('Winzip', 'xyz')
        .set('Windows 7', 'def')
        .set('Windows 11', 'abc'),
      osEndOfSupports: new Map()
        .set('Windows 11', '2026-10-10T16:00:00.000Z')
        .set('Windows 7', '2023-10-10T16:00:00.000Z'),
    };

    const allOperatingSystems = mockedReferenceHelper.allOperatingSystems;
    const osCiMutationHelper = new OsCiMutationHelper(mockedReferenceHelper, mockedJs4meHelper);
    const {cisErrored, cisUpdated} = await osCiMutationHelper.processOSUpdates(allOperatingSystems);
    expect(cisUpdated).toEqual(['abc']);
    expect(cisErrored).toEqual(['def']);
  });

  it('handles error trying to update end of support dates', async () => {
    const customerAccessToken = {access_token: 'foo.bar'};
    const mockedJs4meHelper = {
      getToken: jest.fn(async () => customerAccessToken),
      executeGraphQLMutation: jest.fn(async (descr, token, query, vars) => {
        expect(token).toBe(customerAccessToken);
        expect(query.trim()).toEqual(ciUpdateMutationQuery);
        const input = vars.input;
        if (input.id === 'def') {
          expect(input).toEqual({id: 'def', endOfSupportDate: '2023-10-10T16:00:00.000Z'});
          return {configurationItem: {id: input.id}};
        } else {
          expect(input).toEqual({id: 'abc', endOfSupportDate: '2026-10-10T16:00:00.000Z'});
          return {error: 'Broken!'};
        }
      }),
    };
    const mockedReferenceHelper = {
      allOperatingSystems: ['Windows 11', 'Windows Server', 'Windows 7'],
      softwareFound: new Map()
        .set('Winzip', 'xyz')
        .set('Windows 7', 'def')
        .set('Windows 11', 'abc'),
      osEndOfSupports: new Map()
        .set('Windows 11', '2026-10-10T16:00:00.000Z')
        .set('Windows 7', '2023-10-10T16:00:00.000Z'),
    };

    const allOperatingSystems = mockedReferenceHelper.allOperatingSystems;
    const osCiMutationHelper = new OsCiMutationHelper(mockedReferenceHelper, mockedJs4meHelper);
    const {cisErrored, cisUpdated} = await osCiMutationHelper.processOSUpdates(allOperatingSystems);
    expect(cisUpdated).toEqual(['def']);
    expect(cisErrored).toEqual(['abc']);
  });
});
