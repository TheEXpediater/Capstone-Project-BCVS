import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasRequiredCredentialData,
  isAnchoredCredential,
  isClaimedCredential,
  isPaidCredential,
  isSignedCredential,
  isSigningEligible,
  matchesAnchorFilter,
  matchesClaimFilter,
  matchesCredentialView,
  matchesDraftPaymentFilter,
  matchesSignSignatureFilter,
} from './credentialLifecycle.js';

function credential(overrides = {}) {
  return {
    status: 'draft',
    paymentStatus: 'unpaid',
    studentNo: '2022-0001',
    studentName: 'Juan Dela Cruz',
    credentialType: 'diploma',
    signedCredential: null,
    ...overrides,
  };
}

test('credential lifecycle identifies paid, signed, claimed, and anchored states from stable fields', () => {
  assert.equal(isPaidCredential(credential({ paymentStatus: 'paid' })), true);
  assert.equal(isSignedCredential(credential({ status: 'claim_ready' })), true);
  assert.equal(isSignedCredential(credential({ credentialHash: 'hash-1' })), true);
  assert.equal(isSignedCredential(credential({ status: 'for_signature', paymentStatus: 'paid' })), false);
  assert.equal(isClaimedCredential(credential({ claimedAt: '2026-06-30T00:00:00.000Z' })), true);
  assert.equal(isAnchoredCredential(credential({ anchorStatus: 'anchored' })), true);
});

test('signing eligibility includes paid unsigned drafts and rejects incomplete or signed records', () => {
  assert.equal(isSigningEligible(credential({ status: 'draft', paymentStatus: 'paid' })), true);
  assert.equal(isSigningEligible(credential({ status: 'submitted', paymentStatus: 'paid' })), true);
  assert.equal(isSigningEligible(credential({ status: 'for_signature', paymentStatus: 'paid' })), true);
  assert.equal(isSigningEligible(credential({ status: 'for_signature', paymentStatus: 'unpaid' })), false);
  assert.equal(isSigningEligible(credential({ status: 'for_signature', paymentStatus: 'paid', studentNo: '' })), false);
  assert.equal(isSigningEligible(credential({ status: 'signed', paymentStatus: 'paid' })), false);
  assert.equal(hasRequiredCredentialData(credential({ credentialType: '' })), false);
});

test('credential view helpers keep Drafts, Sign, and Anchor filters in sync with the page', () => {
  const paidDraft = credential({ status: 'draft', paymentStatus: 'paid' });
  const unpaidDraft = credential({ status: 'draft', paymentStatus: 'unpaid' });
  const signed = credential({ status: 'claim_ready', paymentStatus: 'paid' });
  const claimed = credential({
    status: 'claimed',
    paymentStatus: 'paid',
    claimedAt: '2026-06-30T00:00:00.000Z',
  });
  const anchored = credential({ status: 'anchored', paymentStatus: 'paid', anchorStatus: 'anchored' });

  assert.equal(matchesDraftPaymentFilter(paidDraft, 'paid'), true);
  assert.equal(matchesDraftPaymentFilter(unpaidDraft, 'paid'), false);
  assert.equal(matchesSignSignatureFilter(paidDraft, 'unsigned'), true);
  assert.equal(matchesSignSignatureFilter(signed, 'signed'), true);
  assert.equal(matchesClaimFilter(claimed, 'claimed'), true);
  assert.equal(matchesClaimFilter(signed, 'unclaimed'), true);
  assert.equal(matchesAnchorFilter(signed, 'default'), true);
  assert.equal(matchesAnchorFilter(anchored, 'anchored'), true);
  assert.equal(matchesCredentialView(unpaidDraft, { view: 'drafts', payment: 'unpaid' }), true);
  assert.equal(matchesCredentialView(signed, { view: 'sign', signature: 'signed', claim: 'unclaimed' }), true);
  assert.equal(matchesCredentialView(claimed, { view: 'sign', signature: 'signed', claim: 'claimed' }), true);
  assert.equal(matchesCredentialView(signed, { view: 'anchor', anchor: 'default' }), true);
});
