import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { EAS_PROJECT_ID, ENDPOINTS } from '@/constants/config';
import { api, apiErrorMessage } from '@/services/apiClient';
import { getDeviceId } from '@/utils/device';
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

const MAX_LOCAL_HISTORY = 100;
const MAX_DELETED_IDS = 300;

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value) !== '');
}

function toIsoDate(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function titleCase(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sortByNewest(items) {
  return [...items].sort(
    (a, b) => new Date(b.createdAt || b.ts || 0) - new Date(a.createdAt || a.ts || 0)
  );
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    const id = String(item?.id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function normalizeHistoryItem(item, source = 'remote') {
  const data = item?.data || item?.meta || item?.payload || {};
  const request = data?.request || item?.request || item?.credentialRequest || {};
  const createdAt = toIsoDate(
    firstValue(
      item?.createdAt,
      item?.created_at,
      item?.ts,
      data?.createdAt,
      data?.created_at,
      request?.createdAt,
      request?.created_at
    )
  );
  const type = firstValue(item?.type, data?.type, request?.type, 'activity');
  const id = String(
    firstValue(
      item?.id,
      item?._id,
      data?.id,
      data?._id,
      data?.notificationId,
      data?.credentialRequestId,
      request?._id,
      request?.id,
      request?.paymentCode,
      `${source}-${type}-${createdAt}-${firstValue(item?.title, data?.title, '')}`
    )
  );

  return {
    ...item,
    id,
    title: firstValue(item?.title, data?.title, request?.title, 'Activity'),
    body: firstValue(item?.body, item?.desc, item?.message, data?.body, data?.message, ''),
    type,
    data: {
      ...data,
      ...(request && Object.keys(request).length ? { request } : {})
    },
    createdAt,
    source
  };
}

export function credentialRequestToEvent(request) {
  if (!request) return null;

  const row = request?.request || request;
  const requestId = firstValue(
    row?._id,
    row?.id,
    row?.requestId,
    request?._id,
    request?.id,
    request?.paymentCode,
    row?.paymentCode
  );

  if (!requestId) return null;

  const credentialType = firstValue(
    row?.credentialType,
    row?.credential_type,
    row?.type,
    row?.credential?.type,
    'student_record'
  );
  const requestStatus = firstValue(row?.requestStatus, row?.status, request?.status, 'pending');
  const paymentStatus = firstValue(
    row?.paymentStatus,
    row?.payment_status,
    row?.payment?.status,
    request?.paymentStatus,
    'unpaid'
  );
  const credentialStatus = firstValue(
    row?.credentialStatus,
    row?.credential_status,
    row?.credential?.status,
    requestStatus
  );
  const createdAt = toIsoDate(firstValue(row?.createdAt, row?.created_at, request?.createdAt));
  const paid = String(paymentStatus).toLowerCase() === 'paid';
  const label = titleCase(credentialType) || 'Credential';

  return normalizeHistoryItem(
    {
      id: `request-${requestId}`,
      type: 'credential_request',
      title: `${label} request`,
      body: paid
        ? `Payment received. Request status is ${titleCase(requestStatus) || 'Processing'}.`
        : `Waiting for payment. Request status is ${titleCase(requestStatus) || 'Pending'}.`,
      createdAt,
      data: {
        request: row,
        credentialRequestId: requestId,
        credentialType,
        requestStatus,
        paymentStatus,
        paymentCode: firstValue(row?.paymentCode, row?.payment_code, request?.paymentCode),
        receiptNo: firstValue(row?.receiptNo, row?.receiptNumber, row?.receipt_no),
        paidAt: firstValue(row?.paidAt, row?.paid_at, row?.payment?.paidAt),
        amount: firstValue(row?.amount, row?.payment?.amount),
        processingNote: firstValue(
          row?.processingNote,
          row?.processing_note,
          request?.processingNote,
          'Processing may take up to 3 working days after payment.'
        ),
        credentialStatus
      }
    },
    'request'
  );
}

export function credentialRequestsToEvents(requests = []) {
  return requests.map(credentialRequestToEvent).filter(Boolean);
}

export async function getDeletedNotificationIds() {
  const ids = await readJson(STORAGE_KEYS.DELETED_NOTIFICATION_IDS, []);
  return Array.isArray(ids) ? ids.map((id) => String(id)) : [];
}

export async function saveDeletedNotificationIds(ids = []) {
  const current = await getDeletedNotificationIds();
  const next = Array.from(
    new Set([...ids.map((id) => String(id)), ...current].filter(Boolean))
  ).slice(0, MAX_DELETED_IDS);
  await writeJson(STORAGE_KEYS.DELETED_NOTIFICATION_IDS, next);
  return next;
}

export async function filterDeletedNotifications(items = []) {
  const deleted = new Set(await getDeletedNotificationIds());
  return items.filter((item) => !deleted.has(String(item?.id || '')));
}

export async function getLocalHistory() {
  const rows = await readJson(STORAGE_KEYS.NOTIFICATIONS, []);
  return Array.isArray(rows) ? rows.map((item) => normalizeHistoryItem(item, 'local')) : [];
}

export async function saveLocalEvent(event) {
  const current = await getLocalHistory();
  const normalized = normalizeHistoryItem(
    {
      id: event?.id || `${event?.type || 'event'}-${Date.now()}`,
      title: event?.title || 'Activity',
      body: event?.body || event?.desc || '',
      type: event?.type || 'activity',
      data: event?.data || {},
      createdAt: event?.createdAt || new Date().toISOString()
    },
    'local'
  );
  const next = [normalized, ...current.filter((item) => item.id !== normalized.id)].slice(
    0,
    MAX_LOCAL_HISTORY
  );
  await writeJson(STORAGE_KEYS.NOTIFICATIONS, next);
  return normalized;
}

export async function deleteLocalEvents(ids = []) {
  const idSet = new Set(ids.map((id) => String(id)));
  const current = await getLocalHistory();
  const next = current.filter((item) => !idSet.has(String(item.id)));
  await writeJson(STORAGE_KEYS.NOTIFICATIONS, next);
  return next;
}

export async function fetchHistory() {
  try {
    const { data } = await api.get(ENDPOINTS.notifications.history);
    const remote = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    const local = await getLocalHistory();
    return filterDeletedNotifications(
      sortByNewest(
        uniqueById([
          ...remote.map((item) => normalizeHistoryItem(item, 'remote')),
          ...local
        ])
      )
    );
  } catch {
    return filterDeletedNotifications(await getLocalHistory());
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
    const deviceId = await getDeviceId();
    const { data } = await api.post(ENDPOINTS.notifications.registerPush, {
      token,
      deviceId
    });
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
