import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};

function trimSlashes(value) {
  return String(value || '').replace(/\/+$/, '');
}

const configuredOrigin =
  process.env.EXPO_PUBLIC_API_URL ||
  extra.API_URL ||
  'http://localhost:5000';

export const API_ORIGIN = trimSlashes(configuredOrigin);
export const API_BASE_URL = /\/api$/.test(API_ORIGIN)
  ? API_ORIGIN
  : `${API_ORIGIN}/api`;

export const WEB_BASE_URL = trimSlashes(
  process.env.EXPO_PUBLIC_WEB_BASE || extra.WEB_BASE || ''
);

export const EAS_PROJECT_ID =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
  extra.eas?.projectId ||
  '';

export const ENDPOINTS = {
  auth: {
    login: '/auth/mobile/login',
    register: '/auth/mobile/register',
    me: '/auth/mobile/me',
    logout: '/auth/logout'
  },
  otp: {
    requestEmail: '/auth/mobile/otp/request',
    verifyEmail: '/auth/mobile/otp/verify',
    requestPasswordReset: '/auth/mobile/password/forgot',
    verifyPasswordReset: '/auth/mobile/password/verify',
    resetPassword: '/auth/mobile/password/reset'
  },
  credentials: {
    list: '/mobile/credentials',
    claim: '/mobile/credentials/claim'
  },
  verification: {
    createSession: '/verification/session',
    session: (sessionId) => `/verification/session/${encodeURIComponent(sessionId)}`,
    present: (sessionId) => `/verification/session/${encodeURIComponent(sessionId)}/present`
  },
  notifications: {
    registerPush: '/push/register',
    history: '/mobile/notifications'
  }
};
