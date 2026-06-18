import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANCHOR_NOW_FEE,
  BASE_CREDENTIAL_AMOUNT,
  buildCredentialPricing,
  normalizeAnchorMode,
  normalizePaymentAmount,
  normalizeReceiptNo,
} from '../src/modules/credentials/pricing.js';

test('credential pricing defaults to PHP 150 for regular requests', () => {
  const pricing = buildCredentialPricing({});

  assert.equal(BASE_CREDENTIAL_AMOUNT, 150);
  assert.equal(ANCHOR_NOW_FEE, 20);
  assert.equal(pricing.anchorMode, 'default');
  assert.equal(pricing.anchorNow, false);
  assert.equal(pricing.baseAmount, 150);
  assert.equal(pricing.anchorNowFee, 0);
  assert.equal(pricing.totalAmount, 150);
  assert.equal(pricing.amount, 150);
});

test('credential pricing adds PHP 20 for Anchor Now priority queue requests', () => {
  const pricing = buildCredentialPricing({ anchorNow: true });

  assert.equal(pricing.anchorMode, 'anchor_now');
  assert.equal(pricing.anchorNow, true);
  assert.equal(pricing.baseAmount, 150);
  assert.equal(pricing.anchorNowFee, 20);
  assert.equal(pricing.totalAmount, 170);
  assert.equal(pricing.amount, 170);
});

test('authorized staff can override the final payable amount with a positive value', () => {
  const pricing = buildCredentialPricing({ anchorMode: 'anchor_now', amount: '175.50' });

  assert.equal(pricing.anchorMode, 'anchor_now');
  assert.equal(pricing.totalAmount, 175.5);
  assert.equal(pricing.amount, 175.5);
});

test('payment amount validation rejects zero, negative, and non-numeric values', () => {
  assert.throws(() => normalizePaymentAmount(0), /greater than 0/i);
  assert.throws(() => normalizePaymentAmount(-1), /greater than 0/i);
  assert.throws(() => normalizePaymentAmount('abc'), /numeric/i);
  assert.equal(normalizePaymentAmount('150'), 150);
});

test('receipt numbers must be exactly six digits', () => {
  assert.equal(normalizeReceiptNo(' 123456 '), '123456');
  assert.throws(() => normalizeReceiptNo('RCPT-123456'), /6 digits/i);
  assert.throws(() => normalizeReceiptNo('12345'), /6 digits/i);
  assert.throws(() => normalizeReceiptNo('1234567'), /6 digits/i);
});

test('legacy anchor values are safely mapped to pricing modes', () => {
  assert.equal(normalizeAnchorMode('after_signing'), 'default');
  assert.equal(normalizeAnchorMode('same_day'), 'anchor_now');
  assert.equal(normalizeAnchorMode('anchor_now'), 'anchor_now');
  assert.equal(normalizeAnchorMode('default'), 'default');
});
