import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  USER: '@bvcs.user',
  SESSION_ID: '@bvcs.sessionId',
  TOKEN: '@bvcs.token',
  CREDENTIALS: '@bvcs.credentials',
  NOTIFICATIONS: '@bvcs.notifications',
  DELETED_NOTIFICATION_IDS: '@bvcs.deletedNotificationIds',
  LAST_SEEN_AT: '@bvcs.lastSeenAt',
  DEVICE_ID: '@bvcs.deviceId',
  BIOMETRICS_ENABLED: '@bvcs.biometricsEnabled',
  BIOMETRICS_PROMPTED: '@bvcs.biometricsPrompted'
};

async function storageSet(key, value) {
  if (!value) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await AsyncStorage.setItem(key, String(value));
}

async function storageGet(key) {
  return AsyncStorage.getItem(key);
}

export async function saveSession({ token, sessionId, user }) {
  await Promise.all([
    storageSet(STORAGE_KEYS.TOKEN, token),
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
    storageGet(STORAGE_KEYS.TOKEN),
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
    AsyncStorage.multiRemove([
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.USER,
      STORAGE_KEYS.SESSION_ID
    ])
  ]);
}

export async function getSessionToken() {
  return storageGet(STORAGE_KEYS.TOKEN);
}

export async function hasSavedSession() {
  const { token, user } = await loadSession();
  return Boolean(token && user);
}

export async function getBiometricsEnabled() {
  return readJson(STORAGE_KEYS.BIOMETRICS_ENABLED, false);
}

export async function setBiometricsEnabled(value) {
  await writeJson(STORAGE_KEYS.BIOMETRICS_ENABLED, Boolean(value));
}

export async function getBiometricsPrompted() {
  return readJson(STORAGE_KEYS.BIOMETRICS_PROMPTED, false);
}

export async function setBiometricsPrompted(value) {
  await writeJson(STORAGE_KEYS.BIOMETRICS_PROMPTED, Boolean(value));
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
