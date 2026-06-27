import bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'node:crypto';
import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { ApiError } from '../../shared/utils/ApiError.js';
import { signAccessToken } from '../../shared/utils/jwt.js';
import { getRoleModel } from './role.model.js';
import { getUserModel } from './user.model.js';
import { getSessionModel } from './session.model.js';
import { getEmailOtpStatus } from '../settings/setting.service.js';
import { sendOtpEmail } from '../email/service.js';

const DEFAULT_ROLES = [
  {
    key: 'super_admin',
    label: 'Super Admin',
    clientType: 'web',
    permissions: ['auth.bootstrap', 'auth.createWebUser', 'auth.manageAllUsers', 'platform.fullAccess'],
    description: 'Registrar head and highest platform authority.',
  },
  {
    key: 'admin',
    label: 'Admin',
    clientType: 'web',
    permissions: ['students.read', 'credentials.issue', 'verification.read'],
    description: 'School staff that issue credentials.',
  },
  {
    key: 'developer',
    label: 'Developer',
    clientType: 'web',
    permissions: ['platform.contracts', 'platform.settings', 'platform.audit'],
    description: 'MIS technical operator.',
  },
  {
    key: 'cashier',
    label: 'Cashier',
    clientType: 'web',
    permissions: ['payments.read', 'payments.update'],
    description: 'Cashier-side financial operator.',
  },
  {
    key: 'student',
    label: 'Student',
    clientType: 'mobile',
    permissions: ['mobile.me', 'mobile.credentials'],
    description: 'Mobile holder account.',
  },
];

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const otpStore = new Map();
const resetSessions = new Map();

function cleanString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function buildUsername(payload = {}) {
  const explicit = cleanString(payload?.username);
  if (explicit) return explicit;

  const fromName = cleanString(payload?.fullName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');

  if (fromName) return fromName.slice(0, 100);

  const email = cleanString(payload?.email).toLowerCase();
  if (email.includes('@')) return email.split('@')[0].slice(0, 100);

  return `user-${Date.now()}`;
}

function sanitizeUser(user) {
  const baseUser = {
    _id: user._id,
    username: user.username,
    fullName: user.fullName || '',
    email: user.email,
    role: user.role,
    kind: user.kind,
    profilePicture: user.profilePicture || '',
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  if (user.kind === 'mobile') {
    return {
      ...baseUser,
      studentId: user.studentId || '',
      contactNo: user.contactNo || '',
      address: user.address || '',
      addressLine: user.addressLine || '',
      cityMunicipality: user.cityMunicipality || '',
      province: user.province || '',
      program: user.program || '',
      yearGraduated: user.yearGraduated || '',
      graduationStatus: user.graduationStatus || '',
      verified:
        user.verified === true || String(user.verified || '').toLowerCase() === 'true'
          ? 'verified'
          : user.verified ?? 'unverified',
      verifiedAt: user.verifiedAt || null,
    };
  }

  return baseUser;
}

function normalizeAccountType(kind) {
  return kind === 'mobile' ? 'mobile' : 'web';
}

function normalizeUserStatus(user) {
  const rawStatus = String(user.status || user.accountStatus || '').trim().toLowerCase();

  if (rawStatus === 'suspended') {
    return 'suspended';
  }

  return user.isActive ? 'active' : 'inactive';
}

function normalizeManagedUser(user) {
  const normalized = {
    id: String(user._id),
    fullName: user.fullName || user.username || '',
    email: user.email || '',
    accountType: normalizeAccountType(user.kind),
    role: user.role,
    status: normalizeUserStatus(user),
    createdAt: user.createdAt,
  };

  if (user.kind === 'mobile') {
    const verificationStatus =
      user.verified === true || String(user.verified || '').toLowerCase() === 'true'
        ? 'verified'
        : user.verified || 'unverified';

    normalized.studentId = user.studentId || '';
    normalized.verified = verificationStatus;
    normalized.verificationStatus = verificationStatus;
    normalized.linkedStatus = cleanString(user.studentId) ? 'linked' : 'unlinked';
  }

  return normalized;
}

function otpStoreKey(purpose, email) {
  return `${purpose}:${cleanString(email).toLowerCase()}`;
}

function generateOtpCode() {
  return String(randomInt(100000, 1000000));
}

function saveOtp(purpose, email, code) {
  otpStore.set(otpStoreKey(purpose, email), {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
}

function verifyStoredOtp(purpose, email, code) {
  const key = otpStoreKey(purpose, email);
  const record = otpStore.get(key);
  const submitted = cleanString(code);

  if (!record) {
    throw new ApiError(400, 'Verification code was not requested or has expired.');
  }

  if (record.expiresAt < Date.now()) {
    otpStore.delete(key);
    throw new ApiError(400, 'Verification code has expired.');
  }

  record.attempts += 1;
  if (record.attempts > OTP_MAX_ATTEMPTS) {
    otpStore.delete(key);
    throw new ApiError(429, 'Too many verification attempts. Request a new code.');
  }

  if (record.code !== submitted) {
    throw new ApiError(400, 'Invalid verification code.');
  }

  otpStore.delete(key);
}

function createResetSession(email) {
  const token = randomBytes(24).toString('hex');
  resetSessions.set(token, {
    email: cleanString(email).toLowerCase(),
    expiresAt: Date.now() + OTP_TTL_MS,
  });
  return token;
}

function consumeResetSession(email, token) {
  const sessionToken = cleanString(token);
  const record = resetSessions.get(sessionToken);

  if (!record || record.email !== cleanString(email).toLowerCase()) {
    throw new ApiError(400, 'Password reset session is invalid or expired.');
  }

  if (record.expiresAt < Date.now()) {
    resetSessions.delete(sessionToken);
    throw new ApiError(400, 'Password reset session has expired.');
  }

  resetSessions.delete(sessionToken);
}

function getRequestContext(req) {
  return {
    ipAddress:
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.socket.remoteAddress ||
      '',
    userAgent: req.headers['user-agent'] || '',
  };
}

export async function ensureRoles() {
  const Role = getRoleModel();
  for (const role of DEFAULT_ROLES) {
    await Role.updateOne({ key: role.key }, { $setOnInsert: role }, { upsert: true });
  }
}

async function createSession(user, req) {
  const Session = getSessionModel();
  const context = getRequestContext(req);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const session = await Session.create({
    userId: user._id,
    kind: user.kind,
    role: user.role,
    userAgent: context.userAgent,
    ipAddress: context.ipAddress,
    expiresAt,
    isActive: true,
  });

  const token = signAccessToken({
    sub: user._id.toString(),
    sid: session._id.toString(),
    role: user.role,
    kind: user.kind,
  });

  user.lastLoginAt = new Date();
  await user.save();

  return {
    sessionId: session._id,
    token,
  };
}

async function buildAuthResponse(user, req) {
  const { token, sessionId } = await createSession(user, req);
  return {
    success: true,
    token,
    sessionId,
    user: sanitizeUser(user),
  };
}

export async function bootstrapSuperAdmin(payload, req) {
  await ensureRoles();
  const User = getUserModel();

  const hasAnyWebAdmin = await User.exists({
    kind: 'web',
    role: { $in: ['super_admin', 'admin', 'developer', 'cashier'] },
  });

  if (hasAnyWebAdmin) {
    throw new ApiError(403, 'Bootstrap is locked because a web admin already exists');
  }

  const existingEmail = await User.exists({ email: payload.email.toLowerCase() });
  if (existingEmail) {
    throw new ApiError(409, 'Email already exists');
  }

  const passwordHash = await bcrypt.hash(payload.password, Number(env.bcryptSaltRounds || 10));

  const user = await User.create({
    kind: 'web',
    role: 'super_admin',
    username: payload.username,
    fullName: payload.fullName,
    email: payload.email.toLowerCase(),
    password: passwordHash,
    isActive: true,
  });

  return buildAuthResponse(user, req);
}

export async function createWebUser(payload, actor) {
  await ensureRoles();
  if (!actor || !['super_admin', 'developer'].includes(actor.role)) {
    throw new ApiError(403, 'Only super admin or MIS developer can create web users');
  }

  const User = getUserModel();
  const existingEmail = await User.exists({ email: payload.email.toLowerCase() });
  if (existingEmail) {
    throw new ApiError(409, 'Email already exists');
  }

  const passwordHash = await bcrypt.hash(payload.password, Number(env.bcryptSaltRounds || 10));

  const user = await User.create({
    kind: 'web',
    role: payload.role,
    username: buildUsername(payload),
    fullName: payload.fullName,
    email: payload.email.toLowerCase(),
    password: passwordHash,
    contactNo: payload.contactNo || '',
    address: payload.address || '',
    profilePicture: payload.profilePicture || '',
    isActive: payload.isActive !== false,
  });

  return {
    success: true,
    user: sanitizeUser(user),
  };
}

export async function createMobileUser(payload, actor) {
  await ensureRoles();
  if (!actor || !['super_admin', 'developer'].includes(actor.role)) {
    throw new ApiError(403, 'Only super admin or MIS developer can create mobile users');
  }

  const User = getUserModel();
  const existingEmail = await User.exists({ email: payload.email.toLowerCase() });
  if (existingEmail) {
    throw new ApiError(409, 'Email already exists');
  }

  const passwordHash = await bcrypt.hash(payload.password, Number(env.bcryptSaltRounds || 10));

  const user = await User.create({
    kind: 'mobile',
    role: 'student',
    username: buildUsername(payload),
    fullName: payload.fullName,
    email: payload.email.toLowerCase(),
    password: passwordHash,
    studentId: payload.studentId || '',
    verified: 'unverified',
    isActive: payload.isActive !== false,
  });

  return {
    success: true,
    user: sanitizeUser(user),
  };
}

export async function listWebUsers() {
  await ensureRoles();
  const User = getUserModel();
  const users = await User.find(
    { kind: 'web', role: { $in: ['super_admin', 'developer', 'admin', 'cashier'] } },
    '-password'
  )
    .sort({ createdAt: -1 })
    .lean();

  return {
    success: true,
    users: users.map((user) => sanitizeUser(user)),
  };
}

export async function listAllUsers(query = {}) {
  await ensureRoles();
  const User = getUserModel();

  const accountType = String(query.accountType || '').trim().toLowerCase();
  const role = String(query.role || '').trim().toLowerCase();
  const status = String(query.status || '').trim().toLowerCase();

  const filter = {
    kind: { $in: ['web', 'mobile'] },
  };

  if (accountType === 'web' || accountType === 'mobile') {
    filter.kind = accountType;
  }

  if (['student', 'admin', 'super_admin', 'developer', 'cashier'].includes(role)) {
    filter.role = role;
  }

  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  const normalized = users
    .map((user) => normalizeManagedUser(user))
    .filter((user) => {
      if (!['active', 'inactive', 'suspended'].includes(status)) {
        return true;
      }

      return user.status === status;
    });

  return {
    users: normalized,
  };
}

export async function registerMobile(payload, req) {
  await ensureRoles();
  const User = getUserModel();

  const existingEmail = await User.exists({ email: payload.email.toLowerCase() });
  if (existingEmail) {
    throw new ApiError(409, 'Email already exists');
  }

  const passwordHash = await bcrypt.hash(payload.password, Number(env.bcryptSaltRounds || 10));

  const user = await User.create({
    kind: 'mobile',
    role: 'student',
    username: buildUsername(payload),
    fullName: payload.fullName || payload.username,
    email: payload.email.toLowerCase(),
    password: passwordHash,
    studentId: payload.studentId || '',
    contactNo: payload.contactNo || '',
    address: payload.address || '',
    addressLine: payload.addressLine || '',
    cityMunicipality: payload.cityMunicipality || '',
    province: payload.province || '',
    program: payload.program || '',
    yearGraduated: payload.yearGraduated || '',
    graduationStatus: payload.graduationStatus || '',
    verified: 'unverified',
    isActive: true,
  });

  return buildAuthResponse(user, req);
}

async function loginByKind(kind, payload, req) {
  await ensureRoles();
  const User = getUserModel();

  const user = await User.findOne({ email: payload.email.toLowerCase(), kind }).select('+password');
  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Account is inactive');
  }

  const passwordOk = await bcrypt.compare(payload.password, user.password);
  if (!passwordOk) {
    throw new ApiError(401, 'Invalid credentials');
  }

  if (kind === 'web' && !['super_admin', 'admin', 'developer', 'cashier'].includes(user.role)) {
    throw new ApiError(403, 'This account is not allowed to log in to the web client');
  }

  if (kind === 'mobile' && user.role !== 'student') {
    throw new ApiError(403, 'This account is not allowed to log in to the mobile client');
  }

  return buildAuthResponse(user, req);
}

export async function loginWeb(payload, req) {
  return loginByKind('web', payload, req);
}

export async function loginMobile(payload, req) {
  return loginByKind('mobile', payload, req);
}

export async function requestMobileEmailOtp(payload = {}) {
  const email = cleanString(payload.email).toLowerCase();
  if (!email) throw new ApiError(400, 'Email is required');

  const status = await getEmailOtpStatus();
  if (!status.enabled) {
    return {
      success: true,
      emailDisabled: true,
      bypassAllowed: true,
      message: 'Email OTP is currently disabled by MIS.',
    };
  }

  if (!status.configured) {
    throw new ApiError(409, 'Email OTP is enabled but the email provider is not configured by MIS.');
  }

  const code = generateOtpCode();
  await sendOtpEmail({ to: email, code, purpose: 'registration' });
  saveOtp('registration', email, code);

  return {
    success: true,
    emailSent: true,
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
  };
}

export async function verifyMobileEmailOtp(payload = {}) {
  const email = cleanString(payload.email).toLowerCase();
  if (!email) throw new ApiError(400, 'Email is required');

  const status = await getEmailOtpStatus();
  if (!status.enabled) {
    return {
      success: true,
      verified: true,
      emailDisabled: true,
      message: 'Email OTP is currently disabled by MIS.',
    };
  }

  verifyStoredOtp('registration', email, payload.code);

  return {
    success: true,
    verified: true,
  };
}

export async function requestMobilePasswordResetOtp(payload = {}) {
  const email = cleanString(payload.email).toLowerCase();
  if (!email) throw new ApiError(400, 'Email is required');

  const status = await getEmailOtpStatus();
  if (!status.enabled) {
    return {
      success: false,
      emailDisabled: true,
      message: 'Email OTP is currently disabled by MIS. Please contact the registrar or MIS.',
    };
  }

  if (!status.configured) {
    throw new ApiError(409, 'Password reset email is enabled but the email provider is not configured by MIS.');
  }

  const User = getUserModel();
  const user = await User.findOne({ email, kind: 'mobile' }).lean();
  if (!user) {
    throw new ApiError(404, 'No mobile account was found for this email.');
  }

  const code = generateOtpCode();
  await sendOtpEmail({ to: email, code, purpose: 'password_reset' });
  saveOtp('password_reset', email, code);

  return {
    success: true,
    emailSent: true,
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
  };
}

export async function verifyMobilePasswordResetOtp(payload = {}) {
  const email = cleanString(payload.email).toLowerCase();
  if (!email) throw new ApiError(400, 'Email is required');

  const status = await getEmailOtpStatus();
  if (!status.enabled) {
    throw new ApiError(409, 'Email OTP is currently disabled by MIS. Please contact the registrar or MIS.');
  }

  verifyStoredOtp('password_reset', email, payload.code);

  return {
    success: true,
    verified: true,
    resetSession: createResetSession(email),
  };
}

export async function resetMobilePassword(payload = {}) {
  const email = cleanString(payload.email).toLowerCase();
  const newPassword = cleanString(payload.newPassword || payload.password);

  if (!email) throw new ApiError(400, 'Email is required');
  if (newPassword.length < 8) throw new ApiError(400, 'New password must be at least 8 characters.');

  const status = await getEmailOtpStatus();
  if (!status.enabled) {
    throw new ApiError(409, 'Email OTP is currently disabled by MIS. Please contact the registrar or MIS.');
  }

  consumeResetSession(email, payload.resetSession || payload.reset_session);

  const User = getUserModel();
  const user = await User.findOne({ email, kind: 'mobile' }).select('+password');
  if (!user) {
    throw new ApiError(404, 'No mobile account was found for this email.');
  }

  user.password = await bcrypt.hash(newPassword, Number(env.bcryptSaltRounds || 10));
  await user.save();

  return {
    success: true,
    message: 'Password updated successfully.',
  };
}

export async function getMe(userId) {
  const User = getUserModel();

  if (!Types.ObjectId.isValid(userId)) {
    throw new ApiError(401, 'Invalid authenticated user');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return {
    success: true,
    user: sanitizeUser(user),
  };
}

export async function logout(sessionId) {
  const Session = getSessionModel();

  if (!Types.ObjectId.isValid(sessionId)) {
    throw new ApiError(400, 'Invalid session');
  }

  await Session.findByIdAndUpdate(sessionId, {
    isActive: false,
    logoutAt: new Date(),
  });

  return {
    success: true,
    message: 'Logged out successfully',
  };
}
