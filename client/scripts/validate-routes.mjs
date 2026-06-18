import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const appRoutes = read('src/routes/AppRoutes.jsx');
const appShell = read('src/components/layouts/AppShell.jsx');
const settings = read('src/features/settings/pages/SystemSettingsPage.jsx');
const api = read('src/services/api.js');
const publicVerificationApi = read('src/features/verification/publicVerificationAPI.js');
const viteConfig = read('vite.config.js');

assert.doesNotMatch(appShell, /Action Logs|\/audit-logs|FaClipboardList/, 'Action Logs must not be in sidebar navigation');
assert.doesNotMatch(appRoutes, /path=["']\/audit-logs["']/, 'Action Logs must not be a top-level route');
assert.match(settings, /AuditLogsPage/, 'System Settings must embed AuditLogsPage');
assert.match(settings, /Action Logs/, 'System Settings must include an Action Logs tab or section');

[api, publicVerificationApi].forEach((source) => {
  assert.match(source, /VITE_API_BASE_URL/, 'client API modules must prefer VITE_API_BASE_URL');
  assert.doesNotMatch(source, /https:\/\/psau-credentials\.cfd\/api/, 'client API modules must not use the root domain as the production API');
});

assert.match(viteConfig, /host:\s*['"]0\.0\.0\.0['"]/, 'Vite must listen on all interfaces for the Cloudflare tunnel');
assert.match(viteConfig, /port:\s*5173/, 'Vite must use the web/verifier port 5173');
assert.match(viteConfig, /strictPort:\s*true/, 'Vite must keep port 5173 stable');
assert.match(viteConfig, /psau-credentials\.cfd/, 'Vite must allow the root web/verifier domain');
assert.match(viteConfig, /www\.psau-credentials\.cfd/, 'Vite must allow the www web/verifier domain');

const tabsMatch = settings.match(/const TABS = \[([\s\S]*?)\];/);
assert.ok(tabsMatch, 'System Settings tabs must be declared');
assert.match(tabsMatch[1], /Connection/, 'System Settings must expose a Connection tab');
assert.match(tabsMatch[1], /Action Logs/, 'System Settings must expose an Action Logs tab');
assert.match(tabsMatch[1], /Advanced/, 'System Settings must expose an Advanced tab');
['Permissions', 'Issuer Key Vault', 'Business Rules', 'MIS Technical Locks', 'Network & Mobile', 'Blockchain / Contract'].forEach((tab) => {
  assert.doesNotMatch(tabsMatch[1], new RegExp(tab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${tab} must not be a top-level System Settings tab`);
});
assert.match(settings, /Web \/ Verification Domain/, 'Connection tab must label the root verifier domain clearly');
assert.match(settings, /Backend API Domain/, 'Connection tab must label the API subdomain clearly');
assert.doesNotMatch(settings, /placeholder=["']https:\/\/psau-credentials\.cfd\/api["']/, 'System Settings must not suggest the root domain as the API URL');

console.log('Client route validation passed.');
