'use strict';

const axios = require('axios')
jest.mock('axios');

const Js4meHelper = require('../js_4me_helper');

describe('GraphQL calls', () => {

  test('successful call', async () => {
    const response = {
      status: 200,
      data: {
        data: {
          "products": {
            "nodes": [
              {
                "id": "NG1lLXN0YWdpbmcuY29tL1Byb2R1Y3QvMjY3",
                "name": "AWS S3 Bucket",
              }
            ]
          }
        },
      }
    };
    axios.create.mockReturnThis();

    const query = `{
      products(first: 1, filter: {name: {values: ["AWS S3 Bucket"]}}) {
        nodes {
          id
          name
        }
      }}`;
    const vars = {};

    axios.post.mockImplementationOnce(async (url, content) => {
      expect(url).toBe('/');
      expect(content).toEqual({
                                query: query,
                                variables: vars,
                              });
      return response;
    });

    const jsHelper = new Js4meHelper('4me-demo.com', 'wdc');
    expect(await jsHelper.getGraphQLQuery('test query', 'token', query, vars))
      .toEqual(response.data.data);
  });

  test('failed call', async () => {
    const response = {
      status: 200,
      data: {
        "errors":
          [
            {
              "message": "Argument 'id' on InputObject 'RequestUpdateInput' has an invalid value (null). Expected type 'ID!'.",
              "locations": [
                {
                  "line": 2,
                  "column": 24
                }
              ],
              "path": [
                "mutation",
                "requestUpdate",
                "input",
                "id"
              ],
              "extensions": {
                "code": "argumentLiteralsIncompatible",
                "typeName": "InputObject",
                "argumentName": "id"
              }
            }
          ]
      }
    };
    axios.create.mockReturnThis();

    const query = `
      mutation {
        requestUpdate(input: {id: null}) {
          errors {
            message
            path
          }
          request {
            id
          }
        }
      }`;
    const vars = {};

    axios.post.mockImplementationOnce(async (url, content) => {
      expect(url).toBe('/');
      expect(content).toEqual({
                                query: query,
                                variables: vars,
                              });
      return response;
    });

    const jsHelper = new Js4meHelper('4me-demo.com', 'wdc');
    expect(await jsHelper.getGraphQLQuery('test query', 'token', query, vars))
      .toEqual({"error": "Unable to query test query"});
  });
});
