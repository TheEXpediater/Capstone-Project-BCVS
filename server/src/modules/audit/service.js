import mongoose from 'mongoose';
import { getAuditLogModel } from './model.js';
import { ApiError } from '../../shared/utils/ApiError.js';

const SENSITIVE_KEYS = [
  'password',
  'token',
  'authorization',
  'cookie',
  'set-cookie',
  'secret',
  'privatekey',
  'private_key',
  'privateKeyPem',
  'mnemonic',
  'seed',
  'ciphertext',
  'authTag',
  'auth_tag',
  'iv',
  'keyEncryptionSecret',
  'idFront',
  'idBack',
  'validIdFront',
  'validIdBack',
  'idFrontUrl',
  'idBackUrl',
  'validIdFrontUrl',
  'validIdBackUrl',
  'selfie',
  'selfieUrl',
  'livenessImage',
  'livenessImageUrl',
  'imageBase64',
  'dataUri',
];

function cleanString(value, fallback = '') {
  const cleaned = String(value ?? '').trim();
  return cleaned || fallback;
}

function isSensitiveKey(key = '') {
  const normalized = String(key).toLowerCase();
  return SENSITIVE_KEYS.some((item) => normalized.includes(item.toLowerCase()));
}

export function sanitizeAuditMetadata(value, depth = 0) {
  if (depth > 4) return '[Max depth reached]';
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeAuditMetadata(item, depth + 1));
  }

  if (typeof value === 'object') {
    const output = {};

    for (const [key, item] of Object.entries(value)) {
      if (isSensitiveKey(key)) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = sanitizeAuditMetadata(item, depth + 1);
      }
    }

    return output;
  }

  if (typeof value === 'string' && value.length > 1000) {
    return `${value.slice(0, 1000)}...`;
  }

  return value;
}

function buildActor(user) {
  if (!user) {
    return {
      userId: null,
      kind: 'system',
      role: 'system',
      username: 'system',
      fullName: 'System',
      email: '',
    };
  }

  return {
    userId: user._id || null,
    kind: user.kind || 'web',
    role: user.role || '',
    username: user.username || '',
    fullName: user.fullName || '',
    email: user.email || '',
  };
}

function buildRequest(req) {
  if (!req) return {};

  return {
    method: req.method || '',
    path: req.originalUrl || req.url || '',
    ipAddress:
      req.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim?.() ||
      req.ip ||
      req.socket?.remoteAddress ||
      '',
    userAgent: req.headers?.['user-agent'] || '',
  };
}

export async function writeAuditLog(payload = {}) {
  try {
    const AuditLog = getAuditLogModel();

    const doc = await AuditLog.create({
      actor: payload.actor || buildActor(payload.user),
      module: cleanString(payload.module, 'system'),
      action: cleanString(payload.action, 'UNKNOWN_ACTION').toUpperCase(),
      label: cleanString(payload.label),
      description: cleanString(payload.description),
      target: {
        id: cleanString(payload.target?.id || payload.targetId),
        type: cleanString(payload.target?.type || payload.targetType),
        label: cleanString(payload.target?.label || payload.targetLabel),
      },
      status: payload.status || 'success',
      request: payload.request || buildRequest(payload.req),
      metadata: sanitizeAuditMetadata(payload.metadata || {}),
    });

    return doc;
  } catch (error) {
    console.warn('[audit] Failed to write audit log:', error.message || error);
    return null;
  }
}

export async function listAuditLogs(query = {}) {
  const AuditLog = getAuditLogModel();

  const page = Math.max(Number.parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit || '20', 10), 1), 100);

  const filter = {};

  if (query.module) filter.module = cleanString(query.module);
  if (query.action) filter.action = cleanString(query.action).toUpperCase();
  if (query.status) filter.status = cleanString(query.status);
  if (query.actorKind) filter['actor.kind'] = cleanString(query.actorKind);
  if (query.role) filter['actor.role'] = cleanString(query.role);

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) {
      const toDate = new Date(query.to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(query.to))) {
        toDate.setHours(23, 59, 59, 999);
      }
      filter.createdAt.$lte = toDate;
    }
  }

  if (query.search) {
    const search = cleanString(query.search);
    filter.$or = [
      { 'actor.fullName': { $regex: search, $options: 'i' } },
      { 'actor.email': { $regex: search, $options: 'i' } },
      { 'actor.username': { $regex: search, $options: 'i' } },
      { module: { $regex: search, $options: 'i' } },
      { action: { $regex: search, $options: 'i' } },
      { label: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { 'target.label': { $regex: search, $options: 'i' } },
      { 'target.id': { $regex: search, $options: 'i' } },
    ];
  }

  const [rows, total, moduleSummary, actorSummary] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
    AuditLog.aggregate([
      { $match: filter },
      { $group: { _id: '$module', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    AuditLog.aggregate([
      { $match: filter },
      { $group: { _id: '$actor.kind', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  return {
    logs: rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
    summary: {
      byModule: moduleSummary,
      byActorKind: actorSummary,
    },
  };
}

export async function getAuditLogById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid audit log ID');
  }

  const AuditLog = getAuditLogModel();
  const log = await AuditLog.findById(id).lean();

  if (!log) {
    throw new ApiError(404, 'Audit log not found');
  }

  return log;
}

export async function deleteAuditLogById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid audit log ID');
  }

  const AuditLog = getAuditLogModel();
  const result = await AuditLog.deleteOne({ _id: id });

  return {
    deletedCount: result.deletedCount || 0,
  };
}

export async function bulkDeleteAuditLogs(ids = []) {
  const validIds = [...new Set(ids)]
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (!validIds.length) {
    throw new ApiError(400, 'No valid audit log IDs provided');
  }

  const AuditLog = getAuditLogModel();
  const result = await AuditLog.deleteMany({ _id: { $in: validIds } });

  return {
    deletedCount: result.deletedCount || 0,
  };
}
