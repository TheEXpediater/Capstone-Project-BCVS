import {
  createHash,
  createSign,
  createVerify,
  timingSafeEqual,
} from 'node:crypto';

export const CANONICALIZATION_ALGORITHM = 'json-stable-key-order-v1';
export const HASH_ALGORITHM = 'SHA-256';
export const SIGNATURE_ALGORITHM = 'ES256';
export const MERKLE_ALGORITHM = 'SHA-256/sorted-pairs-v1';

const TOP_LEVEL_METADATA_KEYS = new Set([
  '_id',
  'credentialId',
  'credentialHash',
  'vcHash',
  'canonicalVcHash',
  'canonicalizationAlgorithm',
  'hashAlgorithm',
  'signatureAlgorithm',
  'verificationMethod',
  'issuerKeyId',
  'issuerPublicKey',
  'issuedAt',
  'signedAt',
  'signedBy',
  'merkleLeaf',
  'merkleRoot',
  'merkleProof',
  'merkleTreeSize',
  'merkleLeafIndex',
  'merkleAlgorithm',
  'anchorStatus',
  'anchorMode',
  'scheduledAnchorAt',
  'anchoredAt',
  'anchoredBy',
  'anchorTxHash',
  'anchorBlockNumber',
  'anchorContractAddress',
  'anchorNetwork',
  'anchorChainId',
  'anchorExplorerUrl',
  'anchorEventName',
  'anchorEventArgs',
  'lastVerificationResult',
  'lastVerifiedAt',
  'status',
  'savedAt',
  'meta',
  'blockchain',
  'blockchainUrl',
  'contractAddress',
  'anchorUrl',
]);

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function sortDeep(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sortDeep);

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const next = value[key];
        if (next === undefined) return acc;
        acc[key] = sortDeep(next);
        return acc;
      }, {});
  }

  if (typeof value === 'bigint') return value.toString();
  return value;
}

function resolveVcSource(input) {
  if (isPlainObject(input?.vcPayload)) return input.vcPayload;
  if (isPlainObject(input?.signedCredential)) return input.signedCredential;
  if (isPlainObject(input?.credential)) return input.credential;
  if (isPlainObject(input?.payload)) return input.payload;
  return input;
}

export function stripCredentialProof(input) {
  const source = clonePlain(resolveVcSource(input));

  if (!isPlainObject(source)) return source;

  const output = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === 'proof') continue;
    if (TOP_LEVEL_METADATA_KEYS.has(key)) continue;
    output[key] = value;
  }

  return output;
}

export function canonicalizeCredential(vc) {
  return JSON.stringify(sortDeep(stripCredentialProof(vc)));
}

export function computeVcHash(vc) {
  return `0x${createHash('sha256').update(canonicalizeCredential(vc)).digest('hex')}`;
}

export function computeLegacyVcHash(vc) {
  return `0x${createHash('sha256').update(JSON.stringify(stripCredentialProof(vc))).digest('hex')}`;
}

export function normalizeHex(value) {
  if (Buffer.isBuffer(value)) return `0x${value.toString('hex')}`;

  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';

  const stripped = text.replace(/^0x/i, '');
  if (!/^[0-9a-f]+$/i.test(stripped)) return '';

  const even = stripped.length % 2 === 0 ? stripped : `0${stripped}`;
  return `0x${even}`;
}

function hexToBuffer(value) {
  const normalized = normalizeHex(value);
  if (!normalized) return null;
  return Buffer.from(normalized.slice(2), 'hex');
}

function bufferToHex(value) {
  return `0x${Buffer.from(value).toString('hex')}`;
}

function sha256Buffer(value) {
  return createHash('sha256').update(value).digest();
}

function hashPair(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  const [a, b] = [leftBuffer, rightBuffer].sort(Buffer.compare);
  return sha256Buffer(Buffer.concat([a, b]));
}

export function safeCompareHex(a, b) {
  const left = hexToBuffer(a);
  const right = hexToBuffer(b);
  if (!left || !right || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function signVcPayload(vc, issuerKey, privateKeyPem, options = {}) {
  const issuedAt = options.issuedAt || new Date();
  const canonicalCredential = canonicalizeCredential(vc);
  const vcHash = `0x${createHash('sha256').update(canonicalCredential).digest('hex')}`;
  const signer = createSign('sha256');
  signer.update(canonicalCredential);
  signer.end();

  const proofValue = signer.sign(privateKeyPem, 'base64');
  const verificationMethod = issuerKey?.kid || '';
  const issuerKeyId = String(issuerKey?._id || issuerKey?.id || verificationMethod);
  const issuerPublicKey = issuerKey?.publicKeyPem || '';

  const signedCredential = {
    ...clonePlain(stripCredentialProof(vc)),
    proof: {
      type: 'EcdsaSecp256r1Signature2019',
      created: issuedAt.toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod,
      proofValue,
      signatureAlgorithm: issuerKey?.algorithm || SIGNATURE_ALGORITHM,
      canonicalizationAlgorithm: CANONICALIZATION_ALGORITHM,
      hashAlgorithm: HASH_ALGORITHM,
      vcHash,
      canonicalVcHash: vcHash,
      issuerKeyId,
      issuerPublicKey,
    },
  };

  return {
    signedCredential,
    vcHash,
    canonicalVcHash: vcHash,
    canonicalCredential,
    canonicalizationAlgorithm: CANONICALIZATION_ALGORITHM,
    hashAlgorithm: HASH_ALGORITHM,
    signatureAlgorithm: issuerKey?.algorithm || SIGNATURE_ALGORITHM,
    verificationMethod,
    issuerKeyId,
    issuerPublicKey,
    issuedAt,
    signedAt: issuedAt,
  };
}

export function verifyVcSignature(vc, publicKeyPem) {
  const source = resolveVcSource(vc);
  const proof = source?.proof || vc?.proof || {};
  const proofValue = proof?.proofValue || proof?.signatureValue || '';

  if (!publicKeyPem || !proofValue) {
    return {
      valid: false,
      reason: !publicKeyPem ? 'missing_public_key' : 'missing_proof_value',
    };
  }

  try {
    const attempts = [canonicalizeCredential(source)];
    if (!proof?.canonicalizationAlgorithm) {
      attempts.push(JSON.stringify(stripCredentialProof(source)));
    }

    for (const payload of attempts) {
      const verifier = createVerify('sha256');
      verifier.update(payload);
      verifier.end();

      if (verifier.verify(publicKeyPem, proofValue, 'base64')) {
        return {
          valid: true,
          reason: '',
        };
      }
    }

    return {
      valid: false,
      reason: 'signature_verification_failed',
    };
  } catch (error) {
    return {
      valid: false,
      reason: error.message || 'signature_verification_failed',
    };
  }
}

export function buildMerkleLeaf(vcHash) {
  const hashBytes = hexToBuffer(vcHash);
  if (!hashBytes) return '';
  return bufferToHex(sha256Buffer(hashBytes));
}

export function buildMerkleTree(leaves = []) {
  const level = leaves
    .map((leaf) => hexToBuffer(leaf))
    .filter(Boolean);

  if (!level.length) {
    return {
      root: '',
      leaves: [],
      levels: [],
      size: 0,
    };
  }

  const levels = [level];
  while (levels[levels.length - 1].length > 1) {
    const current = levels[levels.length - 1];
    const next = [];

    for (let index = 0; index < current.length; index += 2) {
      const left = current[index];
      const right = current[index + 1] || current[index];
      next.push(hashPair(left, right));
    }

    levels.push(next);
  }

  return {
    root: bufferToHex(levels[levels.length - 1][0]),
    leaves: level.map(bufferToHex),
    levels: levels.map((items) => items.map(bufferToHex)),
    size: level.length,
  };
}

export function buildMerkleProof(leaves = [], leafIndex = 0) {
  const tree = buildMerkleTree(leaves);
  const index = Number(leafIndex);

  if (!tree.levels.length || !Number.isInteger(index) || index < 0 || index >= tree.size) {
    return [];
  }

  const proof = [];
  let cursor = index;

  for (let levelIndex = 0; levelIndex < tree.levels.length - 1; levelIndex += 1) {
    const level = tree.levels[levelIndex];
    const pairIndex = cursor % 2 === 0 ? cursor + 1 : cursor - 1;
    const sibling = level[pairIndex] || level[cursor];
    if (sibling) proof.push(sibling);
    cursor = Math.floor(cursor / 2);
  }

  return proof;
}

export function verifyMerkleProof({ leaf, proof = [], root }) {
  let current = hexToBuffer(leaf);
  const expectedRoot = normalizeHex(root);

  if (!current || !expectedRoot) return false;

  for (const sibling of proof || []) {
    const siblingBuffer = hexToBuffer(sibling);
    if (!siblingBuffer) return false;
    current = hashPair(current, siblingBuffer);
  }

  return safeCompareHex(bufferToHex(current), expectedRoot);
}
