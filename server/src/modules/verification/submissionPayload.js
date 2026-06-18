import { ApiError } from '../../shared/utils/ApiError.js';

export const PH_VALID_ID_TYPES = [
  'Philippine Passport',
  'PhilID / National ID',
  "Driver's License",
  'UMID',
  'SSS ID',
  'GSIS eCard',
  'PRC ID',
  "Voter's ID / Voter's Certification",
  'Postal ID',
  'PhilHealth ID',
  'TIN ID',
  'Senior Citizen ID',
  'PWD ID',
  'Student ID',
  'Barangay ID / Certification',
  'NBI Clearance',
  'Police Clearance',
];

function cleanString(value, fallback = '') {
  const cleaned = String(value || '').trim();
  return cleaned || fallback;
}

function parseAnswers(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeBoolean(value) {
  return value === true || String(value || '').trim().toLowerCase() === 'true';
}

function normalizeGraduationStatus(payload = {}, answers = {}) {
  const raw = cleanString(
    payload.graduationStatus ||
      answers.graduationStatus ||
      (payload.notGraduatedYet || answers.notGraduatedYet ? 'not_graduated_yet' : '')
  ).toLowerCase();

  if (['not_graduated_yet', 'not graduated yet', 'current', 'ongoing'].includes(raw)) {
    return 'not_graduated_yet';
  }

  return 'graduated';
}

export function normalizeVerificationSubmissionPayload(payload = {}) {
  const answers = parseAnswers(payload.answers);
  const graduationStatus = normalizeGraduationStatus(payload, answers);
  const livenessPassed =
    normalizeBoolean(payload.livenessPassed) || normalizeBoolean(answers.livenessPassed);
  const idFrontUrl = cleanString(payload.validIdFrontUrl || payload.idFrontUrl);
  const idBackUrl = cleanString(payload.validIdBackUrl || payload.idBackUrl);
  const validIdType = cleanString(payload.validIdType || answers.validIdType);

  const normalized = {
    answers,
    fullName: cleanString(payload.fullName || answers.fullName),
    address: cleanString(payload.address || answers.address),
    program: cleanString(payload.program || answers.program),
    yearGraduated:
      graduationStatus === 'not_graduated_yet'
        ? ''
        : cleanString(payload.yearGraduated || answers.yearGraduated),
    graduationStatus,
    contactNo: cleanString(payload.contactNo || answers.contactNo || answers.contactNumber),
    submittedStudentNo: cleanString(
      payload.submittedStudentNo ||
        payload.studentNo ||
        answers.studentNo ||
        answers.studentNumber
    ),
    validIdType,
    idFrontUrl,
    idBackUrl,
    validIdFrontUrl: idFrontUrl,
    validIdBackUrl: idBackUrl,
    livenessImageUrl: cleanString(payload.livenessImageUrl || payload.selfieUrl),
    livenessPassed,
    livenessMethod: cleanString(payload.livenessMethod || answers.livenessMethod),
    livenessPassedAt: payload.livenessPassedAt || answers.livenessPassedAt || null,
  };

  if (!normalized.fullName) throw new ApiError(400, 'Full name is required');
  if (!normalized.address) throw new ApiError(400, 'Address is required');
  if (!normalized.program) throw new ApiError(400, 'Program is required');
  if (graduationStatus === 'graduated' && !normalized.yearGraduated) {
    throw new ApiError(400, 'Year graduated is required');
  }
  if (!normalized.contactNo) throw new ApiError(400, 'Contact number is required');
  if (!validIdType) throw new ApiError(400, 'Valid ID type is required');
  if (!idFrontUrl) throw new ApiError(400, 'Valid ID front image is required');
  if (!idBackUrl) throw new ApiError(400, 'Valid ID back image is required');
  if (!normalized.livenessImageUrl) throw new ApiError(400, 'Selfie/liveness image is required');
  if (!livenessPassed) throw new ApiError(400, 'Liveness check must pass before submission');
  if (answers.confirmed !== true && answers.confirmed !== 'true') {
    throw new ApiError(400, 'Confirmation is required');
  }

  return normalized;
}
