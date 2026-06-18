import assert from 'node:assert/strict';
import fs from 'node:fs';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const app = readJson('app.json').expo;
const eas = readJson('eas.json');
const pkg = readJson('package.json');
const constants = read('constants/config.js');

assert.equal(pkg.dependencies['react-native-zeroconf'] !== undefined, true, 'react-native-zeroconf must remain installed');
assert.equal(eas.build.development.developmentClient, true, 'development build must use Expo dev-client');
assert.equal(eas.build.development.android.buildType, 'apk', 'development build must produce an APK');
assert.equal(Boolean(eas.build.preview || eas.build.production), false, 'mobile build profiles should stay development-only');
assert.equal(app.android.permissions.includes('CHANGE_WIFI_MULTICAST_STATE'), true, 'dev discovery permission should remain available');
assert.equal(app.extra.DOMAIN_API_BASE_URL, 'https://api.psau-credentials.cfd/api', 'mobile app extra must default to the API subdomain');
assert.equal(app.extra.DOMAIN_WEB_BASE_URL, 'https://psau-credentials.cfd', 'mobile app extra must default to the root web/verifier domain');
assert.equal(app.extra.VERIFICATION_WEB_BASE_URL, 'https://psau-credentials.cfd', 'mobile app extra must default verifier links to the root domain');
assert.doesNotMatch(JSON.stringify(app.extra), /https:\/\/psau-credentials\.cfd\/api/, 'mobile extras must not contain the root-domain API URL');
assert.match(constants, /https:\/\/api\.psau-credentials\.cfd\/api/, 'mobile config must include the canonical API subdomain fallback');
assert.match(constants, /https:\/\/psau-credentials\.cfd/, 'mobile config must include the canonical web/verifier fallback');
assert.doesNotMatch(constants, /https:\/\/psau-credentials\.cfd\/api/, 'mobile config must not include the root-domain API URL');

console.log('Expo/mobile config validation passed.');
