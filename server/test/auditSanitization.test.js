import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeAuditMetadata } from '../src/modules/audit/service.js';

test('audit metadata redacts sensitive nested fields while preserving useful context', () => {
  const sanitized = sanitizeAuditMetadata({
    credentialDraftId: 'draft-1',
    studentNo: '2020-0001',
    password: 'secret-password',
    authorization: 'Bearer secret-token',
    nested: {
      privateKeyCiphertext: 'ciphertext',
      authTag: 'tag',
      validIdFrontUrl: '/uploads/verification/front.jpg',
      livenessimageurl: 'data:image/jpeg;base64,raw-face-image',
      safe: 'kept',
    },
    rows: [{ token: 'claim-token', label: 'QR generated' }],
  });

  assert.equal(sanitized.credentialDraftId, 'draft-1');
  assert.equal(sanitized.studentNo, '2020-0001');
  assert.equal(sanitized.password, '[REDACTED]');
  assert.equal(sanitized.authorization, '[REDACTED]');
  assert.equal(sanitized.nested.privateKeyCiphertext, '[REDACTED]');
  assert.equal(sanitized.nested.authTag, '[REDACTED]');
  assert.equal(sanitized.nested.validIdFrontUrl, '[REDACTED]');
  assert.equal(sanitized.nested.livenessimageurl, '[REDACTED]');
  assert.equal(sanitized.nested.safe, 'kept');
  assert.equal(sanitized.rows[0].token, '[REDACTED]');
  assert.equal(sanitized.rows[0].label, 'QR generated');
});
