import { Types } from 'mongoose';
import { ApiError } from '../../shared/utils/ApiError.js';
import {
  buildMerkleLeaf,
  buildMerkleProof,
  buildMerkleTree,
  computeVcHash,
  HASH_ALGORITHM,
  MERKLE_ALGORITHM,
  normalizeHex,
  safeCompareHex,
  verifyMerkleProof,
  verifyVcSignature,
} from '../../shared/utils/vcProof.js';
import { getCredentialDraftModel } from '../credentials/model.js';
import { getIssuerKeyModel } from '../settings/issuerKey.model.js';
import { getSystemSettingModel } from '../settings/setting.model.js';
import {
  anchorMerkleRoot,
  getActiveContractRecord,
  getCapabilitiesForContract,
  verifyMerkleRootOnChain,
} from '../contracts/service.js';
import { getMerkleAnchorModel } from './model.js';

const ANCHOR_ROLES = new Set(['admin', 'super_admin', 'developer']);

function cleanString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function assertAnchorActor(actor) {
  if (!actor || !ANCHOR_ROLES.has(actor.role)) {
    throw new ApiError(403, 'You do not have permission to anchor credentials.');
  }
}

function assertObjectId(value, label = 'id') {
  if (!Types.ObjectId.isValid(value)) {
    throw new ApiError(400, `Invalid ${label}`);
  }
}

function serializeDoc(doc) {
  return clonePlain(typeof doc?.toObject === 'function' ? doc.toObject() : doc);
}

async function ensureMainSettings() {
  const SystemSetting = getSystemSettingModel();
  let settings = await SystemSetting.findOne({ code: 'main' });

  if (!settings) {
    settings = await SystemSetting.create({ code: 'main' });
  }

  return settings;
}

function isCredentialAnchored(draft) {
  return Boolean(
    draft?.anchoring?.isAnchored ||
      cleanString(draft?.anchorStatus) === 'anchored' ||
      (cleanString(draft?.merkleRoot) && cleanString(draft?.anchorTxHash))
  );
}

function assertAnchorableCredential(draft) {
  if (!draft) {
    throw new ApiError(404, 'Credential not found.');
  }

  if (['revoked', 'rejected'].includes(cleanString(draft.status).toLowerCase())) {
    throw new ApiError(409, 'Revoked or rejected credentials cannot be anchored.');
  }

  if (!draft.signedCredential) {
    throw new ApiError(409, 'Only signed credentials can be anchored.');
  }
}

function resolveStoredCredentialHash(draft) {
  return normalizeHex(
    draft?.vcHash ||
      draft?.canonicalVcHash ||
      draft?.credentialHash ||
      draft?.signedCredential?.proof?.vcHash ||
      draft?.signedCredential?.proof?.canonicalVcHash
  );
}

function buildCredentialLeafRow(draft) {
  const vcHash = resolveStoredCredentialHash(draft) || computeVcHash(draft.signedCredential);
  const leaf = cleanString(draft.merkleLeaf) || buildMerkleLeaf(vcHash);

  if (!vcHash || !leaf) {
    throw new ApiError(409, 'Credential canonical hash could not be generated.');
  }

  return {
    id: draft._id.toString(),
    vcHash,
    leaf,
  };
}

function buildAnchorPlan(drafts) {
  const rows = drafts.map(buildCredentialLeafRow);
  const tree = buildMerkleTree(rows.map((row) => row.leaf));

  if (!tree.root) {
    throw new ApiError(409, 'Merkle root could not be generated.');
  }

  const proofByCredentialId = new Map(
    rows.map((row, index) => [
      row.id,
      {
        leaf: row.leaf,
        proof: buildMerkleProof(tree.leaves, index),
        index,
        vcHash: row.vcHash,
        proofHash: row.leaf,
      },
    ])
  );

  return {
    rows,
    tree,
    proofByCredentialId,
  };
}

async function getActiveAnchorContext() {
  const settings = await ensureMainSettings();

  if (!settings.anchoring?.enabled) {
    throw new ApiError(409, 'Anchoring is disabled in System Settings.');
  }

  if (settings.locks?.anchorLocked) {
    throw new ApiError(423, 'Anchoring is currently locked by MIS.');
  }

  const contract = await getActiveContractRecord(settings);

  if (!contract) {
    throw new ApiError(409, 'No active anchor contract selected.');
  }

  if (contract.contractType !== 'merkle_anchor') {
    throw new ApiError(409, 'The active contract is not a MerkleAnchor contract.');
  }

  const capabilities = getCapabilitiesForContract(contract);
  if (!capabilities.canAnchorMerkleRoot) {
    throw new ApiError(409, 'Active contract does not support Merkle root anchoring.');
  }

  return {
    settings,
    contract,
    capabilities,
  };
}

function buildAnchorCredentials(plan) {
  return plan.rows.map((row) => {
    const proof = plan.proofByCredentialId.get(row.id);
    return {
      credential: row.id,
      credentialId: row.id,
      vcHash: row.vcHash,
      merkleLeaf: proof.leaf,
      merkleProof: proof.proof,
      merkleLeafIndex: proof.index,
      proofHash: proof.proofHash,
    };
  });
}

function makeAnchorBatchId(anchorType = 'batch') {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  return `bcvs-${anchorType}-${stamp}-${Date.now().toString(36)}`;
}

function buildAnchorResultFromRecord(anchorRecord, contract) {
  return {
    anchorStatus: anchorRecord.status,
    anchoredAt: anchorRecord.anchoredAt || new Date(),
    anchoredBy: anchorRecord.anchoredBy || null,
    anchorTxHash: anchorRecord.txHash || '',
    anchorBatchId: anchorRecord.batchId || '',
    anchorBlockNumber: anchorRecord.blockNumber ?? null,
    anchorContractAddress: anchorRecord.contractAddress,
    contractAddress: anchorRecord.contractAddress,
    anchorNetwork: anchorRecord.network || contract?.network || '',
    anchorChainId: anchorRecord.chainId ?? contract?.chainId ?? null,
    anchorExplorerUrl: anchorRecord.explorerUrl || '',
    anchorEventName: anchorRecord.eventName || '',
    anchorEventArgs: anchorRecord.eventArgs || null,
  };
}

async function createOrReuseAnchorRecord({ plan, contract, actor, anchorType }) {
  const Anchor = getMerkleAnchorModel();
  const contractAddress = cleanString(contract.address);
  const merkleRoot = plan.tree.root;
  const anchorCredentials = buildAnchorCredentials(plan);

  let anchorRecord = await Anchor.findOne({ contractAddress, merkleRoot });

  if (anchorRecord?.status === 'anchored') {
    return {
      anchorRecord,
      anchorResult: buildAnchorResultFromRecord(anchorRecord, contract),
      reused: true,
    };
  }

  if (!anchorRecord) {
    anchorRecord = await Anchor.create({
      anchorType,
      batchId: makeAnchorBatchId(anchorType),
      merkleRoot,
      merkleAlgorithm: MERKLE_ALGORITHM,
      merkleTreeSize: plan.tree.size,
      contractId: String(contract._id || ''),
      contractAddress,
      chainId: contract.chainId ?? null,
      network: contract.network || '',
      status: 'pending',
      anchoredBy: actor?._id || null,
      credentials: anchorCredentials,
    });
  } else {
    anchorRecord.anchorType = anchorType;
    anchorRecord.batchId = anchorRecord.batchId || makeAnchorBatchId(anchorType);
    anchorRecord.merkleAlgorithm = MERKLE_ALGORITHM;
    anchorRecord.merkleTreeSize = plan.tree.size;
    anchorRecord.contractId = String(contract._id || '');
    anchorRecord.chainId = contract.chainId ?? null;
    anchorRecord.network = contract.network || '';
    anchorRecord.credentials = anchorCredentials;
    anchorRecord.anchoredBy = actor?._id || anchorRecord.anchoredBy || null;
    await anchorRecord.save();
  }

  const existingChainCheck = await verifyMerkleRootOnChain({
    merkleRoot,
    contractRecord: contract,
  });

  if (existingChainCheck.verified || existingChainCheck.rootVerified) {
    anchorRecord.status = 'anchored';
    anchorRecord.anchoredAt = anchorRecord.anchoredAt || new Date();
    anchorRecord.failureReason = existingChainCheck.verified
      ? ''
      : existingChainCheck.reason || 'Merkle root is anchored, but event lookup was incomplete.';
    await anchorRecord.save();

    return {
      anchorRecord,
      anchorResult: buildAnchorResultFromRecord(anchorRecord, contract),
      reused: true,
    };
  }

  try {
    const anchorResult = await anchorMerkleRoot({
      merkleRoot,
      contractRecord: contract,
      batchId: anchorRecord.batchId,
      actor,
    });

    anchorRecord.status = 'anchored';
    anchorRecord.txHash = anchorResult.anchorTxHash || '';
    anchorRecord.batchId = anchorResult.anchorBatchId || anchorRecord.batchId || '';
    anchorRecord.blockNumber = anchorResult.anchorBlockNumber ?? null;
    anchorRecord.explorerUrl = anchorResult.anchorExplorerUrl || '';
    anchorRecord.eventName = anchorResult.anchorEventName || '';
    anchorRecord.eventArgs = anchorResult.anchorEventArgs || null;
    anchorRecord.anchoredAt = anchorResult.anchoredAt || new Date();
    anchorRecord.anchoredBy = actor?._id || null;
    anchorRecord.failureReason = '';
    await anchorRecord.save();

    return {
      anchorRecord,
      anchorResult,
      reused: false,
    };
  } catch (error) {
    anchorRecord.status = 'failed';
    anchorRecord.failureReason = error.message || 'Anchor transaction failed.';
    await anchorRecord.save();
    throw error;
  }
}

function applyAnchorToDraft(draft, { anchorRecord, anchorResult, proof, tree }) {
  draft.merkleLeaf = proof.leaf;
  draft.merkleRoot = tree.root;
  draft.merkleProof = proof.proof;
  draft.merkleTreeSize = tree.size;
  draft.merkleLeafIndex = proof.index;
  draft.merkleAlgorithm = MERKLE_ALGORITHM;

  draft.anchorStatus = 'anchored';
  draft.anchoredAt = anchorResult.anchoredAt || new Date();
  draft.anchoredBy = anchorResult.anchoredBy || null;
  draft.anchorTxHash = anchorResult.anchorTxHash || '';
  draft.anchorBatchId = anchorResult.anchorBatchId || anchorRecord.batchId || '';
  draft.anchorBlockNumber = anchorResult.anchorBlockNumber ?? null;
  draft.anchorContractAddress = anchorResult.anchorContractAddress || anchorResult.contractAddress || '';
  draft.contractAddress = anchorResult.contractAddress || anchorResult.anchorContractAddress || '';
  draft.anchorNetwork = anchorResult.anchorNetwork || '';
  draft.anchorChainId = anchorResult.anchorChainId ?? null;
  draft.anchorExplorerUrl = anchorResult.anchorExplorerUrl || '';
  draft.anchorEventName = anchorResult.anchorEventName || '';
  draft.anchorEventArgs = anchorResult.anchorEventArgs || null;
  draft.anchorFailureReason = '';
  draft.anchoringUnavailableReason = '';

  draft.anchoring = {
    ...(draft.anchoring?.toObject?.() || draft.anchoring || {}),
    isAnchored: true,
    anchorId: anchorRecord._id,
    status: 'anchored',
    anchoredAt: draft.anchoredAt,
    txHash: draft.anchorTxHash,
    batchId: draft.anchorBatchId,
    blockNumber: draft.anchorBlockNumber,
    contractAddress: draft.anchorContractAddress || draft.contractAddress,
    contractId: String(anchorRecord.contractId || ''),
    chainId: draft.anchorChainId,
    network: draft.anchorNetwork,
    explorerUrl: draft.anchorExplorerUrl,
    merkleRoot: draft.merkleRoot,
    merkleLeaf: draft.merkleLeaf,
    merkleProof: draft.merkleProof,
    merkleTreeSize: draft.merkleTreeSize,
    merkleLeafIndex: draft.merkleLeafIndex,
    merkleAlgorithm: draft.merkleAlgorithm,
    proofHash: proof.proofHash,
    canonicalCredentialHash: proof.vcHash,
    eventName: draft.anchorEventName,
    eventArgs: draft.anchorEventArgs,
    failureReason: '',
  };
  draft.markModified('anchoring');
}

async function updateDraftsForAnchor(drafts, plan, anchorRecord, anchorResult) {
  const updated = [];

  for (const draft of drafts) {
    const proof = plan.proofByCredentialId.get(draft._id.toString());
    applyAnchorToDraft(draft, {
      anchorRecord,
      anchorResult,
      proof,
      tree: plan.tree,
    });
    await draft.save();
    updated.push(serializeDoc(draft));
  }

  return updated;
}

async function getCredentialOrThrow(id) {
  assertObjectId(id, 'credential id');

  const CredentialDraft = getCredentialDraftModel();
  const draft = await CredentialDraft.findById(id);

  if (!draft) {
    throw new ApiError(404, 'Credential not found.');
  }

  return draft;
}

function buildIdempotentCredentialResponse(draft) {
  return {
    alreadyAnchored: true,
    credential: serializeDoc(draft),
    anchor: {
      anchorId: cleanString(draft?.anchoring?.anchorId || ''),
      merkleRoot: draft.merkleRoot || draft?.anchoring?.merkleRoot || '',
      txHash: draft.anchorTxHash || draft?.anchoring?.txHash || '',
      batchId: draft.anchorBatchId || draft?.anchoring?.batchId || '',
      blockNumber: draft.anchorBlockNumber ?? draft?.anchoring?.blockNumber ?? null,
      contractAddress:
        draft.anchorContractAddress ||
        draft.contractAddress ||
        draft?.anchoring?.contractAddress ||
        '',
      anchoredAt: draft.anchoredAt || draft?.anchoring?.anchoredAt || null,
    },
  };
}

export async function anchorCredential(credentialId, _payload = {}, actor = null) {
  assertAnchorActor(actor);
  const draft = await getCredentialOrThrow(credentialId);
  assertAnchorableCredential(draft);

  if (isCredentialAnchored(draft)) {
    return buildIdempotentCredentialResponse(draft);
  }

  const { contract } = await getActiveAnchorContext();
  const plan = buildAnchorPlan([draft]);
  const { anchorRecord, anchorResult, reused } = await createOrReuseAnchorRecord({
    plan,
    contract,
    actor,
    anchorType: 'single',
  });
  const [credential] = await updateDraftsForAnchor([draft], plan, anchorRecord, anchorResult);

  return {
    alreadyAnchored: false,
    reusedExistingRoot: reused,
    credential,
    anchor: serializeDoc(anchorRecord),
  };
}

export async function anchorBatch(payload = {}, actor = null) {
  assertAnchorActor(actor);

  const ids = [
    ...new Set(
      (payload.credentialIds || payload.credentials || [])
        .map((value) => cleanString(value))
        .filter(Boolean)
    ),
  ];

  if (!ids.length) {
    throw new ApiError(400, 'At least one credential id is required.');
  }

  ids.forEach((id) => assertObjectId(id, 'credential id'));

  const CredentialDraft = getCredentialDraftModel();
  const drafts = await CredentialDraft.find({ _id: { $in: ids } });
  const foundIds = new Set(drafts.map((draft) => draft._id.toString()));
  const missingIds = ids.filter((id) => !foundIds.has(id));

  if (missingIds.length) {
    throw new ApiError(404, `Credential(s) not found: ${missingIds.join(', ')}`);
  }

  drafts.forEach(assertAnchorableCredential);

  const alreadyAnchored = drafts.filter(isCredentialAnchored).map((draft) => draft._id.toString());
  const pendingDrafts = drafts.filter((draft) => !isCredentialAnchored(draft));

  if (!pendingDrafts.length) {
    return {
      processedCount: 0,
      alreadyAnchoredCount: alreadyAnchored.length,
      alreadyAnchored,
      credentials: drafts.map(serializeDoc),
      anchor: null,
    };
  }

  const { contract } = await getActiveAnchorContext();
  const plan = buildAnchorPlan(pendingDrafts);
  const { anchorRecord, anchorResult, reused } = await createOrReuseAnchorRecord({
    plan,
    contract,
    actor,
    anchorType: 'batch',
  });
  const credentials = await updateDraftsForAnchor(
    pendingDrafts,
    plan,
    anchorRecord,
    anchorResult
  );

  return {
    processedCount: credentials.length,
    alreadyAnchoredCount: alreadyAnchored.length,
    alreadyAnchored,
    reusedExistingRoot: reused,
    merkleRoot: anchorRecord.merkleRoot,
    txHash: anchorRecord.txHash || '',
    anchor: serializeDoc(anchorRecord),
    credentials,
  };
}

export async function getAnchorDetails(anchorId) {
  const normalized = cleanString(anchorId);
  if (!normalized) {
    throw new ApiError(400, 'Anchor id is required.');
  }

  const Anchor = getMerkleAnchorModel();
  const clauses = [{ merkleRoot: normalized }, { txHash: normalized }];
  if (Types.ObjectId.isValid(normalized)) clauses.push({ _id: normalized });

  const anchor = await Anchor.findOne({ $or: clauses }).lean();
  if (!anchor) {
    throw new ApiError(404, 'Anchor details were not found.');
  }

  return serializeDoc(anchor);
}

async function resolveIssuerPublicKey(credential) {
  const proof = credential?.signedCredential?.proof || {};
  const directKey = cleanString(
    credential?.issuerPublicKey ||
      proof.issuerPublicKey
  );

  if (directKey) {
    return {
      publicKeyPem: directKey,
      source: 'credential_record',
      issuerKeyId: cleanString(credential?.issuerKeyId || proof.issuerKeyId),
      verificationMethod: cleanString(credential?.verificationMethod || proof.verificationMethod),
    };
  }

  const lookup = cleanString(
    credential?.issuerKeyId ||
      proof.issuerKeyId ||
      proof.verificationMethod ||
      credential?.verificationMethod
  );

  if (!lookup) {
    return {
      publicKeyPem: '',
      source: '',
      issuerKeyId: '',
      verificationMethod: '',
    };
  }

  const IssuerKey = getIssuerKeyModel();
  const clauses = [{ kid: lookup }, { name: lookup }];
  if (Types.ObjectId.isValid(lookup)) clauses.push({ _id: lookup });

  const issuerKey = await IssuerKey.findOne({ $or: clauses }).lean();
  return {
    publicKeyPem: cleanString(issuerKey?.publicKeyPem),
    source: issuerKey ? 'issuer_key_store' : '',
    issuerKeyId: cleanString(issuerKey?._id || credential?.issuerKeyId || proof.issuerKeyId),
    verificationMethod: cleanString(issuerKey?.kid || credential?.verificationMethod || proof.verificationMethod),
  };
}

export async function verifyAnchoredCredential(credentialId) {
  assertObjectId(credentialId, 'credential id');

  const CredentialDraft = getCredentialDraftModel();
  const credential = await CredentialDraft.findById(credentialId).lean();

  if (!credential) {
    throw new ApiError(404, 'Credential not found.');
  }

  if (!credential.signedCredential) {
    throw new ApiError(409, 'Signed credential payload is missing.');
  }

  const vcHash = computeVcHash(credential.signedCredential);
  const proof = credential.signedCredential.proof || {};
  const proofHash = normalizeHex(proof.vcHash || proof.canonicalVcHash);
  const storedHash = normalizeHex(resolveStoredCredentialHash(credential));
  const hashMatchesProof = Boolean(proofHash) && safeCompareHex(vcHash, proofHash);
  const hashMatchesRecord = Boolean(storedHash) && safeCompareHex(vcHash, storedHash);
  const issuer = await resolveIssuerPublicKey(credential);
  const signature = verifyVcSignature(credential.signedCredential, issuer.publicKeyPem);

  const merkleLeaf = buildMerkleLeaf(vcHash);
  const storedLeaf = normalizeHex(credential.merkleLeaf || credential?.anchoring?.merkleLeaf);
  const merkleRoot = normalizeHex(credential.merkleRoot || credential?.anchoring?.merkleRoot);
  const merkleProof = Array.isArray(credential.merkleProof)
    ? credential.merkleProof
    : credential?.anchoring?.merkleProof || [];
  const leafMatches = Boolean(storedLeaf && merkleLeaf) && safeCompareHex(merkleLeaf, storedLeaf);
  const merkleProofValid =
    Boolean(merkleRoot && leafMatches) &&
    verifyMerkleProof({
      leaf: merkleLeaf,
      proof: merkleProof,
      root: merkleRoot,
    });

  const chainCheck = await verifyMerkleRootOnChain({
    merkleRoot,
    contractAddress:
      credential.anchorContractAddress ||
      credential.contractAddress ||
      credential?.anchoring?.contractAddress,
    blockNumber: credential.anchorBlockNumber || credential?.anchoring?.blockNumber,
    txHash: credential.anchorTxHash || credential?.anchoring?.txHash,
  });

  const signatureValid =
    Boolean(signature.valid) &&
    proof.canonicalizationAlgorithm &&
    proof.hashAlgorithm === HASH_ALGORITHM &&
    hashMatchesProof &&
    hashMatchesRecord;
  const blockchainAnchorValid = Boolean(chainCheck.verified);
  const overallValid = signatureValid && merkleProofValid && blockchainAnchorValid;
  const verificationStatus = overallValid
    ? 'VALID'
    : signatureValid && merkleProofValid
      ? 'NOT_ANCHORED'
      : 'INVALID';

  return {
    signatureValid,
    merkleProofValid,
    blockchainAnchorValid,
    overallValid,
    verificationStatus,
    vcHash,
    proofHash: proofHash || '',
    merkleLeaf,
    merkleRoot,
    merkleProof,
    merkleAlgorithm: credential.merkleAlgorithm || MERKLE_ALGORITHM,
    txHash: credential.anchorTxHash || credential?.anchoring?.txHash || '',
    batchId: credential.anchorBatchId || credential?.anchoring?.batchId || '',
    blockNumber: credential.anchorBlockNumber ?? credential?.anchoring?.blockNumber ?? null,
    contractAddress:
      credential.anchorContractAddress ||
      credential.contractAddress ||
      credential?.anchoring?.contractAddress ||
      '',
    anchoredAt: credential.anchoredAt || credential?.anchoring?.anchoredAt || null,
    explorerUrl: credential.anchorExplorerUrl || credential?.anchoring?.explorerUrl || '',
    checks: {
      signature,
      issuer,
      hash: {
        vcHash,
        proofHash: proofHash || '',
        storedHash: storedHash || '',
        hashMatchesProof,
        hashMatchesRecord,
      },
      merkle: {
        leafMatches,
        storedLeaf: storedLeaf || '',
        treeSize: credential.merkleTreeSize || credential?.anchoring?.merkleTreeSize || 0,
        leafIndex: credential.merkleLeafIndex ?? credential?.anchoring?.merkleLeafIndex ?? -1,
      },
      blockchain: chainCheck,
    },
  };
}
