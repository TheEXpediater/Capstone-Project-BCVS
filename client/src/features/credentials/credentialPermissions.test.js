import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canEditCredential,
  canMarkCredentialPaid,
  canSignCredential,
  isReadOnlyCredentialUser,
} from './credentialPermissions.js';

const unsignedDraft = {
  status: 'draft',
  paymentStatus: 'unpaid',
  signedCredential: null,
  signedAt: null,
};

const readyForSignature = {
  status: 'for_signature',
  paymentStatus: 'paid',
  signedCredential: null,
  signedAt: null,
};

const signedCredential = {
  status: 'signed',
  paymentStatus: 'paid',
  signedCredential: { proof: {} },
  signedAt: new Date().toISOString(),
};

test('admin and super_admin can edit unsigned credentials', () => {
  assert.equal(canEditCredential({ role: 'admin' }, unsignedDraft), true);
  assert.equal(canEditCredential({ role: 'super_admin' }, unsignedDraft), true);
});

test('signed credentials are immutable in the client permission helper', () => {
  assert.equal(canEditCredential({ role: 'admin' }, signedCredential), false);
  assert.equal(canEditCredential({ role: 'super_admin' }, signedCredential), false);
});

test('only super_admin can sign paid credentials ready for signing', () => {
  assert.equal(canSignCredential({ role: 'super_admin' }, readyForSignature), true);
  assert.equal(canSignCredential({ role: 'admin' }, readyForSignature), false);
  assert.equal(canSignCredential({ role: 'developer' }, readyForSignature), false);
});

test('developer is read-only and cashier is payment-only', () => {
  assert.equal(isReadOnlyCredentialUser({ role: 'developer' }), true);
  assert.equal(canEditCredential({ role: 'developer' }, unsignedDraft), false);
  assert.equal(canMarkCredentialPaid({ role: 'cashier' }, unsignedDraft), true);
  assert.equal(canSignCredential({ role: 'cashier' }, readyForSignature), false);
});
