const CREATE_ROLES = new Set(['admin', 'super_admin']);
const EDIT_ROLES = new Set(['admin', 'super_admin']);
const SUBMIT_ROLES = new Set(['admin']);
const SIGN_ROLES = new Set(['super_admin']);
const PAYMENT_ROLES = new Set(['cashier']);
const DELETE_ROLES = new Set(['admin']);
const READONLY_ROLES = new Set(['developer']);
const SUBMITTED_STATUSES = new Set(['submitted', 'for_signature']);
const TERMINAL_STATUSES = new Set(['rejected', 'revoked', 'cancelled', 'deleted']);
const IMMUTABLE_STATUSES = new Set([
  'signed',
  'claim_ready',
  'claimed',
  'shared',
  'queued_for_anchor',
  'anchored',
  'revoked',
  'deleted',
  'cancelled',
]);

function roleOf(user) {
  return String(user?.role || '').trim().toLowerCase();
}

function statusOf(credential) {
  return String(credential?.status || '').trim().toLowerCase();
}

export function isCredentialPaid(credential) {
  return String(credential?.paymentStatus || 'unpaid').trim().toLowerCase() === 'paid';
}

export function hasSignedCredential(credential) {
  return Boolean(credential?.signedCredential || credential?.signedAt);
}

export function hasIssuedCredentialArtifacts(credential) {
  const status = statusOf(credential);
  return Boolean(
    credential?.signedCredential ||
      credential?.vcPayload ||
      credential?.credentialHash ||
      credential?.vcHash ||
      credential?.signedAt ||
      IMMUTABLE_STATUSES.has(status)
  );
}

export function isCredentialUnsigned(credential) {
  return Boolean(credential) && !hasSignedCredential(credential) && !hasIssuedCredentialArtifacts(credential);
}

export function isCredentialTerminal(credential) {
  return TERMINAL_STATUSES.has(statusOf(credential));
}

export function isCredentialReadyForSigning(credential) {
  const status = statusOf(credential);
  return (
    Boolean(credential) &&
    isCredentialPaid(credential) &&
    isCredentialUnsigned(credential) &&
    SUBMITTED_STATUSES.has(status)
  );
}

export function canCreateCredential(user) {
  return CREATE_ROLES.has(roleOf(user));
}

export function canEditCredential(user, credential) {
  const role = roleOf(user);
  return (
    EDIT_ROLES.has(role) &&
    Boolean(credential) &&
    !isCredentialTerminal(credential) &&
    isCredentialUnsigned(credential)
  );
}

export function canSubmitCredential(user, credential) {
  const status = statusOf(credential);
  return (
    SUBMIT_ROLES.has(roleOf(user)) &&
    Boolean(credential) &&
    isCredentialPaid(credential) &&
    isCredentialUnsigned(credential) &&
    (status === 'draft' || SUBMITTED_STATUSES.has(status))
  );
}

export function canDeleteCredential(user, credential) {
  return DELETE_ROLES.has(roleOf(user)) && statusOf(credential) === 'draft' && isCredentialUnsigned(credential);
}

export function canSignCredential(user, credential) {
  return SIGN_ROLES.has(roleOf(user)) && isCredentialReadyForSigning(credential);
}

export function canRejectCredential(user, credential) {
  return SIGN_ROLES.has(roleOf(user)) && SUBMITTED_STATUSES.has(statusOf(credential)) && isCredentialUnsigned(credential);
}

export function canMarkCredentialPaid(user, credential) {
  return PAYMENT_ROLES.has(roleOf(user)) && Boolean(credential) && !isCredentialTerminal(credential);
}

export function isReadOnlyCredentialUser(user) {
  return READONLY_ROLES.has(roleOf(user));
}
