import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canCreateDraft,
  canDeleteDraft,
  canEditDraft,
  canGenerateClaimQr,
  canMarkPaid,
  canProcessAnchor,
  canQueueAnchor,
  canSignCredential,
  canSubmitDraft,
  isAnchorReady,
  resolveAnchorReadiness,
} from '../src/modules/credentials/permissions.js';

const admin = { role: 'admin' };
const registrar = { role: 'super_admin' };
const cashier = { role: 'cashier' };
const developer = { role: 'developer' };

function credential(overrides = {}) {
  return {
    status: 'draft',
    paymentStatus: 'unpaid',
    anchorStatus: 'not_requested',
    anchorMode: 'default',
    signedCredential: null,
    ...overrides,
  };
}

test('VC lifecycle role gates keep developer read-only and restrict signing to registrar', () => {
  const draft = credential();
  const submitted = credential({ status: 'for_signature' });

  assert.equal(canCreateDraft(admin), true);
  assert.equal(canEditDraft(admin, draft), true);
  assert.equal(canSubmitDraft(admin, draft), true);
  assert.equal(canDeleteDraft(admin, draft), true);

  assert.equal(canSignCredential(admin, submitted), false);
  assert.equal(canSignCredential(cashier, submitted), false);
  assert.equal(canSignCredential(registrar, submitted), true);

  assert.equal(canCreateDraft(developer), false);
  assert.equal(canEditDraft(developer, draft), false);
  assert.equal(canSubmitDraft(developer, draft), false);
  assert.equal(canDeleteDraft(developer, draft), false);
  assert.equal(canSignCredential(developer, submitted), false);
  assert.equal(canMarkPaid(developer, submitted), false);
  assert.equal(canQueueAnchor(developer, submitted), false);
  assert.equal(canGenerateClaimQr(developer, submitted), false);
});

test('cashier can mark payment paid but cannot perform VC lifecycle operations', () => {
  const submitted = credential({ status: 'for_signature' });

  assert.equal(canMarkPaid(cashier, submitted), true);
  assert.equal(canSubmitDraft(cashier, credential()), false);
  assert.equal(canSignCredential(cashier, submitted), false);
  assert.equal(canQueueAnchor(cashier, submitted), false);
  assert.equal(canGenerateClaimQr(cashier, submitted), false);
});

test('signed content is locked against draft edits and draft deletes', () => {
  const signed = credential({
    status: 'signed',
    signedCredential: { id: 'vc-1' },
    paymentStatus: 'paid',
  });

  assert.equal(canEditDraft(admin, signed), false);
  assert.equal(canDeleteDraft(admin, signed), false);
});

test('only signed and paid credentials become anchor-ready or claim-QR eligible', () => {
  const signedUnpaid = credential({
    status: 'signed',
    signedCredential: { id: 'vc-1' },
    paymentStatus: 'unpaid',
  });
  const unsignedPaid = credential({
    status: 'for_signature',
    paymentStatus: 'paid',
  });
  const signedPaid = credential({
    status: 'signed',
    signedCredential: { id: 'vc-1' },
    paymentStatus: 'paid',
  });

  assert.equal(canQueueAnchor(registrar, signedUnpaid), false);
  assert.equal(canQueueAnchor(registrar, unsignedPaid), false);
  assert.equal(canQueueAnchor(registrar, signedPaid), true);
  assert.equal(canGenerateClaimQr(registrar, signedUnpaid), false);
  assert.equal(canGenerateClaimQr(registrar, unsignedPaid), false);
  assert.equal(canGenerateClaimQr(registrar, signedPaid), true);
});

test('anchor now is due immediately and default anchoring is due seven days after readiness', () => {
  const now = new Date('2026-06-19T00:00:00.000Z');
  const anchorNow = credential({
    status: 'signed',
    signedCredential: { id: 'vc-1' },
    paymentStatus: 'paid',
    anchorMode: 'anchor_now',
  });
  const defaultAnchor = credential({
    status: 'signed',
    signedCredential: { id: 'vc-2' },
    paymentStatus: 'paid',
    anchorMode: 'default',
  });

  const anchorNowReadiness = resolveAnchorReadiness(anchorNow, now);
  const defaultReadiness = resolveAnchorReadiness(defaultAnchor, now);

  assert.equal(anchorNowReadiness.eligible, true);
  assert.equal(anchorNowReadiness.ready, true);
  assert.equal(anchorNowReadiness.scheduledAnchorAt.toISOString(), now.toISOString());

  assert.equal(defaultReadiness.eligible, true);
  assert.equal(defaultReadiness.ready, false);
  assert.equal(defaultReadiness.scheduledAnchorAt.toISOString(), '2026-06-26T00:00:00.000Z');
});

test('default credentials cannot process anchoring before due date but can after due date', () => {
  const now = new Date('2026-06-19T00:00:00.000Z');
  const due = new Date('2026-06-26T00:00:00.000Z');
  const scheduled = credential({
    status: 'queued_for_anchor',
    signedCredential: { id: 'vc-1' },
    paymentStatus: 'paid',
    anchorStatus: 'queued',
    anchorMode: 'default',
    scheduledAnchorAt: due,
  });

  assert.equal(isAnchorReady(scheduled, now), false);
  assert.equal(canProcessAnchor(registrar, scheduled, now), false);
  assert.equal(isAnchorReady(scheduled, due), true);
  assert.equal(canProcessAnchor(registrar, scheduled, due), true);
});
