import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_ADMISSION_YEAR,
  DEFAULT_GRADUATION_YEAR,
  resolveSeedLifecycle,
} from '../src/script/seed/lifecycle.js';

test('default seed lifecycle represents a completed 2026 graduate cohort', () => {
  const lifecycle = resolveSeedLifecycle({});

  assert.equal(DEFAULT_ADMISSION_YEAR, '2022');
  assert.equal(DEFAULT_GRADUATION_YEAR, '2026');
  assert.equal(lifecycle.admissionYear, '2022');
  assert.equal(lifecycle.graduationYear, '2026');
  assert.equal(lifecycle.dateAdmission, '2022-08-01');
  assert.equal(lifecycle.dateGraduated, '2026-06-30');
  assert.equal(lifecycle.dateGraduation, '2026-06-15');
  assert.equal(lifecycle.studentStatus, 'graduated');
  assert.equal(lifecycle.academicStatus, 'completed');
});

test('seed lifecycle never derives a 2030 graduation year from the current year', () => {
  const lifecycle = resolveSeedLifecycle({ curriculumYear: '2026' });

  assert.equal(lifecycle.graduationYear, '2026');
  assert.notEqual(lifecycle.graduationYear, '2030');
  assert.equal(new Date(lifecycle.dateGraduated).getFullYear(), 2026);
});
