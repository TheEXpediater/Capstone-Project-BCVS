const DEFAULT_EXPLORER_BASE_URL = 'https://amoy.polygonscan.com';

function cleanValue(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(cleanValue(value));
}

function buildExplorerLink({ explorerBaseUrl, anchorTxHash, contractAddress }) {
  const base = cleanValue(explorerBaseUrl || DEFAULT_EXPLORER_BASE_URL).replace(/\/+$/, '');
  const txHash = cleanValue(anchorTxHash);
  const address = cleanValue(contractAddress);

  if (!base) return '';
  if (txHash) return `${base}/tx/${encodeURIComponent(txHash)}`;
  if (address) return `${base}/address/${encodeURIComponent(address)}`;

  return '';
}

function shortenMiddle(value) {
  const cleaned = cleanValue(value);
  if (cleaned.length <= 22) return cleaned;
  return `${cleaned.slice(0, 12)}...${cleaned.slice(-8)}`;
}

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

export function getBlockchainAnchorInfo(credential) {
  const blockchain = credential?.blockchain || {};
  const meta = credential?.meta || {};
  const anchorTxHash = cleanValue(
    blockchain.anchorTxHash ||
      credential?.anchorTxHash ||
      meta.anchorTxHash
  );
  const contractAddress = cleanValue(
    blockchain.contractAddress ||
      credential?.contractAddress ||
      meta.contractAddress
  );
  const explicitUrl = cleanValue(
    blockchain.anchorUrl ||
      credential?.blockchainUrl ||
      credential?.anchorUrl ||
      meta.blockchainUrl ||
      meta.anchorUrl ||
      blockchain.explorerUrl ||
      credential?.explorerUrl
  );
  const explorerBaseUrl = cleanValue(
    blockchain.explorerBaseUrl ||
      credential?.explorerBaseUrl ||
      meta.explorerBaseUrl ||
      DEFAULT_EXPLORER_BASE_URL
  );
  const url = isHttpUrl(explicitUrl)
    ? explicitUrl
    : buildExplorerLink({ explorerBaseUrl, anchorTxHash, contractAddress });
  const value = anchorTxHash || contractAddress;

  return {
    url,
    value,
    label: value ? shortenMiddle(value) : url ? 'Blockchain anchor' : '',
    kind: anchorTxHash ? 'transaction' : contractAddress ? 'contract' : url ? 'url' : '',
  };
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
  const blockchainAnchor = getBlockchainAnchorInfo(input);

  return {
    ...input,
    id,
    savedAt: input?.savedAt || new Date().toISOString(),
    meta: {
      ...(input?.meta || {}),
      title: input?.meta?.title || getCredentialTitle(input),
      fullName: input?.meta?.fullName || getHolderName(input),
      issuedAt: input?.meta?.issuedAt || getIssuedDate(input),
      ...(blockchainAnchor.url || blockchainAnchor.value
        ? {
            blockchainUrl: input?.meta?.blockchainUrl || blockchainAnchor.url,
            blockchainLabel: input?.meta?.blockchainLabel || blockchainAnchor.label,
            contractAddress:
              input?.meta?.contractAddress ||
              input?.blockchain?.contractAddress ||
              input?.contractAddress ||
              '',
            anchorTxHash:
              input?.meta?.anchorTxHash ||
              input?.blockchain?.anchorTxHash ||
              input?.anchorTxHash ||
              ''
          }
        : {})
    }
  };
}

export function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toISOString().slice(0, 10);
}

