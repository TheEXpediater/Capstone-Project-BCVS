import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TOR_REMARKS,
  buildCredentialDraftCreationFields,
  normalizeBulkStudentIdEntries,
} from '../src/modules/credentials/draftInput.js';

const validOne = '64f0c7b67f1d2a0012345678';
const validTwo = '64f0c7b67f1d2a0012345679';

test('bulk student id input rejects an empty array', () => {
  assert.throws(
    () => normalizeBulkStudentIdEntries({ studentIds: [] }),
    /at least one student id/i
  );
});

test('bulk student id input deduplicates ids and reports invalid ids safely', () => {
  const entries = normalizeBulkStudentIdEntries({
    studentIds: [validOne, validOne, 'not-an-object-id', validTwo],
  });

  assert.deepEqual(
    entries.map((entry) => entry.studentId),
    [validOne, 'not-an-object-id', validTwo]
  );
  assert.equal(entries[0].valid, true);
  assert.equal(entries[1].valid, false);
  assert.match(entries[1].reason, /invalid student id/i);
});

test('TOR draft input defaults remarks to General Purposes', () => {
  const input = buildCredentialDraftCreationFields({ credentialType: 'TOR' });

  assert.equal(input.credentialType, 'tor');
  assert.equal(input.remarks, DEFAULT_TOR_REMARKS);
  assert.equal(input.notes, DEFAULT_TOR_REMARKS);
});

test('TOR draft input trims and preserves custom remarks', () => {
  const input = buildCredentialDraftCreationFields({
    credentialType: 'transcript of records',
    remarks: '  Board exam application  ',
  });

  assert.equal(input.credentialType, 'tor');
  assert.equal(input.remarks, 'Board exam application');
  assert.equal(input.notes, 'Board exam application');
});

test('Diploma draft input clears stale remarks and notes', () => {
  const input = buildCredentialDraftCreationFields({
    credentialType: 'Diploma',
    remarks: 'General Purposes',
    notes: 'General Purposes',
    anchorMode: 'anchor_now',
    anchorNowFee: 999,
    totalAmount: 999,
  });

  assert.equal(input.credentialType, 'diploma');
  assert.equal(input.remarks, '');
  assert.equal(input.notes, '');
  assert.equal(input.pricing.anchorMode, 'anchor_now');
  assert.equal(input.pricing.anchorNowFee, 20);
  assert.equal(input.pricing.totalAmount, 170);
});
