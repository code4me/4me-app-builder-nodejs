'use strict';

const secretsHelperMock = require('./secrets_helper_mock');
const Js4meHelper = require('../js_4me_helper');

const domain = '4me-staging.com';
const account = 'wdc';
const jwtAudience = 'integrations provided by wdc@4me-staging.com';

const rs256Token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJkYXRhIjp7IndlYmhvb2tfaWQiOjEsIndlYmhvb2tfbm9kZUlEIjoiTkcxbExYTjBZV2RwYm1jdVkyOXRMMWRsWW1odmIyc3ZNUSIsImFjY291bnRfaWQiOiJ3ZGMiLCJhY2NvdW50IjoiaHR0cHM6Ly93ZGMuNG1lLXN0YWdpbmcuY29tIiwibmFtZSI6ImludGVncmF0aW9uX2luc3RhbmNlLnNlY3JldHMtdXBkYXRlIiwiZXZlbnQiOiJ3ZWJob29rLnZlcmlmeSIsIm9iamVjdF9pZCI6MSwib2JqZWN0X25vZGVJRCI6Ik5HMWxMWE4wWVdkcGJtY3VZMjl0TDFkbFltaHZiMnN2TVEiLCJwZXJzb25faWQiOjU5MSwicGVyc29uX25vZGVJRCI6Ik5HMWxMWE4wWVdkcGJtY3VZMjl0TDFCbGNuTnZiaTgxT1RFIiwicGVyc29uX25hbWUiOiJQbHVnZ2FibGUgSW50ZWdyYXRpb25zIiwicGF5bG9hZCI6eyJjYWxsYmFjayI6Imh0dHBzOi8vd2RjLjRtZS1zdGFnaW5nLmNvbS93ZWJob29rcy8xL3ZlcmlmeT9jb2RlPUZUaEVyWmUyUnI4d1ZCbnMtN2xhbEFUUCZleHBpcmVzX2F0PTE2MTQ2ODY4MzEifX0sImp0aSI6Ijk2MTE5YjU1ODk0M2FjZGVjYjAwMWI3NWQ5ZWVlNzgxNDc5YjdkOWVmZTQwMjVjYjE0NjExYjg2OGE0ZjQwN2IiLCJzdWIiOiIxIiwiaXNzIjoiaHR0cHM6Ly93ZGMuNG1lLXN0YWdpbmcuY29tIiwibmJmIjoxNjE0NjAwNDMxLCJpYXQiOjE2MTQ2MDA0MzEsImF1ZCI6ImludGVncmF0aW9ucyBwcm92aWRlZCBieSB3ZGNANG1lLXN0YWdpbmcuY29tIn0.mIBnKhjnnanciVjWMH7KybfLkwEkWNF_EF6onTmy561u2oWo52M0CQIPUzbgofKAKlAV5OH1K22BybbWw-iZqJ_EdG-a_ScrCMraOuSpnyw3osKZFe7-zEjJayWEQ735YQe1ewpTlhlDejbluSMPc-DN2sz2D02c8n956Vw_psvNlnkvmSZKaDiEYtiYOM3pfkLDlEZQCVZWHhXrsYoF53LYt39v3T9FL6Gf-A1MRNrA_SVfmfqyq9a6bXUKigsZwYB-IuxnwGNqfQSScVTLZg0DXD79WMGsTUskHmOKtWTxzJgX9fuOfMQXXjhzIArhzv7rJBB9crYRgaRX_A89QQ';
const rs256Pem = '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAy9fjABWXf6pLxTq1evjZ\ntyLHX045iIhnM4W4T4vslOFQ2bUGoYM6600qaD4WZFj4o1oDIP/wCm2TXG5VFRPS\nBSJtCbITfYKoRt7DoSLwPs+H63OhhfA/m7v4ePummqFGYK6SxVQRhdZo9Vm7Kf0A\nvadc8wtr/YyHb3OJ14UxmktS0YwlSOX3+844SWUnjjL9/PAykVFznFHlyLf/sSGz\nBVx+6jsRYKs5+P0BDOoTQjoRxagX3RrOWhl4oF17cvefoO5Iqd+UppnhQzJnNdsM\nGn27BWJzgdN7PM2+PItRJuRuRYC/IvIOw1CXEFur/wrU3oaMGunU9IXgxSfxIwUq\nKwIDAQAB\n-----END PUBLIC KEY-----\n';
const rs256Alg = 'RS256';

const rs512Token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzUxMiJ9.eyJkYXRhIjp7IndlYmhvb2tfaWQiOjIsIndlYmhvb2tfbm9kZUlEIjoiTkcxbExYTjBZV2RwYm1jdVkyOXRMMWRsWW1odmIyc3ZNZyIsImFjY291bnRfaWQiOiJ3ZGMiLCJhY2NvdW50IjoiaHR0cHM6Ly93ZGMuNG1lLXN0YWdpbmcuY29tIiwibmFtZSI6ImludGVncmF0aW9uX2luc3RhbmNlLnNlY3JldHMtdXBkYXRlIiwiZXZlbnQiOiJ3ZWJob29rLnZlcmlmeSIsIm9iamVjdF9pZCI6Miwib2JqZWN0X25vZGVJRCI6Ik5HMWxMWE4wWVdkcGJtY3VZMjl0TDFkbFltaHZiMnN2TWciLCJwZXJzb25faWQiOjU5MSwicGVyc29uX25vZGVJRCI6Ik5HMWxMWE4wWVdkcGJtY3VZMjl0TDFCbGNuTnZiaTgxT1RFIiwicGVyc29uX25hbWUiOiJQbHVnZ2FibGUgSW50ZWdyYXRpb25zIiwicGF5bG9hZCI6eyJjYWxsYmFjayI6Imh0dHBzOi8vd2RjLjRtZS1zdGFnaW5nLmNvbS93ZWJob29rcy8yL3ZlcmlmeT9jb2RlPUpMamh3b0U0T1BJLThLUlpwaVZXcUgzTCZleHBpcmVzX2F0PTE2MTQ5MzQwODQifX0sImp0aSI6IjkyNzk2MjMzOTI3Yzk4ODNjNjc0NDkwNjBmZTRkMTEyMGU1ZWZkODNmYjVmNTRhYjg5OTVjYTcyMTJkNDgzOTIiLCJzdWIiOiIyIiwiaXNzIjoiaHR0cHM6Ly93ZGMuNG1lLXN0YWdpbmcuY29tIiwibmJmIjoxNjE0ODQ3Njg0LCJpYXQiOjE2MTQ4NDc2ODQsImF1ZCI6ImludGVncmF0aW9ucyBwcm92aWRlZCBieSB3ZGNANG1lLXN0YWdpbmcuY29tIn0.clU6k1Ow0koB11Dy-yFMXv6bM6MAXKXo1gMsLCnYcagS10mTQoFkPsOmAnIrorEemcA_6BIsMq2pelNKU4UYv7WFLf6m-klkbSiHbsj-52YbjvLCnmcxoDf71B-QgpUmHYf_tAg_4H5-VIzebUpU4QJppCWcnKO9o2PFwQo_r8EJ8cl0-bu9DbgI1LGNiQpbZ3k3mlmlK-fG8jJg9uHovM1TbhTzTl3rJqrzY-OZZ8C8NNszIUtQSxKPCRyXT0-7f7WMChDlXrnaK2dtOXKah6GBe6LUXnCIu-8SCuW1dUpEnBwRJqghX5cMm-ayzRRYJr8h-1Bvr5wJkT4AKr8Rmg';
const rs512Pem = '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxUc6YTMh+GXJxE8Xpb4q\n2cLov5uYZ5yrJorp7OFTlzRkytxVaRXXZ0dwF4XFnefOm58WuOMgy1X73LF3ASKH\naiNgoq4k96XaCqlaaPB97S6OW4EDmMEF+zAGhn/nfxzcxJ2c4pdNrYfYVdf4BwDD\nCb2B4LFObNmS+WBCrPsp5YTu9VNrhl9/p5KWT8eUl1nEoTCbQDi6xq1dmTeOJrU9\n9VcikLWyJT2defKXFPJ01nTKBfWNozN++8QDZh82Tj7JgGzpcKytVre2pVGVdmtD\nkf9sNy3H50tAaiUm7/TCGj7cE650kQqXB0hAe5aZYXhzpYbVMtw8htlPUowHWbtE\nwwIDAQAB\n-----END PUBLIC KEY-----\n';
const rs512Alg = 'RS512';

const es512Token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzUxMiJ9.eyJkYXRhIjp7IndlYmhvb2tfaWQiOjMsIndlYmhvb2tfbm9kZUlEIjoiTkcxbExYTjBZV2RwYm1jdVkyOXRMMWRsWW1odmIyc3ZNdyIsImFjY291bnRfaWQiOiJ3ZGMiLCJhY2NvdW50IjoiaHR0cHM6Ly93ZGMuNG1lLXN0YWdpbmcuY29tIiwibmFtZSI6ImludGVncmF0aW9uX2luc3RhbmNlLnNlY3JldHMtdXBkYXRlIiwiZXZlbnQiOiJ3ZWJob29rLnZlcmlmeSIsIm9iamVjdF9pZCI6Mywib2JqZWN0X25vZGVJRCI6Ik5HMWxMWE4wWVdkcGJtY3VZMjl0TDFkbFltaHZiMnN2TXciLCJwZXJzb25faWQiOjU5MSwicGVyc29uX25vZGVJRCI6Ik5HMWxMWE4wWVdkcGJtY3VZMjl0TDFCbGNuTnZiaTgxT1RFIiwicGVyc29uX25hbWUiOiJQbHVnZ2FibGUgSW50ZWdyYXRpb25zIiwicGF5bG9hZCI6eyJjYWxsYmFjayI6Imh0dHBzOi8vd2RjLjRtZS1zdGFnaW5nLmNvbS93ZWJob29rcy8zL3ZlcmlmeT9jb2RlPVUyTjM1T3Ffa3JkZktnRkYwc0M0dHNYTSZleHBpcmVzX2F0PTE2MTQ5MzUxNjQifX0sImp0aSI6IjI0Nzg0ZmUxNjM0ZDk1NzU0ZmEzMGEyMGFmMWZhNDc0ZjNjODgyOWE3OTZlMzlkMWI2OGI2MGNhZDFhZDJhMzEiLCJzdWIiOiIzIiwiaXNzIjoiaHR0cHM6Ly93ZGMuNG1lLXN0YWdpbmcuY29tIiwibmJmIjoxNjE0ODQ4NzY0LCJpYXQiOjE2MTQ4NDg3NjQsImF1ZCI6ImludGVncmF0aW9ucyBwcm92aWRlZCBieSB3ZGNANG1lLXN0YWdpbmcuY29tIn0.AUH4wS5HN4niHtG4jhAiO4TzAXVGiOcdowhJjX-LXr3DJW_8uxc4OWMkuOvP1hIULowsFWaEAwtHPnxPl8wz-VQNAXYpY_grtdXX9dlgp0WbY9n6fBd6Hrywg1fGiI_Uw36FbBIihMe3qTT8c3HRbYso_7nlHDUiO5vnZWHOCOhFl_2G';
const es512Pem = '-----BEGIN EC PRIVATE KEY-----\nMIHcAgEBBEIAJEdjbBWlqziCZqr6Eqk1RKoFSh8XAzcbBU6Oe/3v3VBNSM/y86jb\nkuB0EFM0xDxKDgLNQSmAU+dO0KgCkPOrVT2gBwYFK4EEACOhgYkDgYYABAEZl9/T\nBwPGzNJx0y6wsEhGVjaJsIH02Ml/TELAUinZmFkf3D0xN6oswkOvuiWPg2WfIo5h\nNMNR1hJxZZDHUwLKYwC8lICvu18p7cH0xAwMou9NElofm93mzdhqS89uBXZVu6Qs\n6N7JBEkuoI0OKUKJ8+rnnYbeLQoQSnvV3Hs1B3ym/g==\n-----END EC PRIVATE KEY-----\n';
const es512Alg = 'ES512';

describe('JWT validation success', () => {
    test('handles JWT verification with rs256', async () => {
        const accountHelper = new Js4meHelper(domain, account, null, null, rs256Alg, rs256Pem, jwtAudience);

        const data = await accountHelper.get4meData(rs256Token);
        expect(data.webhook_nodeID).toBe('NG1lLXN0YWdpbmcuY29tL1dlYmhvb2svMQ');
        expect(data.person_name).toBe('Pluggable Integrations');
    });

    test('handles JWT verification with rs512', async () => {
        const accountHelper = new Js4meHelper(domain, account, null, null, rs512Alg, rs512Pem, jwtAudience);

        const data = await accountHelper.get4meData(rs512Token);
        expect(data.webhook_nodeID).toBe('NG1lLXN0YWdpbmcuY29tL1dlYmhvb2svMg');
        expect(data.person_name).toBe('Pluggable Integrations');
    });

    test('handles JWT verification with es512', async () => {
        const accountHelper = new Js4meHelper(domain, account, null, null, es512Alg, es512Pem, jwtAudience);

        const data = await accountHelper.get4meData(es512Token);
        expect(data.webhook_nodeID).toBe('NG1lLXN0YWdpbmcuY29tL1dlYmhvb2svMw');
        expect(data.person_name).toBe('Pluggable Integrations');
    });
});

describe('JWT verification failed', () => {
    test('detects not signed with expected public key', async () => {
        const badPem = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArCHQIS/Fscz5jBsw0cLL\niZrfdb3kKeB1hzXghFiuam19VuYZ3a8Im7oMvYQxCaGH97IIOHRx6GxA6Seyk2Pi\n7a2nKNAMmRvN3T0i/0DTLJOquBLkJHlsK1RrEvzhNILdCDBRMHohM+RXE84cfmpI\n+GVTPCBPLruojEhSirVhfI1DUpLTvvn8Igab3hDasq+7NynQ2ixm/tuZ3myZt7IQ\n+naEO+CI75GFsTeRCItsyly8Doqfkg3Vq2J0fj9+U/YTEPoH1D/xZYmw8gkXnNcO\nxpGtnYF65knZL3zIqUSelFa0Rn7iTdweT1InKVKFS894K9AoHeSBbPiITqbcO1ER\nXwIDAQAB\n-----END PUBLIC KEY-----\n"

        const accountHelper = new Js4meHelper(domain, account, null, null, rs256Alg, badPem, jwtAudience);

        const data = await accountHelper.get4meData(rs256Token);
        expect(data.error.name).toEqual('JWSSignatureVerificationFailed');
        expect(data.error.message).toEqual('signature verification failed');
        expect(data.webhook_nodeID).toBe(undefined);
    });

    test('detects incorrect environment', async () => {
        const accountHelper = new Js4meHelper('4me-demo.com', account, null, null, rs256Alg, rs256Pem, jwtAudience);

        const data = await accountHelper.get4meData(rs256Token);
        expect(data.error.name).toEqual('JWTClaimValidationFailed');
        expect(data.error.message).toEqual('unexpected "iss" claim value');
        expect(data.webhook_nodeID).toBe(undefined);
    });

    test('detects incorrect account', async () => {
        const accountHelper = new Js4meHelper(domain, 'globalnet', null, null, rs256Alg, rs256Pem, jwtAudience);

        const data = await accountHelper.get4meData(rs256Token);
        expect(data.error.name).toEqual('JWTClaimValidationFailed');
        expect(data.error.message).toEqual('unexpected "iss" claim value');
        expect(data.webhook_nodeID).toBe(undefined);
    });

    test('detects incorrect audience', async () => {
        const accountHelper = new Js4meHelper(domain, account, null, null, rs256Alg, rs256Pem, 'audience');

        const data = await accountHelper.get4meData(rs256Token);
        expect(data.error.name).toEqual('JWTClaimValidationFailed');
        expect(data.error.message).toEqual('unexpected "aud" claim value');
        expect(data.webhook_nodeID).toBe(undefined);
    });

    test('detects incorrect algorithm', async () => {
        const accountHelper = new Js4meHelper(domain, account, null, null, rs512Alg, rs256Pem, jwtAudience);

        const data = await accountHelper.get4meData(rs256Token);
        expect(data.error.name).toEqual('JOSEAlgNotAllowed');
        expect(data.error.message).toEqual('"alg" (Algorithm) Header Parameter value not allowed');
        expect(data.webhook_nodeID).toBe(undefined);
    });

});
