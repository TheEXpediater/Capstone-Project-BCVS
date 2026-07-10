import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TOR_REMARKS,
  buildCreateVcDraftPayload,
  getCreateVcPricingSummary,
} from './createVcDraftPayload.js';

test('TOR payload defaults remarks to General Purposes', () => {
  const payload = buildCreateVcDraftPayload({ credentialType: 'TOR' });

  assert.equal(payload.credentialType, 'tor');
  assert.equal(payload.remarks, DEFAULT_TOR_REMARKS);
});

test('custom TOR remarks are trimmed and preserved', () => {
  const payload = buildCreateVcDraftPayload({
    credentialType: 'Transcript of Records',
    remarks: '  Employment requirement  ',
  });

  assert.equal(payload.credentialType, 'tor');
  assert.equal(payload.remarks, 'Employment requirement');
});

test('Diploma payload sends no remarks or notes', () => {
  const payload = buildCreateVcDraftPayload({
    credentialType: 'Diploma',
    remarks: 'General Purposes',
  });

  assert.equal(payload.credentialType, 'diploma');
  assert.equal(Object.hasOwn(payload, 'remarks'), false);
  assert.equal(Object.hasOwn(payload, 'notes'), false);
});

test('switching from TOR to Diploma clears stale remarks', () => {
  const payload = buildCreateVcDraftPayload({
    credentialType: 'diploma',
    remarks: 'For board exam',
  });

  assert.deepEqual(payload, {
    credentialType: 'diploma',
    anchorMode: 'default',
    anchorNow: false,
  });
});

test('default anchoring payload uses the canonical default mode', () => {
  const payload = buildCreateVcDraftPayload({
    credentialType: 'tor',
    anchorMode: 'default',
  });

  assert.equal(payload.anchorMode, 'default');
  assert.equal(payload.anchorNow, false);
  assert.equal(Object.hasOwn(payload, 'anchorNowFee'), false);
});

test('Anchor Now payload uses the canonical priority mode', () => {
  const payload = buildCreateVcDraftPayload({
    credentialType: 'tor',
    anchorMode: 'anchor_now',
  });

  assert.equal(payload.anchorMode, 'anchor_now');
  assert.equal(payload.anchorNow, true);
  assert.equal(Object.hasOwn(payload, 'anchorNowFee'), false);
});

test('client pricing summary does not accept arbitrary totals', () => {
  const summary = getCreateVcPricingSummary('anchor_now', 3);

  assert.equal(summary.baseAmount, 150);
  assert.equal(summary.anchorNowFee, 20);
  assert.equal(summary.totalPerCredential, 170);
  assert.equal(summary.totalAmount, 510);
});
