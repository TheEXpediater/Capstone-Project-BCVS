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
  isSignedCredential,
  isAnchorReady,
  resolveAnchorReadiness,
} from '../src/modules/credentials/permissions.js';
import {
  buildCredentialDraftListFilter,
  moveToSigningQueue,
} from '../src/modules/credentials/service.js';

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
    studentNo: '2022-0001',
    studentName: 'Juan Dela Cruz',
    credentialType: 'diploma',
    signedCredential: null,
    ...overrides,
  };
}

test('VC lifecycle role gates permit administrative draft creation and restrict later stages', () => {
  const draft = credential();
  const paidDraft = credential({ paymentStatus: 'paid' });
  const submitted = credential({ status: 'for_signature', paymentStatus: 'paid' });
  const unpaidSubmitted = credential({ status: 'for_signature', paymentStatus: 'unpaid' });

  assert.equal(canCreateDraft(admin), true);
  assert.equal(canCreateDraft(registrar), true);
  assert.equal(canCreateDraft(developer), false);
  assert.equal(canEditDraft(admin, draft), true);
  assert.equal(canEditDraft(registrar, draft), true);
  assert.equal(canSubmitDraft(admin, draft), false);
  assert.equal(canSubmitDraft(admin, paidDraft), true);
  assert.equal(canDeleteDraft(admin, draft), true);

  assert.equal(canSignCredential(admin, submitted), false);
  assert.equal(canSignCredential(cashier, submitted), false);
  assert.equal(canSignCredential(registrar, submitted), true);
  assert.equal(canSignCredential(registrar, unpaidSubmitted), false);

  assert.equal(canEditDraft(developer, draft), false);
  assert.equal(canSubmitDraft(developer, draft), false);
  assert.equal(canDeleteDraft(developer, draft), false);
  assert.equal(canSignCredential(developer, submitted), false);
  assert.equal(canMarkPaid(developer, submitted), false);
  assert.equal(canQueueAnchor(developer, submitted), false);
  assert.equal(canGenerateClaimQr(developer, submitted), false);
});

test('registrar can sign paid unsigned drafts, submitted rows, and signing queue rows only', () => {
  const paidDraft = credential({ status: 'draft', paymentStatus: 'paid' });
  const submitted = credential({ status: 'submitted', paymentStatus: 'paid' });
  const queued = credential({ status: 'for_signature', paymentStatus: 'paid' });
  const missingProfile = credential({
    status: 'for_signature',
    paymentStatus: 'paid',
    studentName: '',
  });
  const signed = credential({
    status: 'signed',
    paymentStatus: 'paid',
    signedCredential: { id: 'vc-1' },
  });
  const revoked = credential({ status: 'revoked', paymentStatus: 'paid' });

  assert.equal(canSignCredential(registrar, paidDraft), true);
  assert.equal(canSignCredential(registrar, submitted), true);
  assert.equal(canSignCredential(registrar, queued), true);
  assert.equal(canSignCredential(registrar, missingProfile), false);
  assert.equal(canSignCredential(registrar, signed), false);
  assert.equal(canSignCredential(registrar, revoked), false);
  assert.equal(canSignCredential(admin, queued), false);
});

test('cashier can mark payment paid but cannot perform VC lifecycle operations', () => {
  const submitted = credential({ status: 'for_signature' });

  assert.equal(canMarkPaid(cashier, submitted), true);
  assert.equal(canSubmitDraft(cashier, credential()), false);
  assert.equal(canSignCredential(cashier, submitted), false);
  assert.equal(canQueueAnchor(cashier, submitted), false);
  assert.equal(canGenerateClaimQr(cashier, submitted), false);
});

test('paid unsigned credentials move to the signing queue idempotently', () => {
  const now = new Date('2026-06-19T00:00:00.000Z');
  const draft = credential({ paymentStatus: 'paid' });

  assert.equal(moveToSigningQueue(draft, admin, now), true);
  assert.equal(draft.status, 'for_signature');
  assert.equal(draft.submittedBy, null);
  assert.equal(draft.submittedAt, now);

  assert.equal(moveToSigningQueue(draft, admin, new Date('2026-06-20T00:00:00.000Z')), false);
  assert.equal(draft.submittedAt, now);
});

test('unpaid credentials do not enter the signing queue', () => {
  const draft = credential({ paymentStatus: 'unpaid' });

  assert.equal(moveToSigningQueue(draft, admin, new Date('2026-06-19T00:00:00.000Z')), false);
  assert.equal(draft.status, 'draft');
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

test('signed credentials are recognized from status and signature artifacts', () => {
  assert.equal(isSignedCredential(credential({ status: 'claim_ready', paymentStatus: 'paid' })), true);
  assert.equal(isSignedCredential(credential({ status: 'queued_for_anchor', paymentStatus: 'paid' })), true);
  assert.equal(isSignedCredential(credential({ credentialHash: 'hash-1', paymentStatus: 'paid' })), true);
  assert.equal(isSignedCredential(credential({ status: 'for_signature', paymentStatus: 'paid' })), false);
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

test('draft list filter sends paid unsigned records to Sign without hiding draft and submitted rows', () => {
  const { filter, view, signature } = buildCredentialDraftListFilter({ view: 'sign' });

  assert.equal(view, 'sign');
  assert.equal(signature, 'unsigned');
  assert.deepEqual(filter.$and[0], { paymentStatus: 'paid' });
  assert.equal(
    filter.$and.some((clause) => clause.$and?.some((child) => {
      return Array.isArray(child.status?.$in) &&
        child.status.$in.includes('draft') &&
        child.status.$in.includes('submitted') &&
        child.status.$in.includes('for_signature');
    })),
    true
  );
});

test('draft list filter recognizes signed, claimed, anchored, and scheduled anchor views', () => {
  const now = new Date('2026-06-19T12:00:00.000Z');
  const signed = buildCredentialDraftListFilter({ view: 'sign', signature: 'signed' }, now);
  const claimed = buildCredentialDraftListFilter({ view: 'sign', signature: 'signed', claim: 'claimed' }, now);
  const unclaimed = buildCredentialDraftListFilter({ view: 'sign', signature: 'signed', claim: 'unclaimed' }, now);
  const anchored = buildCredentialDraftListFilter({ view: 'anchor', anchor: 'anchored' }, now);
  const today = buildCredentialDraftListFilter({ view: 'anchor', anchor: 'today' }, now);
  const sevenDays = buildCredentialDraftListFilter({ view: 'anchor', anchor: '7_days' }, now);

  assert.equal(
    signed.filter.$and.some((clause) => clause.$or?.some((child) => child.status?.$in?.includes('claim_ready'))),
    true
  );
  assert.equal(
    claimed.filter.$and.some((clause) => clause.$or?.some((child) => child.claimedAt?.$ne === null)),
    true
  );
  assert.equal(
    unclaimed.filter.$and.some((clause) => clause.$nor?.some((child) => child.status === 'claimed')),
    true
  );
  assert.equal(
    anchored.filter.$and.some((clause) => clause.$or?.some((child) => child.anchorStatus === 'anchored')),
    true
  );
  assert.equal(
    today.filter.$and.some((clause) => clause.$or?.some((child) => child.scheduledAnchorAt?.$lte instanceof Date)),
    true
  );
  assert.equal(
    sevenDays.filter.$and.some((clause) => clause.$and?.some((child) => child.scheduledAnchorAt?.$gte instanceof Date)),
    true
  );
});
