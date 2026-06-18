import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const appRoutes = read('src/routes/AppRoutes.jsx');
const appShell = read('src/components/layouts/AppShell.jsx');
const settings = read('src/features/settings/pages/SystemSettingsPage.jsx');

assert.doesNotMatch(appShell, /Action Logs|\/audit-logs|FaClipboardList/, 'Action Logs must not be in sidebar navigation');
assert.doesNotMatch(appRoutes, /path=["']\/audit-logs["']/, 'Action Logs must not be a top-level route');
assert.match(settings, /AuditLogsPage/, 'System Settings must embed AuditLogsPage');
assert.match(settings, /Action Logs/, 'System Settings must include an Action Logs tab or section');

console.log('Client route validation passed.');
