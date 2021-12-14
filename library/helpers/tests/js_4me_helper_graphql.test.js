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

  describe('paged results', () => {
    test('single page', async () => {
      const response = {
        status: 200,
        data: {
          data: {
            "products": {
              "pageInfo": {hasNextPage: false, endCursor: null},
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

      const query = `query($previousEndCursor: String){
      products(first: 10, after: $previousEndCursor) {
        pageInfo { hasNextPage endCursor }
        nodes { id name }
      }}`;
      const vars = {filter: {name: {values: ["a", "b"]}}};

      axios.post.mockImplementationOnce(async (url, content) => {
        expect(url).toBe('/');
        expect(content).toEqual({
                                  query: query,
                                  variables: {...vars, previousEndCursor: null},
                                });
        return response;
      });

      const memoObject = {myMemo: true};
      let allProducts = [];
      let indices = [];
      const handler = (currentResults, queryResult, index) => {
        indices.push(index);
        expect(currentResults).toBe(memoObject);
        const connection = queryResult.products;
        allProducts = [...allProducts, ...connection.nodes];
        return queryResult;
      };

      const jsHelper = new Js4meHelper('4me-demo.com', 'wdc');
      expect(await jsHelper.getPagedGraphQLQuery('test query', 'token', query, vars, handler, memoObject))
        .toEqual(response.data.data);
      expect(indices).toEqual([1]);
      expect(allProducts).toEqual([{
        id: "NG1lLXN0YWdpbmcuY29tL1Byb2R1Y3QvMjY3",
        name: "AWS S3 Bucket",
      }]);
    });

    test('multiple pages', async () => {
      const response1 = {
        status: 200,
        data: {
          data: {
            "products": {
              "pageInfo": {hasNextPage: true, endCursor: "abdvcd"},
              "nodes": [{
                "id": "a",
                "name": "AWS S3 Bucket",
              }]
            }
          },
        }
      };
      const response2 = {
        status: 200,
        data: {
          data: {
            "products": {
              "pageInfo": {hasNextPage: false, endCursor: null},
              "nodes": [{
                "id": "b",
                "name": "AWS Lambda",
              }]
            }
          },
        }
      };
      axios.create.mockReturnThis();

      const query = `query($previousEndCursor: String){
      products(first: 1, after: $previousEndCursor) {
        pageInfo { hasNextPage endCursor }
        nodes { id name }
      }}`;
      const vars = {filter: {name: {values: ["c", "d"]}}};

      axios.post.mockImplementationOnce(async (url, content) => {
        expect(url).toBe('/');
        expect(content).toEqual({
                                  query: query,
                                  variables: {...vars, previousEndCursor: null},
                                });
        return response1;
      }).mockImplementationOnce(async (url, content) => {
        expect(url).toBe('/');
        expect(content).toEqual({
                                  query: query,
                                  variables: {...vars, previousEndCursor: "abdvcd"},
                                });
        return response2;
      });

      const memoObject = {myMemo: true};
      let allProducts = [];
      let indices = [];
      const handler = (currentResults, queryResult, index) => {
        indices.push(index);
        if (index === 1) {
          expect(currentResults).toBe(memoObject);
        } else {
          expect(currentResults).toBe(response1.data.data);
        }
        const connection = queryResult.products;
        allProducts = [...allProducts, ...connection.nodes];

        return queryResult;
      };

      const jsHelper = new Js4meHelper('4me-demo.com', 'wdc');
      expect(await jsHelper.getPagedGraphQLQuery('test query', 'token', query, vars, handler, memoObject))
        .toEqual(response2.data.data);
      expect(indices).toEqual([1, 2]);
      expect(allProducts).toEqual([{
        id: "a",
        name: "AWS S3 Bucket",
      }, {
        id: "b",
        name: "AWS Lambda",
      }]);
    });

    test('stops on error', async () => {
      const response = {
        status: 200,
        data: {
          errors: {message: 'broken'},
        }
      };
      axios.create.mockReturnThis();

      const query = `query($previousEndCursor: String){
      products(first: 1, after: $previousEndCursor) {
        pageInfo { hasNextPage endCursor }
        nodes { id name }
      }}`;
      const vars = {filter: {name: {values: ["e", "f"]}}};

      axios.post.mockImplementationOnce(async (url, content) => {
        expect(url).toBe('/');
        expect(content).toEqual({
                                  query: query,
                                  variables: {...vars, previousEndCursor: null},
                                });
        return response;
      });

      let allResults = [];
      let indices = [];
      const handler = (currentResults, queryResult, index) => {
        indices.push(index);
        allResults.push(queryResult);
        return {error: 'Boom'};
      };

      const jsHelper = new Js4meHelper('4me-demo.com', 'wdc');
      expect(await jsHelper.getPagedGraphQLQuery('test query', 'token', query, vars, handler))
        .toEqual({error: 'Boom'});
      expect(indices).toEqual([1]);
      expect(allResults).toEqual([{error: 'Unable to query test query #1'}]);
    });
  });
});
