'use strict';

class NotesHelper {

  async addNote(js4meHelper, accessToken, requestId, note) {
    const requestNodeID = await this.getRequestNodeID(js4meHelper, accessToken, requestId);
    if (requestNodeID && !requestNodeID.error) {
      return await this.addNoteToRequest(js4meHelper, accessToken, requestNodeID, note);
    }
    return requestNodeID;
  }

  async addNoteToRequest(js4meHelper, accessToken, requestId, note) {
    const input = {
      id: requestId,
      note: note,
    };
    const result = await js4meHelper.executeGraphQLMutation('Add note to request',
                                                            accessToken, `
      mutation($input: RequestUpdateInput!) {
        requestUpdate(input: $input) {
          errors { path  message }
          request { id }
        }
      }`,
                                                            {
                                                              input: input,
                                                            });
    if (result.error) {
      this.error('Unable to add note: %j', result.error);
      return result;
    }
    return result.request;
  }

  async getRequestNodeID(js4meHelper, accessToken, requestId) {
    const result = await js4meHelper.getGraphQLQuery('get request nodeID',
                                                     accessToken, `
      query($requestId: String!) {
        requests(first: 1, filter: { requestId: { values: [$requestId] } } ) {
          nodes { id }
        }
      }`,
                                                     {requestId: `${requestId}`});
    if (result.error) {
      this.error('%j', result);
      return result;
    } else {
      const nodes = result.requests.nodes;
      if (!nodes || nodes.length === 0) {
        return {error: `Request ${requestId} not found`};
      }
      return nodes[0].id;
    }
  }

  log(message, ...data) {
    if (data && data.length > 0) {
      console.log(message, ...data);
    } else {
      console.log(message);
    }
  }

  error(message, ...data) {
    if (data && data.length > 0) {
      console.error(message, ...data);
    } else {
      console.error(message);
    }
  }
}

module.exports = NotesHelper;