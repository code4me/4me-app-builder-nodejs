'use strict';

const ReferencesHelper = require('../references_helper');
const assetArray = require('./assets/asset_array.json');

const allSoftwareQuery = `query($statuses: [CiStatus!]!, $previousEndCursor: String) {
      configurationItems(first: 100, after: $previousEndCursor,
                         filter: {ruleSet: {values: [software]}, status: {values: $statuses}}) {
        pageInfo { hasNextPage endCursor }
        nodes { id name alternateNames }
      }
    }`;
const allPeopleQuery = `query($previousEndCursor: String) {
      people(view: all, first: 100, after: $previousEndCursor) {
        pageInfo { hasNextPage endCursor }
        nodes { id authenticationID primaryEmail sourceID employeeID supportID }
      }
    }`;
const findPeopleQuery = `query($names: [String!]!) {
authenticationID: people(first: 100, view: all, filter: {authenticationID: {values: $names}}) {
                      nodes { userName: authenticationID id }
                    }
primaryEmail: people(first: 100, view: all, filter: {primaryEmail: {values: $names}}) {
                      nodes { userName: primaryEmail id }
                    }
sourceID: people(first: 100, view: all, filter: {sourceID: {values: $names}}) {
                      nodes { userName: sourceID id }
                    }
employeeID: people(first: 100, view: all, filter: {employeeID: {values: $names}}) {
                      nodes { userName: employeeID id }
                    }
supportID: people(first: 100, view: all, filter: {supportID: {values: $names}}) {
                      nodes { userName: supportID id }
                    }
    }`;

describe('lookup4meReferences', () => {
  it('retrieves software and users', async () => {
    const cis = [
      {id: 'ciNode1', name: 'Microsoft Visual C++ 2010 x86 Redistributable'},
      {id: 'ciNode2', name: 'Google Chrome'},
      {id: 'ciNode3', name: 'TeamViewer 15', alternateNames: ['Teamviewr', 'TeamViewer']},
      {id: 'ciNode4', name: 'Microsoft Windows Server 2012', alternateNames: ['Microsoft Windows Server 2012 R2 Standard']},
    ];
    const peopleQueryResult = {
      authenticationID: {nodes: []},
      primaryEmail: {nodes: []},
      sourceID: {nodes: [{userName: 'jest', id: 'pNode1'}]},
      employeeID: {nodes: [{userName: 'jest', id: 'pNode2'}]},
      supportID: {nodes: []},
    };
    const customerAccessToken = {access_token: 'foo.bar'};
    const mockedJs4meHelper = {
      getToken: jest.fn(async () => customerAccessToken),
      reducePagedGraphQLQuery: jest.fn()
        .mockImplementationOnce(async (descr, token, query) => {
          expect(token).toBe(customerAccessToken);
          expect(query.trim()).toEqual(allSoftwareQuery.trim());
          return cis;
        }),
      getGraphQLQuery: jest.fn()
        .mockImplementationOnce(async (descr, token, query, vars) => {
          expect(token).toBe(customerAccessToken);
          expect(query.trim()).toEqual(findPeopleQuery.trim());
          expect(vars).toEqual({names: ['jest', 'fred@4me.com', 'jest-test@4me.com']});
          return peopleQueryResult;
        }),
    };

    const helper = new ReferencesHelper(mockedJs4meHelper);
    const result = await helper.lookup4meReferences(assetArray);

    expect(helper.softwareFound).toBe(result.softwareCis);
    expect(helper.peopleFound).toBe(result.users);
    expect(Object.fromEntries(result.softwareCis)).toEqual({
                                                             "Google Chrome": "ciNode2",
                                                             "Microsoft Visual C++ 2010 x86 Redistributable": "ciNode1",
                                                             "Microsoft Windows Server 2012 R2 Standard": "ciNode4",
                                                             "TeamViewer": "ciNode3",
                                                           });
    expect(Object.fromEntries(result.users)).toEqual({"jest": "pNode1"});
    expect(mockedJs4meHelper.reducePagedGraphQLQuery).toHaveBeenCalledTimes(1);
    expect(mockedJs4meHelper.getGraphQLQuery).toHaveBeenCalledTimes(1);

    // no new calls on new lookup
    const result2 = await helper.lookup4meReferences(assetArray);
    expect(result2).toEqual(result);
    expect(mockedJs4meHelper.reducePagedGraphQLQuery).toHaveBeenCalledTimes(1);
    expect(mockedJs4meHelper.getGraphQLQuery).toHaveBeenCalledTimes(1);
  });
});

describe('getUserNameToIdMap', () => {
  it('retrieves people', async () => {
    const queryResult = {
      authenticationID: {nodes: [{userName: 'howard', id: 'pNode1'}]},
      primaryEmail: {nodes: [{userName: 'ellen@widget.com', id: 'pNode2'}]},
      sourceID: {nodes: [{userName: 'source1', id: 'pNode3'}]},
      employeeID: {nodes: []},
      supportID: {nodes: [{userName: 'howard', id: 'pNode4'}, {userName: 'support', id: 'pNode5'}]},
    };
    const customerAccessToken = {access_token: 'foo.bar'};
    const userNames = ["howard", "ellen@widget.com", 'john.doe@example.com', 'source1', 'support'];
    const extraUnknownUsers = [];
    for (let i = 0; i < 100; i++) {
      extraUnknownUsers.push(`user-${i}`);
      userNames.push(extraUnknownUsers[i]);
    }

    const mockedJs4meHelper = {
      getGraphQLQuery: jest.fn()
        .mockImplementationOnce(async (descr, token, query, vars) => {
          expect(token).toBe(customerAccessToken);
          expect(query.trim()).toEqual(findPeopleQuery.trim());
          expect(vars).toEqual({names: userNames.slice(0, ReferencesHelper.maxPeopleCount)});
          return queryResult;
        }).mockImplementationOnce(async (descr, token, query, vars) => {
          expect(token).toBe(customerAccessToken);
          expect(query.trim()).toEqual(findPeopleQuery.trim());
          expect(vars).toEqual({names: userNames.slice(ReferencesHelper.maxPeopleCount)});
          return queryResult;
        }),
    };

    const helper = new ReferencesHelper(mockedJs4meHelper);
    const result = await helper.getUserNameToIdMap(userNames, customerAccessToken);

    expect(helper.peopleFound).toBe(result);
    expect(helper.peopleNotFound).toEqual(['john.doe@example.com', ...extraUnknownUsers]);
    expect(Object.fromEntries(result)).toEqual({
                                                 'howard': 'pNode1',
                                                 'ellen@widget.com': 'pNode2',
                                                 'source1': 'pNode3',
                                                 'support': 'pNode5',
                                               });
    expect(mockedJs4meHelper.getGraphQLQuery).toHaveBeenCalledTimes(2);

    // no new calls on new lookup
    const result2 = await helper.getUserNameToIdMap(userNames, customerAccessToken);
    expect(result2).toEqual(result);
    expect(mockedJs4meHelper.getGraphQLQuery).toHaveBeenCalledTimes(2);
  });
});

describe('lookupAllSoftware', () => {
  it('retrieves software', async () => {
    const cis = [
      {id: 'ciNode1', name: 'Microsoft Visual C++ 2010  x86 Redistributable'},
      {id: 'ciNode2', name: ' Google Chrome'},
      {id: 'ciNode3', name: 'Another piece '},
    ];
    const customerAccessToken = {access_token: 'foo.bar'};
    const mockedJs4meHelper = {
      reducePagedGraphQLQuery: jest.fn()
        .mockImplementationOnce(async (descr, token, query, vars) => {
          expect(token).toBe(customerAccessToken);
          expect(query.trim()).toEqual(allSoftwareQuery.trim());
          expect(vars).toEqual({statuses: ReferencesHelper.acceptableSoftwareStatuses})
          return cis;
        }),
    };

    const helper = new ReferencesHelper(mockedJs4meHelper);
    const result = await helper.lookupAllSoftware(customerAccessToken);

    expect(helper.allSoftware).toBe(result);
    expect(result).toEqual([
                             {id: 'ciNode1', name: 'Microsoft Visual C++ 2010 x86 Redistributable'},
                             {id: 'ciNode2', name: 'Google Chrome'},
                             {id: 'ciNode3', name: 'Another piece'},
                           ]);
    expect(mockedJs4meHelper.reducePagedGraphQLQuery).toHaveBeenCalledTimes(1);

    // no new calls on new lookup
    const result2 = await helper.lookupAllSoftware(customerAccessToken);
    expect(result2).toEqual(result);
    expect(mockedJs4meHelper.reducePagedGraphQLQuery).toHaveBeenCalledTimes(1);
  });
});

describe('lookupAllPeople', () => {
  it('retrieves people', async () => {
    const people = [
      {id: 'pNode1', primaryEmail: 'howard@widget.com'},
      {id: 'pNode2', supportID: '1234'},
      {id: 'pNode3', employeeID: '567'},
      {id: 'pNode4', authenticationID: '1234'},
      {id: 'pNode5', sourceID: '567'},
      {
        id: 'pNode6',
        primaryEmail: 'howard@widget.com',
        supportID: '1234 ',
        employeeID: ' 567',
        authenticationID: ' addad ',
        sourceID: '5 6  7',
      },
    ];
    const customerAccessToken = {access_token: 'foo.bar'};
    const mockedJs4meHelper = {
      reducePagedGraphQLQuery: jest.fn()
        .mockImplementationOnce(async (descr, token, query) => {
          expect(token).toBe(customerAccessToken);
          expect(query.trim()).toEqual(allPeopleQuery.trim());
          return people;
        }),
    };

    const helper = new ReferencesHelper(mockedJs4meHelper);
    const result = await helper.lookupAllPeople(customerAccessToken);

    expect(helper.allPeople).toBe(result);
    expect(result).toEqual([
                             {id: 'pNode1', primaryEmail: 'howard@widget.com'},
                             {id: 'pNode2', supportID: '1234'},
                             {id: 'pNode3', employeeID: '567'},
                             {id: 'pNode4', authenticationID: '1234'},
                             {id: 'pNode5', sourceID: '567'},
                             {
                               id: 'pNode6',
                               primaryEmail: 'howard@widget.com',
                               supportID: '1234 ',
                               employeeID: ' 567',
                               authenticationID: ' addad ',
                               sourceID: '5 6  7',
                             },
                           ]);
    expect(mockedJs4meHelper.reducePagedGraphQLQuery).toHaveBeenCalledTimes(1);

    // no new calls on new lookup
    const result2 = await helper.lookupAllPeople(customerAccessToken);
    expect(result2).toEqual(result);
    expect(mockedJs4meHelper.reducePagedGraphQLQuery).toHaveBeenCalledTimes(1);
  });
});
