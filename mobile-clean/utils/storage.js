import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const STORAGE_KEYS = {
  USER: '@bvcs.user',
  SESSION_ID: '@bvcs.sessionId',
  TOKEN: '@bvcs.token',
  CREDENTIALS: '@bvcs.credentials',
  NOTIFICATIONS: '@bvcs.notifications',
  LAST_SEEN_AT: '@bvcs.lastSeenAt'
};

async function secureSet(key, value) {
  if (!value) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await SecureStore.setItemAsync(key, String(value));
}

async function secureGet(key) {
  return SecureStore.getItemAsync(key);
}

export async function saveSession({ token, sessionId, user }) {
  await Promise.all([
    secureSet(STORAGE_KEYS.TOKEN, token),
    sessionId
      ? AsyncStorage.setItem(STORAGE_KEYS.SESSION_ID, String(sessionId))
      : AsyncStorage.removeItem(STORAGE_KEYS.SESSION_ID),
    user
      ? AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
      : AsyncStorage.removeItem(STORAGE_KEYS.USER)
  ]);
}

export async function loadSession() {
  const [token, sessionId, rawUser] = await Promise.all([
    secureGet(STORAGE_KEYS.TOKEN),
    AsyncStorage.getItem(STORAGE_KEYS.SESSION_ID),
    AsyncStorage.getItem(STORAGE_KEYS.USER)
  ]);

  let user = null;
  try {
    user = rawUser ? JSON.parse(rawUser) : null;
  } catch {
    user = null;
  }

  return { token, sessionId, user };
}

export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN),
    AsyncStorage.multiRemove([STORAGE_KEYS.USER, STORAGE_KEYS.SESSION_ID])
  ]);
}

export async function getSessionToken() {
  return secureGet(STORAGE_KEYS.TOKEN);
}

export async function readJson(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJson(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

