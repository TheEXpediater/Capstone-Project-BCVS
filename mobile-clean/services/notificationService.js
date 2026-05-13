import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { EAS_PROJECT_ID, ENDPOINTS } from '@/constants/config';
import { api, apiErrorMessage } from '@/services/apiClient';
import { readJson, STORAGE_KEYS, writeJson } from '@/utils/storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

export async function getLocalHistory() {
  return readJson(STORAGE_KEYS.NOTIFICATIONS, []);
}

export async function saveLocalEvent(event) {
  const current = await getLocalHistory();
  const normalized = {
    id: event?.id || `${event?.type || 'event'}-${Date.now()}`,
    title: event?.title || 'Activity',
    body: event?.body || event?.desc || '',
    type: event?.type || 'activity',
    data: event?.data || {},
    createdAt: event?.createdAt || new Date().toISOString()
  };
  const next = [normalized, ...current.filter((item) => item.id !== normalized.id)].slice(0, 100);
  await writeJson(STORAGE_KEYS.NOTIFICATIONS, next);
  return normalized;
}

export async function fetchHistory() {
  try {
    const { data } = await api.get(ENDPOINTS.notifications.history);
    const remote = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    const local = await getLocalHistory();
    return [...remote, ...local].sort(
      (a, b) => new Date(b.createdAt || b.ts || 0) - new Date(a.createdAt || a.ts || 0)
    );
  } catch {
    return getLocalHistory();
  }
}

export async function registerForPushNotifications() {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;
  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId =
    EAS_PROJECT_ID ||
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    '';

  const tokenResult = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  return tokenResult.data;
}

export async function registerPushToken(token) {
  if (!token) return null;
  try {
    const { data } = await api.post(ENDPOINTS.notifications.registerPush, { token });
    return data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to register push token'));
  }
}

export function notificationToEvent(notification) {
  const content = notification?.request?.content || {};
  return {
    id: notification?.request?.identifier,
    title: content.title || 'Notification',
    body: content.body || '',
    type: content.data?.type || 'push',
    data: content.data || {},
    createdAt: new Date().toISOString()
  };
}
