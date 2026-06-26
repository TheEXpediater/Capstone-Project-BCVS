import { normalizeAnchorMode } from './pricing.js';

export const DEVELOPER_READONLY_MESSAGE =
  'MIS/developer access is read-only for VC lifecycle operations.';

const DRAFT_STATUS = 'draft';
const SUBMITTED_STATUSES = new Set(['submitted', 'for_signature']);
const TERMINAL_BLOCKED_STATUSES = new Set(['rejected', 'revoked', 'cancelled', 'deleted']);
const CLAIMABLE_STATUSES = new Set(['signed', 'claim_ready', 'queued_for_anchor', 'anchored']);

function cleanString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const cleaned = String(value).trim();
  return cleaned || fallback;
}

function roleOf(user) {
  return cleanString(user?.role).toLowerCase();
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(days || 0));
  return next;
}

function toDateOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isPaid(credential) {
  return cleanString(credential?.paymentStatus, 'unpaid').toLowerCase() === 'paid';
}

export function isClaimed(credential) {
  return credential?.status === 'claimed' || Boolean(credential?.claimedAt);
}

export function isRejectedRevokedOrCancelled(credential) {
  return TERMINAL_BLOCKED_STATUSES.has(cleanString(credential?.status).toLowerCase());
}

export function hasSignedCredentialPayload(credential) {
  return Boolean(credential?.signedCredential);
}

export function hasIssuedCredentialArtifacts(credential) {
  return Boolean(
    credential?.signedCredential ||
      credential?.vcPayload ||
      cleanString(credential?.credentialHash) ||
      cleanString(credential?.vcHash) ||
      credential?.signedAt ||
      ['signed', 'claim_ready', 'claimed', 'shared', 'queued_for_anchor', 'anchored', 'revoked'].includes(
        cleanString(credential?.status).toLowerCase()
      )
  );
}

export function canCreateDraft(user) {
  return roleOf(user) === 'admin';
}

export function canEditDraft(user, credential) {
  return (
    roleOf(user) === 'admin' &&
    cleanString(credential?.status).toLowerCase() === DRAFT_STATUS &&
    !hasIssuedCredentialArtifacts(credential)
  );
}

export function canSubmitDraft(user, credential) {
  return roleOf(user) === 'admin' && cleanString(credential?.status).toLowerCase() === DRAFT_STATUS;
}

export function canDeleteDraft(user, credential) {
  return canEditDraft(user, credential);
}

export function canRejectDraft(user, credential) {
  return roleOf(user) === 'super_admin' && SUBMITTED_STATUSES.has(cleanString(credential?.status).toLowerCase());
}

export function canSignCredential(user, credential) {
  return (
    roleOf(user) === 'super_admin' &&
    SUBMITTED_STATUSES.has(cleanString(credential?.status).toLowerCase()) &&
    !hasSignedCredentialPayload(credential)
  );
}

export function canMarkPaid(user, credential) {
  return roleOf(user) === 'cashier' && Boolean(credential) && !isRejectedRevokedOrCancelled(credential);
}

export function isAnchorEligible(credential) {
  return (
    Boolean(credential) &&
    isPaid(credential) &&
    hasSignedCredentialPayload(credential) &&
    !isRejectedRevokedOrCancelled(credential)
  );
}

export function isAnchorReady(credential, now = new Date()) {
  if (!isAnchorEligible(credential)) return false;
  const mode = normalizeAnchorMode(credential?.anchorMode || credential?.anchorScheduleMode);

  if (mode === 'anchor_now') return true;

  const scheduledAnchorAt = toDateOrNull(credential?.scheduledAnchorAt);
  return Boolean(scheduledAnchorAt && scheduledAnchorAt.getTime() <= now.getTime());
}

export function canQueueAnchor(user, credential) {
  if (roleOf(user) !== 'super_admin') return false;
  if (!isAnchorEligible(credential)) return false;
  if (cleanString(credential?.anchorStatus).toLowerCase() === 'anchored') return false;
  return true;
}

export function canProcessAnchor(user, credential, now = new Date()) {
  return (
    roleOf(user) === 'super_admin' &&
    isAnchorEligible(credential) &&
    cleanString(credential?.anchorStatus).toLowerCase() === 'queued' &&
    isAnchorReady(credential, now)
  );
}

export function canGenerateClaimQr(user, credential, { override = false } = {}) {
  if (roleOf(user) !== 'super_admin') return false;
  if (!isAnchorEligible(credential)) return false;

  if (isClaimed(credential)) {
    return Boolean(override);
  }

  return CLAIMABLE_STATUSES.has(cleanString(credential?.status).toLowerCase());
}

export function canMarkClaimed(user, credential) {
  return roleOf(user) === 'student' && isAnchorEligible(credential) && !isClaimed(credential);
}

export function canViewVcDetails(user) {
  return ['admin', 'super_admin', 'developer', 'cashier'].includes(roleOf(user));
}

export function resolveAnchorReadiness(credential, now = new Date()) {
  const mode = normalizeAnchorMode(credential?.anchorMode || credential?.anchorScheduleMode);

  if (!isAnchorEligible(credential)) {
    return {
      eligible: false,
      ready: false,
      mode,
      scheduledAnchorAt: null,
    };
  }

  const existingSchedule = toDateOrNull(credential?.scheduledAnchorAt);
  const scheduledAnchorAt = mode === 'anchor_now'
    ? existingSchedule || now
    : existingSchedule || addDays(now, 7);
  const ready = mode === 'anchor_now' || scheduledAnchorAt.getTime() <= now.getTime();

  return {
    eligible: true,
    ready,
    mode,
    scheduledAnchorAt,
  };
}

export function applyAnchorReadinessToDraft(draft, now = new Date()) {
  const readiness = resolveAnchorReadiness(draft, now);

  if (!readiness.eligible) {
    return readiness;
  }

  draft.anchorMode = readiness.mode;
  draft.anchorNow = readiness.mode === 'anchor_now';
  draft.anchorScheduleMode = readiness.mode === 'anchor_now' ? 'same_day' : 'scheduled';
  draft.scheduledAnchorAt = readiness.scheduledAnchorAt;
  draft.anchorStatus = 'queued';

  if (!isClaimed(draft) && cleanString(draft.status).toLowerCase() !== 'anchored') {
    draft.status = 'queued_for_anchor';
  }

  return readiness;
}

export function lifecycleDenialMessage(user, action) {
  if (roleOf(user) === 'developer') return DEVELOPER_READONLY_MESSAGE;

  const messages = {
    create: 'This role is not allowed to create credential drafts.',
    edit: 'This role is not allowed to edit credential drafts.',
    submit: 'This role is not allowed to submit credential drafts.',
    delete: 'This role is not allowed to delete credential drafts.',
    reject: 'This role is not allowed to reject credential drafts.',
    sign: 'This role is not allowed to sign credentials.',
    payment: 'This role is not allowed to confirm credential payments.',
    anchor: 'This role is not allowed to process anchoring.',
    claimQr: 'This role is not allowed to generate claim QR codes.',
    claim: 'This role is not allowed to mark credentials claimed.',
    view: 'This role is not allowed to view credential details.',
  };

  return messages[action] || 'This role is not allowed to perform this credential action.';
}
