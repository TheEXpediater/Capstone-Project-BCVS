import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCredentialAnchorVerificationStatus } from '../src/modules/verification/service.js';

test('signed but unanchored credential reports confirmed with scheduled anchor status', () => {
  const scheduledAnchorAt = new Date('2026-06-26T00:00:00.000Z');
  const result = buildCredentialAnchorVerificationStatus({
    credential: {
      status: 'queued_for_anchor',
      signedCredential: { id: 'vc-1' },
      paymentStatus: 'paid',
      anchorStatus: 'queued',
      scheduledAnchorAt,
    },
    payloadVerified: true,
    blockchainVerified: false,
    now: new Date('2026-06-20T00:00:00.000Z'),
  });

  assert.equal(result.signatureValid, true);
  assert.equal(result.credentialConfirmed, true);
  assert.equal(result.anchorStatus, 'scheduled');
  assert.equal(result.scheduledAnchorAt.toISOString(), scheduledAnchorAt.toISOString());
  assert.match(result.message, /VC confirmed/i);
  assert.match(result.message, /scheduled/i);
});

test('anchored credential reports confirmed and anchored', () => {
  const anchoredAt = new Date('2026-06-19T00:00:00.000Z');
  const result = buildCredentialAnchorVerificationStatus({
    credential: {
      status: 'anchored',
      signedCredential: { id: 'vc-1' },
      paymentStatus: 'paid',
      anchorStatus: 'anchored',
      anchoredAt,
    },
    payloadVerified: true,
    blockchainVerified: true,
  });

  assert.equal(result.credentialConfirmed, true);
  assert.equal(result.anchorStatus, 'anchored');
  assert.equal(result.anchoredAt.toISOString(), anchoredAt.toISOString());
  assert.match(result.message, /VC confirmed/i);
  assert.match(result.message, /Blockchain anchored/i);
});

test('unsigned credential does not report confirmation', () => {
  const result = buildCredentialAnchorVerificationStatus({
    credential: {
      status: 'draft',
      paymentStatus: 'paid',
    },
    payloadVerified: false,
    blockchainVerified: false,
  });

  assert.equal(result.signatureValid, false);
  assert.equal(result.credentialConfirmed, false);
  assert.equal(result.anchorStatus, 'missing');
  assert.match(result.message, /not signed/i);
});
