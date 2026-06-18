import assert from 'node:assert/strict';
import fs from 'node:fs';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

const app = readJson('app.json').expo;
const eas = readJson('eas.json');
const pkg = readJson('package.json');

assert.equal(pkg.dependencies['react-native-zeroconf'] !== undefined, true, 'react-native-zeroconf must remain installed');
assert.equal(eas.build.development.developmentClient, true, 'development build must use Expo dev-client');
assert.equal(eas.build.development.android.buildType, 'apk', 'development build must produce an APK');
assert.equal(Boolean(eas.build.preview || eas.build.production), false, 'mobile build profiles should stay development-only');
assert.equal(app.android.permissions.includes('CHANGE_WIFI_MULTICAST_STATE'), true, 'dev discovery permission should remain available');

console.log('Expo/mobile config validation passed.');
