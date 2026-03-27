// server/src/modules/auth/service.js
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { ApiError } from '../../shared/utils/ApiError.js';
import { signAccessToken } from '../../shared/utils/jwt.js';
import { getRoleModel } from './role.model.js';
import { getUserModel } from './user.model.js';
import { getSessionModel } from './session.model.js';

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
      verified: user.verified ?? 'unverified',
    };
  }

  return baseUser;
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

async function ensureRoles() {
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

export async function createWebUser(payload) {
  await ensureRoles();
  const User = getUserModel();

  const existingEmail = await User.exists({ email: payload.email.toLowerCase() });
  if (existingEmail) {
    throw new ApiError(409, 'Email already exists');
  }

  const passwordHash = await bcrypt.hash(payload.password, Number(env.bcryptSaltRounds || 10));

  const user = await User.create({
    kind: 'web',
    role: payload.role,
    username: payload.username,
    fullName: payload.fullName,
    email: payload.email.toLowerCase(),
    password: passwordHash,
    contactNo: payload.contactNo || '',
    address: payload.address || '',
    profilePicture: payload.profilePicture || '',
    isActive: true,
  });

  return {
    success: true,
    user: sanitizeUser(user),
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
    username: payload.username,
    fullName: payload.fullName || payload.username,
    email: payload.email.toLowerCase(),
    password: passwordHash,
    studentId: payload.studentId || '',
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