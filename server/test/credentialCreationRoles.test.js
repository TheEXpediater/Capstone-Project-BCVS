import test from 'node:test';
import assert from 'node:assert/strict';

import { canCreateDraft } from '../src/modules/credentials/permissions.js';
import { allowRoles } from '../src/shared/middleware/auth.middleware.js';

const createVcRoles = ['admin', 'super_admin'];
const blockedRoles = ['cashier', 'developer', 'student'];

function runRoleMiddleware(role) {
  const middleware = allowRoles('admin', 'super_admin');
  let nextError = null;
  let nextCalled = false;

  middleware({ user: { role } }, {}, (error) => {
    nextError = error || null;
    nextCalled = true;
  });

  return { nextCalled, nextError };
}

test('admin and super_admin can create one VC draft internally', () => {
  for (const role of createVcRoles) {
    assert.equal(canCreateDraft({ role }), true, `${role} should create a VC draft`);
  }
});

test('cashier, developer, and student cannot create VC drafts internally', () => {
  for (const role of blockedRoles) {
    assert.equal(canCreateDraft({ role }), false, `${role} should not create a VC draft`);
  }
});

test('solo Create VC route role gate permits administrative creation roles', () => {
  for (const role of createVcRoles) {
    const result = runRoleMiddleware(role);

    assert.equal(result.nextCalled, true);
    assert.equal(result.nextError, null, `${role} should pass solo Create VC route gate`);
  }
});

test('solo Create VC route role gate rejects cashier, developer, and student with 403', () => {
  for (const role of blockedRoles) {
    const result = runRoleMiddleware(role);

    assert.equal(result.nextCalled, true);
    assert.equal(result.nextError?.statusCode, 403);
  }
});

test('bulk Create VC route role gate permits administrative creation roles', () => {
  for (const role of createVcRoles) {
    const result = runRoleMiddleware(role);

    assert.equal(result.nextCalled, true);
    assert.equal(result.nextError, null, `${role} should pass bulk Create VC route gate`);
  }
});
