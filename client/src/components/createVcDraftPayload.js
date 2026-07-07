export function buildCreateVcDraftPayload({ credentialType, notes = '', anchorNow = false, anchorCost = 20 }) {
  const normalizedCredentialType = String(credentialType || 'tor').toLowerCase();
  const numericAnchorCost = Number(anchorCost || 0);

  return {
    credentialType: normalizedCredentialType,
    notes: String(notes || ''),
    anchorMode: anchorNow ? 'same_day' : 'scheduled',
    anchorNow: Boolean(anchorNow),
    anchorNowFee: anchorNow ? numericAnchorCost : 0,
  };
}
