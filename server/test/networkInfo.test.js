import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildHealthPayload,
  buildNetworkQrPayload,
} from '../src/shared/utils/networkInfo.js';

test('health payload exposes the preferred web base URL alongside the API URL', () => {
  const payload = buildHealthPayload({
    manualApiBaseUrl: 'http://192.168.1.50:5000/api',
    manualWebBaseUrl: 'http://192.168.1.50:5173',
    preferredMode: 'lan',
  });

  assert.equal(payload.environment.preferredBaseUrl, 'http://192.168.1.50:5000/api');
  assert.equal(payload.environment.preferredWebBaseUrl, 'http://192.168.1.50:5173');
});

test('network QR payload is a BCVS server config with timestamp and no secrets', () => {
  const payload = buildNetworkQrPayload({
    manualApiBaseUrl: 'http://192.168.1.50:5000',
    manualWebBaseUrl: 'http://192.168.1.50:5173',
    domainApiBaseUrl: 'https://psau-credentials.cfd/api',
    domainWebBaseUrl: 'https://psau-credentials.cfd',
    preferredMode: 'lan',
  });

  assert.equal(payload.type, 'BCVS_SERVER_CONFIG');
  assert.equal(payload.system, 'BCVS');
  assert.equal(payload.preferred, 'lan');
  assert.equal(payload.lanApiBaseUrl, 'http://192.168.1.50:5000/api');
  assert.equal(payload.lanWebBaseUrl, 'http://192.168.1.50:5173');
  assert.equal(payload.domainApiBaseUrl, 'https://psau-credentials.cfd/api');
  assert.equal(payload.domainWebBaseUrl, 'https://psau-credentials.cfd');
  assert.equal(payload.healthUrl, 'http://192.168.1.50:5000/api/health');
  assert.match(payload.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(JSON.stringify(payload).includes('password'), false);
  assert.equal(JSON.stringify(payload).includes('token'), false);
});
