'use strict';

const LambdaContextMocker = require('./lambda_context_mocker');

const Js4meHelper = require('../../../helpers/js_4me_helper');
jest.mock('../../../helpers/js_4me_helper');

const secretsHelperMock = require('../../../helpers/tests/secrets_helper_mock');
const app = require('../app.js');

process.env.PARAM_4ME_DOMAIN = '4me-staging.com';
process.env.PARAM_BOOTSTRAP_APP = 'my-app';
process.env.PARAM_BOOTSTRAP_ACCOUNT = 'not-default';

const context = {invokedFunctionArn: 'arn:aws:lambda:eu-west-1:123456789012:function:app-builder-4me-IntegrationFunction-1R4T4QRNEPMP5'};
const event = {
    resource: "/secrets",
    path: "/secrets/",
    httpMethod: 'POST',
    headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Host": "cr0pj0mkoh.execute-api.eu-west-1.amazonaws.com",
        "Link": "<https://wdc.4me-staging.com/integration_instances/1>; rel=\"canonical\", <https://api.4me-staging.com/v1/integration_instances/1>; rel=\"resource\"",
        "User-Agent": "4me/1.0 (https://developer.4me.com/v1/webhooks)",
        "X-4me-Delivery": "00c7bb4a-b3ba-4744-8126-1e7ef87ef90a",
    },
    body: "{\"jwt\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJkYXRhIjp7IndlYmhvb2tfaWQiOjcsIndlYmhvb2tfbm9kZUlEIjoiTkcxbExYTjBZV2RwYm1jdVkyOXRMMWRsWW1odmIyc3ZOdyIsImFjY291bnRfaWQiOiJ3ZGMiLCJhY2NvdW50IjoiaHR0cHM6Ly93ZGMuNG1lLXN0YWdpbmcuY29tIiwibmFtZSI6ImludGVncmF0aW9uX2luc3RhbmNlLnNlY3JldHMtdXBkYXRlIiwiZXZlbnQiOiJpbnRlZ3JhdGlvbl9pbnN0YW5jZS5zZWNyZXRzLXVwZGF0ZSIsIm9iamVjdF9pZCI6MSwib2JqZWN0X25vZGVJRCI6Ik5HMWxMWE4wWVdkcGJtY3VZMjl0TDBsdWRHVm5jbUYwYVc5dVNXNXpkR0Z1WTJVdk1RIiwicGVyc29uX2lkIjo2LCJwZXJzb25fbm9kZUlEIjoiTkcxbExYTjBZV2RwYm1jdVkyOXRMMUJsY25OdmJpODIiLCJwZXJzb25fbmFtZSI6Ikhvd2FyZCBUYW5uZXIiLCJwYXlsb2FkIjp7ImF1ZGl0X2xpbmVfaWQiOjQ4Mjg5LCJhdWRpdF9saW5lX25vZGVJRCI6Ik5HMWxMWE4wWVdkcGJtY3VZMjl0TDBGMVpHbDBUR2x1WlM4ME9ESTRPUSIsImludGVncmF0aW9uIjp7InJlZmVyZW5jZSI6IndkY19zaWViZWwiLCJpZCI6MSwibm9kZUlEIjoiTkcxbExYTjBZV2RwYm1jdVkyOXRMMGx1ZEdWbmNtRjBhVzl1THpFIn0sImN1c3RvbWVyX2FjY291bnRfaWQiOiJ3ZGMiLCJhcHBsaWNhdGlvbiI6eyJub2RlSUQiOiJORzFsTFhOMFlXZHBibWN1WTI5dEwwOWhkWFJvUVhCd2JHbGpZWFJwYjI0dk1nIiwiY2xpZW50X2lkIjoiS0RpdFRzM3JrZmg2WVF4dTlwa05hd1J6eUpDWTQ4MHRmZXNUc0lpUDZFajMyM1ZuIiwiY2xpZW50X3NlY3JldCI6IjY5RTRXQU5pUmRwS0F2N3dzNVpzTlk3TkkwdHRHNUJ0eDZWQkg1S2ZWMDNacmtLcE4wTkduNEVVQjBEYmlwUHkifX19LCJqdGkiOiJkNmM5NmIxMzdlMTdhYjZiMTMwZjlhYjdjOGFmOTJhNGZhOTAxMmYyODNlYmRiOTUyMTU2YWM5NDRlNWZlNTVmIiwic3ViIjoiNyIsImlzcyI6Imh0dHBzOi8vd2RjLjRtZS1zdGFnaW5nLmNvbSIsIm5iZiI6MTYxNDY4MDYzOCwiaWF0IjoxNjE0NjgwNjM4LCJhdWQiOiJpbnRlZ3JhdGlvbnMgcHJvdmlkZWQgYnkgd2RjQDRtZS1zdGFnaW5nLmNvbSJ9.kX2WUj0tiOvUOTVi6NdAP5edQFCJSb5-GRPIReeJilPdmP40JuDeSTfrnk4s2yhPx25pwKDhDXqYeBYmT6A8_ENq_6fNwrk6EVRMwrmL-48s9izkLcsn_wLMm9NngqrCaSHYlJpjJJ0VyJPkgmnQs287rH7skUQU_mTKepw4Gj5EMZnzj_BAPGRleh53HHX5AEcxhCZIpvBNprPDmvnDRhdkII7z20pioJS-3q_T-6Kuj4iwL3kH8CU6R11oqB0hPc-kCafrBC-44fHxdXVk3MVJ8OZv7Get-M-44oTHJDjVibI6tDVRruIG4rQ-agYFj0Ingjy8ILmwqRq27zmX_g\"}",
};
const parsedBody = JSON.parse(event.body);

const mockedSecrets = {
  clientID: "gsfsdfksdfgjsl",
  token: "bgjdgufyernilh98uxfvnjdfgd",
  policy: {
    "id": "NG1lLXN0YWdpbmcuY29tL1dlYmhvb2tQb2xpY3kvMw",
    "name": "d66558a5b89321cc5875b0eb2318b939511d11946e321550ceecc880",
    "jwtAlg": "rs256",
    "jwtAudience": "integrations provided by wdc@4me-staging.com",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArCHQIS/Fscz5jBsw0cLL\niZrfdb3kKeB1hzXghFiuam19VuYZ3a8Im7oMvYQxCaGH97IIOHRx6GxA6Seyk2Pi\n7a2nKNAMmRvN3T0i/0DTLJOquBLkJHlsK1RrEvzhNILdCDBRMHohM+RXE84cfmpI\n+GVTPCBPLruojEhSirVhfI1DUpLTvvn8Igab3hDasq+7NynQ2ixm/tuZ3myZt7IQ\n+naEO+CI75GFsTeRCItsyly8Doqfkg3Vq2J0fj9+U/YTEPoH1D/xZYmw8gkXnNcO\nxpGtnYF65knZL3zIqUSelFa0Rn7iTdweT1InKVKFS894K9AoHeSBbPiITqbcO1ER\nXwIDAQAB\n-----END PUBLIC KEY-----\n"
  }
};
const lambdaContextMocker = new LambdaContextMocker();
lambdaContextMocker.providerSecrets = mockedSecrets;

it('handles receiving application', async () => {
  const mockGetSecrets = secretsHelperMock.once('getSecrets', async () => mockedSecrets);
  const mockUpsertSecret = secretsHelperMock.once('upsertSecret', async (acc, newSecrets) => {
    return {secrets: {...mockedSecrets, ...newSecrets}};
  });

  const mockedPayload = require('../../events/secret-scope-only.jwt-data.json');

  Js4meHelper.mockImplementation(() => {
    return {
      getDelivery: (e) => {
        expect(e).toBe(event);
        return '00c7bb4a-b3ba-4744-8126-1e7ef87ef90a';
      },
      get4meData: async (jwt) => {
        expect(jwt).toBe(parsedBody.jwt)
        return mockedPayload;
      }
    };
  });

  expect(await app.lambdaHandler(event, context))
    .toEqual({
               'statusCode': 200,
               'body': JSON.stringify({
                                        message: 'Secrets stored',
                                      })
             });

  expect(secretsHelperMock.constructor()).toHaveBeenCalledWith(null, '4me-staging.com', 'my-app');
  expect(mockGetSecrets).toHaveBeenCalledWith('not-default');

  lambdaContextMocker.checkProvider4meHelperCreated();

  expect(secretsHelperMock.constructor()).toHaveBeenCalledWith(null, '4me-staging.com', 'my-app/wdc_siebel');
  expect(mockUpsertSecret).toHaveBeenCalledWith('instances/wdc', {
    "application": {
      "nodeID": "NG1lLXN0YWdpbmcuY29tL09hdXRoQXBwbGljYXRpb24vMg",
      "client_id": "KDitTs3rkfh6YQxu9pkNawRzyJCY480tfesTsIiP6Ej323Vn",
      "client_secret": "69E4WANiRdpKAv7ws5ZsNY7NI0ttG5Btx6VBH5KfV03ZrkKpN0NGn4EUB0DbipPy"
    }
  });
});

it('handles receiving policy', async () => {
  const mockGetSecrets = secretsHelperMock.once('getSecrets', async () => mockedSecrets);
  const mockUpsertSecret = secretsHelperMock.once('upsertSecret', async (acc, newSecrets) => {
    return {secrets: {...mockedSecrets, ...newSecrets}};
  });

  const mockedPayload = require('../../events/secret-policy-only.jwt-data.json');

  Js4meHelper.mockImplementation(() => {
    return {
      getDelivery: (e) => {
        expect(e).toBe(event);
        return '00c7bb4a-b3ba-4744-8126-1e7ef87ef90a';
      },
      get4meData: async (jwt) => {
        expect(jwt).toBe(parsedBody.jwt)
        return mockedPayload;
      }
    };
  });

  expect(await app.lambdaHandler(event, context))
    .toEqual({
               'statusCode': 200,
               'body': JSON.stringify({
                                        message: 'Secrets stored',
                                      })
             });

  expect(secretsHelperMock.constructor()).toHaveBeenCalledWith(null, '4me-staging.com', 'my-app');
  expect(mockGetSecrets).toHaveBeenCalledWith('not-default');

  lambdaContextMocker.checkProvider4meHelperCreated();

  expect(secretsHelperMock.constructor()).toHaveBeenCalledWith(null, '4me-staging.com', 'my-app/typeform');
  expect(mockUpsertSecret).toHaveBeenCalledWith('instances/wdc-test', {
    "policy": {
      "nodeID": "NG1lLXN0YWdpbmcuY29tL1dlYmhvb2tQb2xpY3kvNQ",
      "audience": null,
      "algorithm": "RS256",
      "public_key": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAs7NgfD+LUikVVUTPhPZk\nkmcvAf1CIOcWpIlWAT5NL3Qy3DBD02M01dCe13FKVSHHq0CZnYbqRaoNr1zdycf2\nEPZgahQ0EcF1lZFOSCx2+L8tZccSlj3+YNvIqarD3k3CepNDxib8kF0rWZxC4c54\nkTuCfHU+qMBtSbavFjl+jD3dFDkQrlJHDHY6k49C+0kfvKDlqKScKtGatuX7uVyc\nfj32wegx/q4hkspb9sfvIJTmOC5t2kDLFOYA/bhihtWsrPboVcJI1IjnhZ9Dag6X\nY7IndRMOsnQQS5I9ELAEoaw/W95A0OIJdWq4IFceOkmlhBb6G6Iw7BrM64Pn/nFl\nEwIDAQAB\n-----END PUBLIC KEY-----\n"
    }
  });
});
