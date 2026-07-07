import assert from 'node:assert/strict';
import test from 'node:test';

import {
  updateWebPasswordSchema,
  updateWebProfileSchema,
} from '../src/modules/auth/validator.js';

test('web profile update accepts editable profile fields and supported web roles', () => {
  const { error, value } = updateWebProfileSchema.validate({
    fullName: 'Registrar Admin',
    email: 'registrar@example.edu',
    contactNo: '09171234567',
    address: 'San Agustin, Magalang, Pampanga',
    role: 'admin',
  });

  assert.equal(error, undefined);
  assert.equal(value.email, 'registrar@example.edu');
  assert.equal(value.role, 'admin');
});

test('web profile update rejects student role for web administrator accounts', () => {
  const { error } = updateWebProfileSchema.validate({
    fullName: 'Registrar Admin',
    email: 'registrar@example.edu',
    role: 'student',
  });

  assert.ok(error);
});

test('web password update requires a strong matching new password', () => {
  const valid = updateWebPasswordSchema.validate({
    oldPassword: 'OldPass123',
    newPassword: 'NewPass123',
    confirmPassword: 'NewPass123',
  });

  const weak = updateWebPasswordSchema.validate({
    oldPassword: 'OldPass123',
    newPassword: 'newpass',
    confirmPassword: 'newpass',
  });

  const mismatch = updateWebPasswordSchema.validate({
    oldPassword: 'OldPass123',
    newPassword: 'NewPass123',
    confirmPassword: 'OtherPass123',
  });

  assert.equal(valid.error, undefined);
  assert.ok(weak.error);
  assert.ok(mismatch.error);
});
