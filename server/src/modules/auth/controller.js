import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as authService from './service.js';

export const bootstrapSuperAdmin = asyncHandler(async (req, res) => {
  const result = await authService.bootstrapSuperAdmin(req.body, req);
  res.status(201).json(result);
});

export const createWebUser = asyncHandler(async (req, res) => {
  const result = await authService.createWebUser(req.body, req.user);
  res.status(201).json(result);
});

export const registerMobile = asyncHandler(async (req, res) => {
  const result = await authService.registerMobile(req.body, req);
  res.status(201).json(result);
});

export const loginWeb = asyncHandler(async (req, res) => {
  const result = await authService.loginWeb(req.body, req);
  res.status(200).json(result);
});

export const loginMobile = asyncHandler(async (req, res) => {
  const result = await authService.loginMobile(req.body, req);
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
  res.status(200).json(result);
});
