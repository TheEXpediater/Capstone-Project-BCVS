import { ENDPOINTS } from '@/constants/config';
import { api, apiErrorMessage, clearApiAuthState } from '@/services/apiClient';
import { clearSession, saveSession } from '@/utils/storage';

function normalizeAuthResponse(data) {
  const user = data?.user || data?.data?.user || data;
  const token = data?.token || data?.data?.token || user?.token || '';
  const sessionId = data?.sessionId || data?.session_id || data?.data?.sessionId || '';

  return {
    token,
    sessionId,
    user: token ? { ...user, token: undefined } : user
  };
}

export async function login({ email, password }) {
  try {
    const { data } = await api.post(ENDPOINTS.auth.login, { email, password });
    const session = normalizeAuthResponse(data);
    await saveSession(session);
    return session;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Login failed'));
  }
}

export async function register({ username, fullName, email, password, studentId }) {
  try {
    const payload = {
      username,
      fullName: fullName || username,
      email,
      password,
      studentId: studentId || ''
    };
    const { data } = await api.post(ENDPOINTS.auth.register, payload);
    const session = normalizeAuthResponse(data);
    await saveSession(session);
    return session;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Registration failed'));
  }
}

export async function fetchMe() {
  try {
    const { data } = await api.get(ENDPOINTS.auth.me);
    return data?.user || data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to load account'));
  }
}

export async function logout() {
  try {
    await api.post(ENDPOINTS.auth.logout);
  } catch {
    // Local logout should still complete if the API is unavailable.
  }
  await clearSession();
  clearApiAuthState();
}

export async function requestEmailOtp(email) {
  try {
    const { data } = await api.post(ENDPOINTS.otp.requestEmail, { email });
    return data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to send verification code'));
  }
}

export async function verifyEmailOtp({ email, code }) {
  try {
    const { data } = await api.post(ENDPOINTS.otp.verifyEmail, { email, code });
    return data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Invalid verification code'));
  }
}

export async function requestPasswordResetOtp(email) {
  try {
    const { data } = await api.post(ENDPOINTS.otp.requestPasswordReset, { email });
    return data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to send reset code'));
  }
}

export async function verifyPasswordResetOtp({ email, code }) {
  try {
    const { data } = await api.post(ENDPOINTS.otp.verifyPasswordReset, { email, code });
    return data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Invalid reset code'));
  }
}

export async function resetPassword({ email, resetSession, newPassword }) {
  try {
    const { data } = await api.post(ENDPOINTS.otp.resetPassword, {
      email,
      resetSession,
      newPassword
    });
    return data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to reset password'));
  }
}

