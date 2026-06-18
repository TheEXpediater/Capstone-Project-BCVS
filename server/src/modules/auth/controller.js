import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { writeAuditLog } from '../audit/service.js';
import * as authService from './service.js';

function userTarget(user = {}) {
  return {
    id: String(user?._id || user?.id || ''),
    type: user?.kind === 'mobile' ? 'mobile_user' : 'web_user',
    label: String(user?.fullName || user?.username || user?.email || ''),
  };
}

async function logAuthAction(req, action, result, description, module = 'auth') {
  const targetUser = result?.user || req.user || null;
  const actorUser = req.user || targetUser;

  await writeAuditLog({
    req,
    user: actorUser,
    module,
    action,
    label: description,
    description,
    target: userTarget(targetUser),
    metadata: {
      targetUserId: targetUser?._id || targetUser?.id || '',
      targetUsername: targetUser?.username || '',
      targetRole: targetUser?.role || '',
      targetKind: targetUser?.kind || '',
      targetEmail: targetUser?.email || '',
    },
  });
}

export const bootstrapSuperAdmin = asyncHandler(async (req, res) => {
  const result = await authService.bootstrapSuperAdmin(req.body, req);
  res.status(201).json(result);
});

export const createWebUser = asyncHandler(async (req, res) => {
  const result = await authService.createWebUser(req.body, req.user);
  await logAuthAction(req, 'CREATE_USER', result, 'Created web user account', 'users');
  res.status(201).json(result);
});

export const createMobileUser = asyncHandler(async (req, res) => {
  const result = await authService.createMobileUser(req.body, req.user);
  await logAuthAction(req, 'CREATE_USER', result, 'Created mobile user account', 'users');
  res.status(201).json(result);
});

export const listWebUsers = asyncHandler(async (_req, res) => {
  const result = await authService.listWebUsers();
  res.status(200).json(result);
});

export const listAllUsers = asyncHandler(async (req, res) => {
  const result = await authService.listAllUsers(req.query);
  res.status(200).json(result);
});

export const registerMobile = asyncHandler(async (req, res) => {
  const result = await authService.registerMobile(req.body, req);
  await logAuthAction(req, 'CREATE_USER', result, 'Mobile user registered', 'users');
  res.status(201).json(result);
});

export const loginWeb = asyncHandler(async (req, res) => {
  const result = await authService.loginWeb(req.body, req);
  await logAuthAction(req, 'WEB_LOGIN', result, 'Web user logged in');
  res.status(200).json(result);
});

export const loginMobile = asyncHandler(async (req, res) => {
  const result = await authService.loginMobile(req.body, req);
  await logAuthAction(req, 'MOBILE_LOGIN', result, 'Mobile user logged in', 'mobile');
  res.status(200).json(result);
});

export const requestMobileEmailOtp = asyncHandler(async (req, res) => {
  const result = await authService.requestMobileEmailOtp(req.body || {});
  res.status(200).json(result);
});

export const verifyMobileEmailOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyMobileEmailOtp(req.body || {});
  res.status(200).json(result);
});

export const requestMobilePasswordResetOtp = asyncHandler(async (req, res) => {
  const result = await authService.requestMobilePasswordResetOtp(req.body || {});
  res.status(200).json(result);
});

export const verifyMobilePasswordResetOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyMobilePasswordResetOtp(req.body || {});
  res.status(200).json(result);
});

export const resetMobilePassword = asyncHandler(async (req, res) => {
  const result = await authService.resetMobilePassword(req.body || {});
  res.status(200).json(result);
});

export const getWebMe = asyncHandler(async (req, res) => {
  const result = await authService.getMe(req.user._id.toString());
  res.status(200).json(result);
});

export const getMobileMe = asyncHandler(async (req, res) => {
  const result = await authService.getMe(req.user._id.toString());
  res.status(200).json(result);
});

export const logout = asyncHandler(async (req, res) => {
  const result = await authService.logout(req.auth.sessionId);
  await logAuthAction(req, 'LOGOUT', { user: req.user }, 'User logged out');
  res.status(200).json(result);
});
