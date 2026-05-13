export function getCredentialId(credential) {
  return String(
    credential?.id ||
      credential?._id ||
      credential?.credentialId ||
      credential?.digest ||
      credential?.jws?.slice?.(0, 32) ||
      ''
  );
}

export function getCredentialTitle(credential) {
  const type = credential?.type || credential?.meta?.type || credential?.credentialType;
  if (Array.isArray(type)) {
    return type.find((item) => item !== 'VerifiableCredential') || 'Credential';
  }
  return credential?.meta?.title || type || 'Credential';
}

export function getHolderName(credential) {
  return (
    credential?.credentialSubject?.fullName ||
    credential?.subject?.fullName ||
    credential?.meta?.fullName ||
    credential?.holderName ||
    'Unknown holder'
  );
}

export function getIssuedDate(credential) {
  return credential?.issuanceDate || credential?.issuedAt || credential?.meta?.issuedAt || null;
}

export function normalizeCredential(input) {
  const id = getCredentialId(input);
  if (!id) {
    throw new Error('Credential is missing a stable id');
  }

  return {
    ...input,
    id,
    savedAt: input?.savedAt || new Date().toISOString(),
    meta: {
      ...(input?.meta || {}),
      title: input?.meta?.title || getCredentialTitle(input),
      fullName: input?.meta?.fullName || getHolderName(input),
      issuedAt: input?.meta?.issuedAt || getIssuedDate(input)
    }
  };
}

export function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toISOString().slice(0, 10);
}

