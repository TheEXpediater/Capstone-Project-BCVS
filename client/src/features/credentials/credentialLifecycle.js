const SIGNED_STATUSES = new Set([
  'signed',
  'claim_ready',
  'claimed',
  'shared',
  'queued_for_anchor',
  'anchored',
]);
const TERMINAL_STATUSES = new Set(['rejected', 'revoked', 'cancelled', 'deleted']);
const SIGNABLE_UNSIGNED_STATUSES = new Set(['draft', 'submitted', 'for_signature']);

function cleanText(value) {
  return String(value || '').trim();
}

export function statusOf(credential) {
  return cleanText(credential?.status).toLowerCase();
}

export function isPaidCredential(credential) {
  return cleanText(credential?.paymentStatus || 'unpaid').toLowerCase() === 'paid';
}

export function isSignedCredential(credential) {
  const status = statusOf(credential);
  return Boolean(
    credential?.isSigned ||
      credential?.signedCredential ||
      credential?.signedAt ||
      credential?.issuedAt ||
      cleanText(credential?.credentialHash) ||
      cleanText(credential?.vcHash) ||
      cleanText(credential?.canonicalVcHash) ||
      SIGNED_STATUSES.has(status)
  );
}

export function isTerminalCredential(credential) {
  return TERMINAL_STATUSES.has(statusOf(credential));
}

export function isUnsignedCredential(credential) {
  return Boolean(credential) && !isSignedCredential(credential);
}

export function isClaimedCredential(credential) {
  return Boolean(credential?.isClaimed || credential?.claimedAt || statusOf(credential) === 'claimed');
}

export function isAnchoredCredential(credential) {
  const anchorStatus = cleanText(credential?.anchorStatus || credential?.anchoring?.status).toLowerCase();
  return Boolean(
    credential?.isAnchored ||
      statusOf(credential) === 'anchored' ||
      anchorStatus === 'anchored' ||
      credential?.anchoring?.isAnchored ||
      credential?.anchoredAt ||
      credential?.anchoring?.anchoredAt
  );
}

export function hasRequiredCredentialData(credential) {
  return Boolean(
    credential &&
      cleanText(credential.studentNo) &&
      cleanText(credential.studentName) &&
      cleanText(credential.credentialType)
  );
}

export function isSigningEligible(credential) {
  return (
    Boolean(credential) &&
    isPaidCredential(credential) &&
    isUnsignedCredential(credential) &&
    !isTerminalCredential(credential) &&
    SIGNABLE_UNSIGNED_STATUSES.has(statusOf(credential)) &&
    hasRequiredCredentialData(credential)
  );
}

export function matchesDraftPaymentFilter(credential, payment = 'all') {
  const normalized = cleanText(payment).toLowerCase();
  if (!normalized || normalized === 'all') return true;
  if (normalized === 'paid') return isPaidCredential(credential);
  if (normalized === 'unpaid') return !isPaidCredential(credential);
  return true;
}

export function matchesSignSignatureFilter(credential, signature = 'unsigned') {
  return cleanText(signature).toLowerCase() === 'signed'
    ? isSignedCredential(credential)
    : isSigningEligible(credential);
}

export function matchesClaimFilter(credential, claim = 'all') {
  const normalized = cleanText(claim).toLowerCase();
  if (!normalized || normalized === 'all') return true;
  if (normalized === 'claimed') return isClaimedCredential(credential);
  if (normalized === 'unclaimed') return !isClaimedCredential(credential);
  return true;
}

export function matchesAnchorFilter(credential, anchor = 'default') {
  const normalized = cleanText(anchor).toLowerCase();
  if (normalized === 'anchored') return isAnchoredCredential(credential);
  if (!isSignedCredential(credential) || !isPaidCredential(credential)) return false;
  if (normalized === 'default') return true;
  if (normalized === 'today') return !isAnchoredCredential(credential);
  if (['7_days', '7days', '7-days'].includes(normalized)) return !isAnchoredCredential(credential);
  return true;
}

export function matchesCredentialView(credential, options = {}) {
  const view = cleanText(options.view || 'all').toLowerCase();

  if (view === 'drafts') {
    return (
      isUnsignedCredential(credential) &&
      !isTerminalCredential(credential) &&
      matchesDraftPaymentFilter(credential, options.payment)
    );
  }

  if (view === 'sign') {
    return (
      matchesSignSignatureFilter(credential, options.signature) &&
      (cleanText(options.signature).toLowerCase() !== 'signed' ||
        matchesClaimFilter(credential, options.claim))
    );
  }

  if (view === 'anchor') {
    return matchesAnchorFilter(credential, options.anchor);
  }

  return statusOf(credential) !== 'deleted';
}
