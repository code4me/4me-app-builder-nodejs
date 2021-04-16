'use strict';

const NotesHelper = require('../notes_helper');
const Js4meHelper = require('../../../../library/helpers/js_4me_helper');
jest.mock('../../../../library/helpers/js_4me_helper');

const accessToken = {access_token: 'howard.tanner'};
const reqId = 12;
const reqNodeID = 'abc';
const note = 'test note';
const notesHelper = new NotesHelper();

it('converts requestId to nodeID before adding note', async () => {
  const getRequestCallResult = {requests: {nodes: [{id: reqNodeID}]}};
  const updateRequestCallResult = {request: {id: reqNodeID}};

  Js4meHelper.mockImplementation(() => {
    return {
      getGraphQLQuery: async (descr, token, query, vars) => {
        expect(token).toBe(accessToken);
        expect(vars).toEqual({requestId: `${reqId}`});
        return getRequestCallResult;
      },
      executeGraphQLMutation: async (descr, token, query, vars) => {
        expect(token).toBe(accessToken);
        expect(vars).toEqual({input: {id: reqNodeID, note: note}});
        return updateRequestCallResult;
      },
    };
  });
  const js4meHelper = new Js4meHelper();

  expect(await notesHelper.addNote(js4meHelper, accessToken, reqId, note))
    .toEqual(updateRequestCallResult.request)
});

it('detects error when getting request nodeID', async () => {
  const getRequestCallResult = {error: 'oops'};

  Js4meHelper.mockImplementation(() => {
    return {
      getGraphQLQuery: async (descr, token, query, vars) => {
        return getRequestCallResult;
      },
    };
  });
  const js4meHelper = new Js4meHelper();

  expect(await notesHelper.addNote(js4meHelper, accessToken, reqId, note))
    .toEqual(getRequestCallResult)
});

it('handles request not found', async () => {
  const getRequestCallResult = {requests: {nodes: []}};

  Js4meHelper.mockImplementation(() => {
    return {
      getGraphQLQuery: async (descr, token, query, vars) => {
        return getRequestCallResult;
      },
    };
  });
  const js4meHelper = new Js4meHelper();

  expect(await notesHelper.addNote(js4meHelper, accessToken, reqId, note))
    .toEqual({error: 'Request 12 not found'})
});

it('detects error when updating request', async () => {
  const getRequestCallResult = {requests: {nodes: [{id: reqNodeID}]}};
  const updateRequestCallResult = {error: 'oops'};

  Js4meHelper.mockImplementation(() => {
    return {
      getGraphQLQuery: async (descr, token, query, vars) => {
        return getRequestCallResult;
      },
      executeGraphQLMutation: async (descr, token, query, vars) => {
        return updateRequestCallResult;
      },
    };
  });
  const js4meHelper = new Js4meHelper();

  expect(await notesHelper.addNote(js4meHelper, accessToken, reqId, note))
    .toEqual(updateRequestCallResult)
});
