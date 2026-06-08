import { Expo } from 'expo-server-sdk';
import { Types } from 'mongoose';
import { ApiError } from '../../shared/utils/ApiError.js';
import { getUserModel } from '../auth/user.model.js';
import { getNotificationModel, getPushTokenModel } from './model.js';

const expo = new Expo();

function cleanString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function serializeNotification(doc) {
  const raw = typeof doc?.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: raw._id,
    type: raw.type,
    title: raw.title,
    body: raw.body || '',
    data: raw.data || {},
    readAt: raw.readAt || null,
    createdAt: raw.createdAt,
  };
}

function normalizeEvent(event = {}) {
  const type = cleanString(event.type);

  if (![
    'credential_ready',
    'credential_requested',
    'verification_request',
    'credential_shared',
    'payment_received',
    'credential_claimed',
    'credential_anchored',
    'anchor_scheduled',
    'proof_prepared',
  ].includes(type)) {
    throw new ApiError(400, 'Unsupported notification type');
  }

  return {
    type,
    title: cleanString(event.title, 'BCVS notification'),
    body: cleanString(event.body),
    data: event.data && typeof event.data === 'object' ? event.data : {},
  };
}

async function sendExpoPush(tokens, event) {
  const validRows = tokens.filter((row) => Expo.isExpoPushToken(row.token));
  if (validRows.length === 0) return;

  const messages = validRows.map((row) => ({
    to: row.token,
    sound: 'default',
    title: event.title,
    body: event.body,
    data: {
      ...event.data,
      type: event.type,
    },
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const PushToken = getPushTokenModel();

  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);

    await Promise.all(
      tickets.map((ticket, index) => {
        if (ticket.status === 'ok') return null;

        const token = chunk[index]?.to;
        if (!token) return null;

        const detailsError = cleanString(ticket.details?.error);
        const shouldDeactivate = detailsError === 'DeviceNotRegistered';

        return PushToken.updateOne(
          { token },
          {
            $set: {
              lastError: cleanString(ticket.message || detailsError || 'Push send failed'),
              ...(shouldDeactivate ? { isActive: false } : {}),
            },
          }
        );
      })
    );
  }
}

export async function registerPushToken(payload = {}, actor) {
  if (!actor || actor.kind !== 'mobile') {
    throw new ApiError(403, 'Only mobile users can register push tokens');
  }

  const token = cleanString(payload.token);
  const deviceId = cleanString(payload.deviceId);

  if (!token) {
    throw new ApiError(400, 'Push token is required');
  }

  if (!Expo.isExpoPushToken(token)) {
    throw new ApiError(400, 'Invalid Expo push token');
  }

  const PushToken = getPushTokenModel();
  const now = new Date();

  const record = await PushToken.findOneAndUpdate(
    { token },
    {
      $set: {
        userId: actor._id,
        token,
        deviceId,
        studentId: actor.studentId || '',
        isActive: true,
        lastRegisteredAt: now,
        lastError: '',
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  return {
    id: record._id,
    token: record.token,
    deviceId: record.deviceId,
    registeredAt: record.lastRegisteredAt,
  };
}

export async function listMobileNotifications(actor) {
  if (!actor || actor.kind !== 'mobile') {
    throw new ApiError(403, 'Only mobile users can list notifications');
  }

  const Notification = getNotificationModel();
  const rows = await Notification.find({ userId: actor._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return rows.map(serializeNotification);
}

export async function notifyUser(userId, event = {}) {
  if (!Types.ObjectId.isValid(userId)) return null;

  const normalized = normalizeEvent(event);
  const Notification = getNotificationModel();
  const PushToken = getPushTokenModel();

  const notification = await Notification.create({
    userId,
    ...normalized,
  });

  const tokens = await PushToken.find({
    userId,
    isActive: true,
  }).lean();

  await sendExpoPush(tokens, normalized).catch(() => null);

  return serializeNotification(notification);
}

export async function notifyStudentByStudentNo(studentNo, event = {}) {
  const normalizedStudentNo = cleanString(studentNo);
  if (!normalizedStudentNo) return [];

  const User = getUserModel();
  const users = await User.find({
    kind: 'mobile',
    role: 'student',
    studentId: normalizedStudentNo,
    isActive: true,
  }).lean();

  const notifications = [];
  for (const user of users) {
    const notification = await notifyUser(user._id, event);
    if (notification) notifications.push(notification);
  }

  return notifications;
}
