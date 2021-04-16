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
        "Link": "<https://wdc.4me-staging.com/webhooks/1>; rel=\"canonical\", <https://api.4me-staging.com/v1/webhooks/1>; rel=\"resource\"",
        "X-4me-Delivery": "8fd93dc6-1d43-49c2-892e-2ab5cb029e4e",
    },
    body: '{ "jwt": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJkYXRhIjp7IndlYmhvb2tfaWQiOjEsIndlYmhvb2tfbm9kZUlEIjoiTkcxbExYTjBZV2RwYm1jdVkyOXRMMWRsWW1odmIyc3ZNUSIsImFjY291bnRfaWQiOiJ3ZGMiLCJhY2NvdW50IjoiaHR0cHM6Ly93ZGMuNG1lLXN0YWdpbmcuY29tIiwibmFtZSI6ImludGVncmF0aW9uX2luc3RhbmNlLnNlY3JldHMtdXBkYXRlIiwiZXZlbnQiOiJ3ZWJob29rLnZlcmlmeSIsIm9iamVjdF9pZCI6MSwib2JqZWN0X25vZGVJRCI6Ik5HMWxMWE4wWVdkcGJtY3VZMjl0TDFkbFltaHZiMnN2TVEiLCJwZXJzb25faWQiOjU5MSwicGVyc29uX25vZGVJRCI6Ik5HMWxMWE4wWVdkcGJtY3VZMjl0TDFCbGNuTnZiaTgxT1RFIiwicGVyc29uX25hbWUiOiJQbHVnZ2FibGUgSW50ZWdyYXRpb25zIiwicGF5bG9hZCI6eyJjYWxsYmFjayI6Imh0dHBzOi8vd2RjLjRtZS1zdGFnaW5nLmNvbS93ZWJob29rcy8xL3ZlcmlmeT9jb2RlPUZUaEVyWmUyUnI4d1ZCbnMtN2xhbEFUUCZleHBpcmVzX2F0PTE2MTQ2ODY4MzEifX0sImp0aSI6Ijk2MTE5YjU1ODk0M2FjZGVjYjAwMWI3NWQ5ZWVlNzgxNDc5YjdkOWVmZTQwMjVjYjE0NjExYjg2OGE0ZjQwN2IiLCJzdWIiOiIxIiwiaXNzIjoiaHR0cHM6Ly93ZGMuNG1lLXN0YWdpbmcuY29tIiwibmJmIjoxNjE0NjAwNDMxLCJpYXQiOjE2MTQ2MDA0MzEsImF1ZCI6ImludGVncmF0aW9ucyBwcm92aWRlZCBieSB3ZGNANG1lLXN0YWdpbmcuY29tIn0.mIBnKhjnnanciVjWMH7KybfLkwEkWNF_EF6onTmy561u2oWo52M0CQIPUzbgofKAKlAV5OH1K22BybbWw-iZqJ_EdG-a_ScrCMraOuSpnyw3osKZFe7-zEjJayWEQ735YQe1ewpTlhlDejbluSMPc-DN2sz2D02c8n956Vw_psvNlnkvmSZKaDiEYtiYOM3pfkLDlEZQCVZWHhXrsYoF53LYt39v3T9FL6Gf-A1MRNrA_SVfmfqyq9a6bXUKigsZwYB-IuxnwGNqfQSScVTLZg0DXD79WMGsTUskHmOKtWTxzJgX9fuOfMQXXjhzIArhzv7rJBB9crYRgaRX_A89QQ" }',
};
const parsedBody = JSON.parse(event.body);

const mockedSecrets = {
    clientID: "gsfsdfksdfgjsl",
    token: "bgjdgufyernilh98uxfvnjdfgd",
    policy: {
        "id": "NG1lLXN0YWdpbmcuY29tL1dlYmhvb2tQb2xpY3kvMQ",
        "name": "74fd43291676d0bca58778308e051a7897f5126aee8c8b85fc75b824",
        "jwtAlg": "rs256",
        "jwtAudience": "integrations provided by wdc@4me-staging.com",
        "publicKeyPem": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAy9fjABWXf6pLxTq1evjZ\ntyLHX045iIhnM4W4T4vslOFQ2bUGoYM6600qaD4WZFj4o1oDIP/wCm2TXG5VFRPS\nBSJtCbITfYKoRt7DoSLwPs+H63OhhfA/m7v4ePummqFGYK6SxVQRhdZo9Vm7Kf0A\nvadc8wtr/YyHb3OJ14UxmktS0YwlSOX3+844SWUnjjL9/PAykVFznFHlyLf/sSGz\nBVx+6jsRYKs5+P0BDOoTQjoRxagX3RrOWhl4oF17cvefoO5Iqd+UppnhQzJnNdsM\nGn27BWJzgdN7PM2+PItRJuRuRYC/IvIOw1CXEFur/wrU3oaMGunU9IXgxSfxIwUq\nKwIDAQAB\n-----END PUBLIC KEY-----\n"
    }
};
const lambdaContextMocker = new LambdaContextMocker();
lambdaContextMocker.providerSecrets = mockedSecrets;

const axios = require('axios')
jest.mock('axios');

test('handles verification of webhook', async () => {
    const mockGetSecrets = secretsHelperMock.once('getSecrets', async () => mockedSecrets);
    const mockedPayload = require('../../events/verification.jwt-data.json');
    Js4meHelper.mockImplementation(() => {
        return {
            getDelivery: (e) => {
                expect(e).toBe(event);
                return '8fd93dc6-1d43-49c2-892e-2ab5cb029e4e';
            },
            get4meData: async (jwt) => {
                expect(jwt).toBe(parsedBody.jwt)
                return mockedPayload;
            }
        };
    });

    const response = {
        status: 200,
    };
    axios.get.mockImplementationOnce(async () => response);

    expect(await app.lambdaHandler(event, context)).toEqual({
                                                                'statusCode': 200,
                                                                'body': JSON.stringify({
                                                                                           message: 'Webhook verified',
                                                                                       })
                                                            });

    expect(secretsHelperMock.constructor()).toHaveBeenCalledWith(null, '4me-staging.com', 'my-app');
    expect(mockGetSecrets).toHaveBeenCalledWith('not-default');
    lambdaContextMocker.checkProvider4meHelperCreated();
    expect(Js4meHelper.mock.calls.length).toBe(1);
    expect(axios.get).toHaveBeenCalledWith(mockedPayload.payload.callback);
});

test('handles failed verification of webhook', async () => {
    const mockGetSecrets = secretsHelperMock.once('getSecrets', async () => mockedSecrets);
    const mockedPayload = require('../../events/verification.jwt-data.json');
    Js4meHelper.mockImplementation(() => {
        return {
            getDelivery: (e) => {
                expect(e).toBe(event);
                return '8fd93dc6-1d43-49c2-892e-2ab5cb029e4e';
            },
            get4meData: async (jwt) => {
                expect(jwt).toBe(parsedBody.jwt)
                return mockedPayload;
            }
        };
    });

    const response = {
        status: 401,
    };
    axios.get.mockImplementationOnce(async () => response);

    expect(await app.lambdaHandler(event, context)).toEqual({
        'statusCode': 500,
        'body': JSON.stringify({
            message: 'Unable to verify webhook',
        })
    });
    expect(secretsHelperMock.constructor()).toHaveBeenCalledWith(null, '4me-staging.com', 'my-app');
    expect(mockGetSecrets).toHaveBeenCalledWith('not-default');
    expect(Js4meHelper.mock.calls.length).toBe(1);
    expect(axios.get).toHaveBeenCalledWith(mockedPayload.payload.callback);
});
