export const DEFAULT_ADMISSION_YEAR = '2022';
export const DEFAULT_GRADUATION_YEAR = '2026';
export const DEFAULT_SCHOOL_YEAR = '2025-2026';
export const DEFAULT_DATE_ADMISSION = `${DEFAULT_ADMISSION_YEAR}-08-01`;
export const DEFAULT_DATE_GRADUATED = `${DEFAULT_GRADUATION_YEAR}-06-30`;
export const DEFAULT_DATE_GRADUATION = `${DEFAULT_GRADUATION_YEAR}-06-15`;

export function cleanString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

export function firstFourDigitYear(value, fallback = DEFAULT_ADMISSION_YEAR) {
  const match = cleanString(value).match(/\d{4}/);
  return match ? match[0] : fallback;
}

export function isValidISODate(value) {
  const raw = cleanString(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return false;

  const [, year, month, day] = match;
  const parsed = new Date(`${raw}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getUTCFullYear() === Number(year) &&
    parsed.getUTCMonth() + 1 === Number(month) &&
    parsed.getUTCDate() === Number(day)
  );
}

function resolveLifecycleDate(fieldName, value, fallback) {
  const resolved = cleanString(value, fallback);

  if (!isValidISODate(resolved)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD.`);
  }

  return resolved;
}

export function resolveSeedLifecycle(options = {}) {
  const admissionYear = firstFourDigitYear(
    options.admissionYear || options.curriculumYear || DEFAULT_ADMISSION_YEAR,
    DEFAULT_ADMISSION_YEAR
  );
  const graduationYear = firstFourDigitYear(
    options.graduationYear || DEFAULT_GRADUATION_YEAR,
    DEFAULT_GRADUATION_YEAR
  );

  return {
    admissionYear,
    graduationYear,
    schoolYear: cleanString(options.schoolYear, DEFAULT_SCHOOL_YEAR),
    dateAdmission: resolveLifecycleDate('dateAdmission', options.dateAdmission, `${admissionYear}-08-01`),
    dateGraduated: resolveLifecycleDate('dateGraduated', options.dateGraduated, `${graduationYear}-06-30`),
    dateGraduation: resolveLifecycleDate('dateGraduation', options.dateGraduation, `${graduationYear}-06-15`),
    studentStatus: 'graduated',
    academicStatus: 'completed',
  };
}
