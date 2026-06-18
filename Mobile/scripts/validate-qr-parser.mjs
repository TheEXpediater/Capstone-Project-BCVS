import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sourcePath = new URL('../utils/qrParser.js', import.meta.url);
const source = fs.readFileSync(sourcePath, 'utf8');
const transformed = `${source.replace(/export\s+function\s+parseQrPayload/, 'function parseQrPayload')}
parseQrPayload;`;

const parseQrPayload = vm.runInNewContext(transformed, { URL });

const serverConfigRaw = JSON.stringify({
  type: 'BCVS_SERVER_CONFIG',
  system: 'BCVS',
  preferred: 'lan',
  lanApiBaseUrl: 'http://192.168.1.50:5000/api',
  domainApiBaseUrl: 'https://psau-credentials.cfd/api',
  healthUrl: 'http://192.168.1.50:5000/api/health',
});

const serverConfig = parseQrPayload(serverConfigRaw);
assert.equal(serverConfig.kind, 'server_config');
assert.equal(serverConfig.raw, serverConfigRaw);
assert.equal(serverConfig.config.type, 'BCVS_SERVER_CONFIG');
assert.equal(serverConfig.config.system, 'BCVS');
assert.equal(serverConfig.config.lanApiBaseUrl, 'http://192.168.1.50:5000/api');
assert.equal(serverConfig.config.domainApiBaseUrl, 'https://psau-credentials.cfd/api');

const verificationJson = parseQrPayload(JSON.stringify({
  sessionId: '64f000000000000000000001',
  nonce: 'nonce-1',
  token: 'not-a-claim-when-session-exists',
}));
assert.equal(verificationJson.kind, 'verification_request');
assert.equal(verificationJson.sessionId, '64f000000000000000000001');
assert.equal(verificationJson.nonce, 'nonce-1');

const claimJson = parseQrPayload(JSON.stringify({ claimToken: 'claim-token-1' }));
assert.equal(claimJson.kind, 'claim_request');
assert.equal(claimJson.token, 'claim-token-1');

const verificationUrl = parseQrPayload('https://psau-credentials.cfd/verify/64f000000000000000000002?nonce=nonce-2');
assert.equal(verificationUrl.kind, 'verification_request');
assert.equal(verificationUrl.sessionId, '64f000000000000000000002');
assert.equal(verificationUrl.nonce, 'nonce-2');

const claimUrl = parseQrPayload('bcvs://claim?token=claim-token-2');
assert.equal(claimUrl.kind, 'claim_request');
assert.equal(claimUrl.token, 'claim-token-2');
assert.equal(claimUrl.url, 'bcvs://claim?token=claim-token-2');

const unknown = parseQrPayload(JSON.stringify({ type: 'BCVS_SERVER_CONFIG', system: 'OTHER' }));
assert.equal(unknown.kind, 'unknown');

console.log('QR parser validation passed.');
