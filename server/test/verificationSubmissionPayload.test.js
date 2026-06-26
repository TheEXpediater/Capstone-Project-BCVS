import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PH_VALID_ID_TYPES,
  normalizeVerificationSubmissionPayload,
} from '../src/modules/verification/submissionPayload.js';

test('verification submission payload accepts required identity and liveness metadata without storing a selfie', () => {
  const payload = normalizeVerificationSubmissionPayload({
    answers: JSON.stringify({ confirmed: true }),
    fullName: 'Maria Santos',
    address: 'Magalang, Pampanga',
    program: 'BS Agriculture',
    yearGraduated: '2025',
    contactNo: '09171234567',
    validIdType: 'PhilID / National ID',
    idFrontUrl: '/uploads/front.jpg',
    idBackUrl: '/uploads/back.jpg',
    livenessPassed: 'true',
    livenessPassedAt: '2026-06-19T00:00:00.000Z',
    livenessMethod: 'faceVerifierLocal',
  });

  assert.equal(PH_VALID_ID_TYPES.includes('PhilID / National ID'), true);
  assert.equal(payload.fullName, 'Maria Santos');
  assert.equal(payload.address, 'Magalang, Pampanga');
  assert.equal(payload.program, 'BS Agriculture');
  assert.equal(payload.yearGraduated, '2025');
  assert.equal(payload.graduationStatus, 'graduated');
  assert.equal(payload.contactNo, '09171234567');
  assert.equal(payload.validIdType, 'PhilID / National ID');
  assert.equal(payload.validIdFrontUrl, '/uploads/front.jpg');
  assert.equal(payload.validIdBackUrl, '/uploads/back.jpg');
  assert.equal(payload.livenessPassed, true);
  assert.equal(Object.hasOwn(payload, `liveness${'Image'}Url`), false);
  assert.equal(Object.hasOwn(payload, 'selfieUrl'), false);
});

test('verification submission payload allows not graduated yet status', () => {
  const payload = normalizeVerificationSubmissionPayload({
    answers: { confirmed: true },
    fullName: 'Juan Dela Cruz',
    address: 'Pampanga',
    program: 'BS Information Technology',
    graduationStatus: 'not_graduated_yet',
    contactNo: '09170000000',
    validIdType: 'Student ID',
    idFrontUrl: '/uploads/front.jpg',
    idBackUrl: '/uploads/back.jpg',
    livenessPassed: true,
  });

  assert.equal(payload.yearGraduated, '');
  assert.equal(payload.graduationStatus, 'not_graduated_yet');
});

test('verification submission payload rejects missing ID sides and failed liveness', () => {
  const base = {
    answers: { confirmed: true },
    fullName: 'Juan Dela Cruz',
    address: 'Pampanga',
    program: 'BS Agriculture',
    yearGraduated: '2024',
    contactNo: '09170000000',
    validIdType: 'Student ID',
    idFrontUrl: '/uploads/front.jpg',
    idBackUrl: '/uploads/back.jpg',
    livenessPassed: true,
  };

  assert.throws(
    () => normalizeVerificationSubmissionPayload({ ...base, idBackUrl: '' }),
    /back image is required/i
  );
  assert.throws(
    () => normalizeVerificationSubmissionPayload({ ...base, livenessPassed: false }),
    /liveness check must pass/i
  );
  assert.throws(
    () => normalizeVerificationSubmissionPayload({ ...base, validIdType: '' }),
    /valid ID type is required/i
  );
});
