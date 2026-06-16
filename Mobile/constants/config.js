import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = Constants.expoConfig?.extra || {};

function trimSlashes(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function firstValue(...values) {
  return values.map(trimSlashes).find(Boolean) || '';
}

function resolveDevHost() {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.manifest?.hostUri,
    Constants.manifest?.debuggerHost,
    Constants.manifest2?.extra?.expoGo?.debuggerHost
  ];
  const rawHost = candidates.find(Boolean);

  if (rawHost) {
    const host = String(rawHost).split('/')[0].split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return host;
    }
  }

  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
}

function localDevOrigin(port) {
  return `http://${resolveDevHost()}:${port}`;
}

const configuredOrigin = firstValue(
  process.env.EXPO_PUBLIC_API_URL,
  extra.API_URL,
  localDevOrigin(5000)
);

export const API_ORIGIN = trimSlashes(configuredOrigin);
export const API_BASE_URL = /\/api$/.test(API_ORIGIN)
  ? API_ORIGIN
  : `${API_ORIGIN}/api`;

function normalizeWebBase(value) {
  const cleaned = trimSlashes(value)
    .replace(/\/verification-portal\/verify\/?$/i, '')
    .replace(/\/verification-portal\/?$/i, '')
    .replace(/\/verify\/?$/i, '');

  return cleaned;
}

export const WEB_BASE_URL = normalizeWebBase(firstValue(
  process.env.EXPO_PUBLIC_WEB_URL,
  process.env.EXPO_PUBLIC_WEB_BASE,
  extra.WEB_URL,
  extra.WEB_BASE,
  localDevOrigin(5173)
));

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
    requests: '/mobile/credentials/requests',
    request: '/mobile/credentials/request',
    claim: '/mobile/credentials/claim'
  },
  verification: {
    account: '/verification/me',
    submitAccount: '/verification/submit',
    createSession: '/verification/session',
    session: (sessionId) => `/verification/session/${encodeURIComponent(sessionId)}`,
    present: (sessionId) => `/verification/session/${encodeURIComponent(sessionId)}/present`
  },
  notifications: {
    registerPush: '/push/register',
    history: '/mobile/notifications'
  },
  uploads: {
    health: '/health',
    testImage: '/uploads/test-image'
  }
};


