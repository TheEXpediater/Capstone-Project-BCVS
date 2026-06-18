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

const startupMatch = service.match(/export\s+async\s+function\s+resolveStartupServerConfig\s*\([^)]*\)\s*{([\s\S]*?)\n}/);
assert.ok(startupMatch, 'resolveStartupServerConfig must be present');
assert.doesNotMatch(
  startupMatch[1],
  /discover(?:AndValidateServer|Servers)\s*\(/,
  'student startup must not run mDNS/Zeroconf discovery automatically'
);

assert.match(settings, /EXPO_PUBLIC_SHOW_DISCOVERY_TOOLS/, 'settings must expose discovery only behind a debug flag');
assert.match(settings, /showDiscoveryTools/, 'settings must compute showDiscoveryTools');
assert.match(settings, /showDiscoveryTools\s*&&/, 'Auto-discover UI must be gated by showDiscoveryTools');

['refreshApiBaseUrl', 'setApiBaseUrl', 'getApiBaseUrl'].forEach((name) => {
  assert.match(apiClient, new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`), `${name} must be exported`);
});
assert.match(apiClient, /interceptors\.request\.use\(async/, 'API client must refresh the active URL before requests');

console.log('Server config validation passed.');
