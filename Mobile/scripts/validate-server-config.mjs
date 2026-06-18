import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const service = read('services/serverConfigService.js');
const settings = read('app/(tabs)/settings.jsx');
const apiClient = read('services/apiClient.js');

[
  'normalizeApiUrl',
  'getHealthUrl',
  'validateServer',
  'saveServerConfig',
  'getSavedServerConfig',
  'getActiveApiBaseUrl',
  'clearServerConfig',
  'saveConfigFromQr',
  'resolveStartupServerConfig',
  'discoverServers',
].forEach((name) => {
  assert.match(service, new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`), `${name} must be exported`);
});

const startupStart = service.indexOf('export async function resolveStartupServerConfig');
const startupEnd = service.indexOf('\nexport ', startupStart + 1);
assert.notEqual(startupStart, -1, 'resolveStartupServerConfig must be present');
const startupBody = service.slice(startupStart, startupEnd === -1 ? service.length : startupEnd);
assert.doesNotMatch(
  startupBody,
  /discover(?:AndValidateServer|Servers)\s*\(/,
  'student startup must not run mDNS/Zeroconf discovery automatically'
);
assert.ok(
  startupBody.indexOf('DOMAIN_API_BASE_URL') !== -1 &&
    startupBody.indexOf('DOMAIN_API_BASE_URL') < startupBody.indexOf('getSavedQrServerConfig'),
  'student startup must try the production domain before saved QR/manual fallbacks'
);

assert.match(settings, /EXPO_PUBLIC_SHOW_CONNECTION_TOOLS/, 'settings must expose connection tools only behind a debug flag');
assert.match(settings, /showConnectionTools/, 'settings must compute showConnectionTools');
assert.match(settings, /showConnectionTools\s*&&/, 'Scan/manual connection tools must be gated by showConnectionTools');
assert.match(settings, /EXPO_PUBLIC_SHOW_DISCOVERY_TOOLS/, 'settings must expose discovery only behind a debug flag');
assert.match(settings, /showDiscoveryTools/, 'settings must compute showDiscoveryTools');
assert.match(settings, /showDiscoveryTools\s*&&/, 'Auto-discover UI must be gated by showDiscoveryTools');
assert.doesNotMatch(settings, /Active API server/, 'student settings must not show raw API URLs by default');
assert.doesNotMatch(settings, /Connection source/, 'student settings must not show connection source by default');
assert.doesNotMatch(settings, /https:\/\/psau-credentials\.cfd\/api/, 'student settings must not suggest the root-domain API URL');
assert.ok(
  settings.indexOf('showConnectionTools &&') < settings.indexOf('Scan Server QR'),
  'server QR scan control must live behind showConnectionTools'
);

['refreshApiBaseUrl', 'setApiBaseUrl', 'getApiBaseUrl'].forEach((name) => {
  assert.match(apiClient, new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`), `${name} must be exported`);
});
assert.match(apiClient, /interceptors\.request\.use\(async/, 'API client must refresh the active URL before requests');

console.log('Server config validation passed.');
