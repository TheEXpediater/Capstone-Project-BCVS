import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import { env } from '../../config/env.js';
import { ApiError } from '../../shared/utils/ApiError.js';
import { normalizeHex } from '../../shared/utils/vcProof.js';
import { getContractModel } from './model.js';
import { getSystemSettingModel } from '../settings/setting.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONTRACT_TYPES = {
  admin: {
    contractType: 'admin',
    contractName: 'AdminContract',
    artifactFile: 'AdminContract.json',
  },
  merkle_anchor: {
    contractType: 'merkle_anchor',
    contractName: 'MerkleAnchor',
    artifactFile: 'MerkleAnchor.json',
  },
};

export const LEGACY_MERKLE_ANCHOR_ADDRESS = '0x0ac96734b9a2a368D8EE3f6CF9BC27EC373f195f';
const LEGACY_MERKLE_ABI_VERSION = 'legacy_anchor_v1';
const LEGACY_MERKLE_ANCHOR_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'root', type: 'bytes32' },
      { indexed: false, internalType: 'string', name: 'batchId', type: 'string' },
      { indexed: true, internalType: 'address', name: 'sender', type: 'address' },
    ],
    name: 'Anchored',
    type: 'event',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'root', type: 'bytes32' },
      { internalType: 'string', name: 'batchId', type: 'string' },
    ],
    name: 'anchor',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

const ANCHOR_FUNCTION_NAMES = ['anchorRoot', 'anchor', 'storeRoot', 'addRoot'];
const VERIFY_FUNCTION_NAMES = ['isRootAnchored', 'rootExists', 'verifyRoot'];
const ROOT_EVENT_NAMES = ['RootAnchored', 'Anchored', 'MerkleRootAnchored', 'CredentialRootAnchored'];

export const EMPTY_MERKLE_CAPABILITIES = {
  canAnchorMerkleRoot: false,
  canVerifyMerkleRoot: false,
  anchorFunctionName: '',
  verifyFunctionName: '',
  rootAnchoredEventName: '',
};

function cleanString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function isLegacyMerkleAnchorAddress(value) {
  return cleanString(value).toLowerCase() === LEGACY_MERKLE_ANCHOR_ADDRESS.toLowerCase();
}

function isLegacyMerkleAnchorContract(contract = {}) {
  return (
    isLegacyMerkleAnchorAddress(contract?.address || contract) ||
    cleanString(contract?.abiVersion).toLowerCase() === LEGACY_MERKLE_ABI_VERSION
  );
}

function buildLegacyMerkleAnchorRecord(overrides = {}) {
  const chainId = overrides.chainId ?? env.blockchain.chainId ?? 80002;
  return {
    _id: cleanString(overrides._id || LEGACY_MERKLE_ANCHOR_ADDRESS),
    contractType: 'merkle_anchor',
    contractName: overrides.contractName || 'LegacyMerkleAnchor',
    address: LEGACY_MERKLE_ANCHOR_ADDRESS,
    deployerAddress: overrides.deployerAddress || '',
    ownerAddress: overrides.ownerAddress || '',
    txHash: overrides.txHash || null,
    chainId,
    network: overrides.network || (Number(chainId) === 80002 ? 'matic-amoy' : `chain-${chainId}`),
    gasToken: overrides.gasToken || 'POL',
    status: 'success',
    explorerUrl: overrides.explorerUrl || getExplorerBaseUrl(chainId) || null,
    abiVersion: LEGACY_MERKLE_ABI_VERSION,
    capabilities: detectContractCapabilities(LEGACY_MERKLE_ANCHOR_ABI),
    verified: true,
    isActive: true,
    active: true,
    errorMessage: null,
  };
}

export function normalizeContractType(value = 'admin') {
  const normalized = cleanString(value, 'admin').toLowerCase();

  if (normalized === 'admin' || normalized === 'admin_contract' || normalized === 'admincontract') {
    return 'admin';
  }

  if (
    normalized === 'merkle_anchor' ||
    normalized === 'merkleanchor' ||
    normalized === 'merkle' ||
    normalized === 'anchor'
  ) {
    return 'merkle_anchor';
  }

  throw new ApiError(400, 'Unsupported contract type.');
}

function inferContractType(contract = {}) {
  if (contract?.contractType) return normalizeContractType(contract.contractType);
  if (cleanString(contract?.contractName).toLowerCase() === 'merkleanchor') return 'merkle_anchor';
  return 'admin';
}

function getContractConfig(contractType = 'admin') {
  return CONTRACT_TYPES[normalizeContractType(contractType)];
}

function artifactPathFor(contractType = 'admin') {
  return path.resolve(__dirname, 'artifacts', getContractConfig(contractType).artifactFile);
}

export function loadArtifact(contractType = 'admin') {
  const config = getContractConfig(contractType);
  const artifactPath = artifactPathFor(config.contractType);

  if (!fs.existsSync(artifactPath)) {
    throw new ApiError(
      500,
      `${config.contractName} artifact not found. Run npm run compile:contracts or copy ${config.artifactFile} into server/src/modules/contracts/artifacts/`
    );
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  if (!artifact.abi || !artifact.bytecode || artifact.bytecode === '0x') {
    throw new ApiError(500, `${config.contractName} artifact is invalid or bytecode is missing.`);
  }

  return artifact;
}

function hasSingleBytes32Input(item) {
  return item?.inputs?.length === 1 && item.inputs[0]?.type === 'bytes32';
}

function hasAnchorInputs(item) {
  return (
    item?.inputs?.length === 1 &&
    item.inputs[0]?.type === 'bytes32'
  ) || (
    item?.inputs?.length === 2 &&
    item.inputs[0]?.type === 'bytes32' &&
    item.inputs[1]?.type === 'string'
  );
}

function hasBoolOutput(item) {
  return item?.outputs?.length >= 1 && item.outputs[0]?.type === 'bool';
}

function findAnchorFunction(abi = [], names = []) {
  return (
    names.find((name) =>
      abi.some(
        (item) =>
          item?.type === 'function' &&
          item?.name === name &&
          hasAnchorInputs(item)
      )
    ) || ''
  );
}

function findFunction(abi = [], names = [], { requireBoolOutput = false } = {}) {
  return (
    names.find((name) =>
      abi.some(
        (item) =>
          item?.type === 'function' &&
          item?.name === name &&
          hasSingleBytes32Input(item) &&
          (!requireBoolOutput || hasBoolOutput(item))
      )
    ) || ''
  );
}

function findEvent(abi = [], names = []) {
  return names.find((name) => abi.some((item) => item?.type === 'event' && item?.name === name)) || '';
}

export function detectContractCapabilities(abi = []) {
  const anchorFunctionName = findAnchorFunction(abi, ANCHOR_FUNCTION_NAMES);
  const verifyFunctionName = findFunction(abi, VERIFY_FUNCTION_NAMES, {
    requireBoolOutput: true,
  });
  const rootAnchoredEventName = findEvent(abi, ROOT_EVENT_NAMES);

  return {
    canAnchorMerkleRoot: Boolean(anchorFunctionName),
    canVerifyMerkleRoot: Boolean(verifyFunctionName),
    anchorFunctionName,
    verifyFunctionName,
    rootAnchoredEventName,
  };
}

function normalizeCapabilities(value = {}) {
  return {
    ...EMPTY_MERKLE_CAPABILITIES,
    ...(value && typeof value === 'object' ? value : {}),
  };
}

export function getCapabilitiesForContract(contract = {}) {
  try {
    return detectContractCapabilities(getAbiForContract(contract));
  } catch {
    return normalizeCapabilities(contract?.capabilities);
  }
}

export function getAbiForContract(contract = {}) {
  if (isLegacyMerkleAnchorContract(contract)) {
    return LEGACY_MERKLE_ANCHOR_ABI;
  }

  return loadArtifact(inferContractType(contract)).abi;
}

function requireRpcEnv() {
  if (!env.blockchain.rpcUrl) {
    throw new ApiError(500, 'Missing RPC_URL in server .env');
  }
}

function requireBlockchainEnv() {
  requireRpcEnv();

  if (!env.blockchain.contractOperatorPrivateKey) {
    throw new ApiError(500, 'Missing CONTRACT_OPERATOR_PRIVATE_KEY in server .env');
  }
}

function getProvider() {
  requireRpcEnv();
  return new ethers.JsonRpcProvider(env.blockchain.rpcUrl);
}

function getWallet() {
  const provider = getProvider();
  return new ethers.Wallet(env.blockchain.contractOperatorPrivateKey, provider);
}

async function ensureMainSettings() {
  const SystemSetting = getSystemSettingModel();
  let settings = await SystemSetting.findOne({ code: 'main' });

  if (!settings) {
    settings = await SystemSetting.create({ code: 'main' });
  }

  return settings;
}

export function getExplorerBaseUrl(chainId) {
  if (Number(chainId) === 80002) {
    return 'https://amoy.polygonscan.com';
  }

  return null;
}

export function buildExplorerTxUrl(chainId, txHash) {
  const explorerBaseUrl = getExplorerBaseUrl(chainId);
  const hash = cleanString(txHash);
  return explorerBaseUrl && hash ? `${explorerBaseUrl}/tx/${encodeURIComponent(hash)}` : '';
}

async function getAccountInfo(provider, wallet) {
  const network = await provider.getNetwork();
  const balanceWei = await provider.getBalance(wallet.address);

  return {
    address: wallet.address,
    chainId: Number(network.chainId || env.blockchain.chainId),
    network: network.name,
    balanceWei: balanceWei.toString(),
    balanceNative: ethers.formatEther(balanceWei),
    gasToken: 'POL',
  };
}

async function getFeePerGas(provider) {
  const feeData = await provider.getFeeData();
  const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;

  if (!feePerGas) {
    throw new ApiError(500, 'Could not fetch fee data.');
  }

  return feePerGas;
}

function serializeContract(contract = {}) {
  const raw = typeof contract?.toObject === 'function' ? contract.toObject() : contract;
  const contractType = inferContractType(raw);
  const config = getContractConfig(contractType);
  const capabilities = getCapabilitiesForContract({ ...raw, contractType });
  const isActive = Boolean(raw?.isActive || raw?.active);

  return {
    ...raw,
    contractType,
    contractName: raw?.contractName || config.contractName,
    capabilities,
    verified: Boolean(raw?.verified || (raw?.status === 'success' && raw?.address)),
    isActive,
    active: isActive,
  };
}

async function buildEstimateInternal(contractType = 'admin') {
  const config = getContractConfig(contractType);
  const provider = getProvider();
  const wallet = getWallet();
  const artifact = loadArtifact(config.contractType);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const deployTx = await factory.getDeployTransaction();

  const gasLimit = await provider.estimateGas({
    ...deployTx,
    from: wallet.address,
  });

  const feePerGas = await getFeePerGas(provider);
  const totalCostWei = gasLimit * feePerGas;
  const network = await provider.getNetwork();
  const account = await getAccountInfo(provider, wallet);
  const capabilities = detectContractCapabilities(artifact.abi);

  return {
    contractType: config.contractType,
    contractName: config.contractName,
    chainId: Number(network.chainId || env.blockchain.chainId),
    network: network.name,
    gasToken: 'POL',
    walletAddress: wallet.address,
    gasLimit: gasLimit.toString(),
    feePerGasWei: feePerGas.toString(),
    feePerGasGwei: ethers.formatUnits(feePerGas, 'gwei'),
    totalCostWei: totalCostWei.toString(),
    totalCostNative: ethers.formatEther(totalCostWei),
    capabilities,
    account,
  };
}

export async function getBlockchainRuntimeOverview() {
  const provider = getProvider();
  const wallet = getWallet();
  const network = await provider.getNetwork();
  const account = await getAccountInfo(provider, wallet);

  return {
    health: {
      ok: true,
      walletAddress: wallet.address,
      chainId: Number(network.chainId || env.blockchain.chainId),
      network: network.name,
    },
    account,
  };
}

export async function getContractsDashboard() {
  const Contract = getContractModel();
  const SystemSetting = getSystemSettingModel();

  const [overview, contracts, settings] = await Promise.all([
    getBlockchainRuntimeOverview(),
    Contract.find().sort({ createdAt: -1 }).lean(),
    SystemSetting.findOne({ code: 'main' }).lean(),
  ]);

  const activeAnchorContractId = cleanString(
    settings?.blockchain?.activeAnchorContractId ||
      settings?.blockchain?.activeAnchorContractAddress
  );
  const serializedContracts = contracts.map(serializeContract);
  const activeAnchorContract =
    activeAnchorContractId
      ? serializedContracts.find(
          (contract) =>
            contract.contractType === 'merkle_anchor' &&
            (String(contract._id) === activeAnchorContractId ||
              contract.address === activeAnchorContractId ||
              contract.address === settings?.blockchain?.activeAnchorContractAddress)
        ) ||
        (isLegacyMerkleAnchorAddress(activeAnchorContractId)
          ? buildLegacyMerkleAnchorRecord({
              chainId: settings?.blockchain?.activeAnchorContractChainId || overview.health.chainId,
              network: settings?.blockchain?.activeAnchorContractNetwork || overview.health.network,
              explorerUrl: settings?.blockchain?.activeAnchorContractExplorerUrl || '',
            })
          : null)
      : buildLegacyMerkleAnchorRecord({
          chainId: overview.health.chainId,
          network: overview.health.network,
        });

  return {
    ...overview,
    activeAnchorContractId,
    activeAnchorContractAddress: cleanString(settings?.blockchain?.activeAnchorContractAddress),
    activeAnchorContract,
    contracts: serializedContracts,
  };
}

export async function estimateDeployment({ contractType = 'admin' } = {}) {
  return buildEstimateInternal(contractType);
}

export async function deployContract({ contractType = 'admin' } = {}) {
  const config = getContractConfig(contractType);
  const provider = getProvider();
  const wallet = getWallet();
  const artifact = loadArtifact(config.contractType);
  const Contract = getContractModel();
  const capabilities = detectContractCapabilities(artifact.abi);

  let deploymentRecord = null;

  try {
    const estimate = await buildEstimateInternal(config.contractType);
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

    deploymentRecord = await Contract.create({
      contractType: config.contractType,
      contractName: estimate.contractName,
      deployerAddress: wallet.address,
      chainId: estimate.chainId,
      network: estimate.network,
      gasToken: estimate.gasToken,
      estimatedCostNative: estimate.totalCostNative,
      estimatedCostWei: estimate.totalCostWei,
      capabilities,
      verified: false,
      active: false,
      status: 'pending',
    });

    const contract = await factory.deploy();
    const deployTx = contract.deploymentTransaction();

    await contract.waitForDeployment();

    const address = await contract.getAddress();
    const explorerUrl = buildExplorerTxUrl(estimate.chainId, deployTx?.hash);

    deploymentRecord.address = address;
    deploymentRecord.txHash = deployTx?.hash ?? null;
    deploymentRecord.explorerUrl = explorerUrl || null;
    deploymentRecord.status = 'success';
    deploymentRecord.verified = true;
    deploymentRecord.errorMessage = null;
    deploymentRecord.capabilities = capabilities;
    await deploymentRecord.save();

    const account = await getAccountInfo(provider, wallet);

    return {
      success: true,
      id: deploymentRecord._id,
      contractType: config.contractType,
      contractName: estimate.contractName,
      address,
      owner: wallet.address,
      txHash: deployTx?.hash ?? null,
      chainId: estimate.chainId,
      network: estimate.network,
      explorerUrl,
      capabilities,
      account,
    };
  } catch (error) {
    if (deploymentRecord) {
      deploymentRecord.status = 'failed';
      deploymentRecord.errorMessage = error.message || 'Deploy error';
      await deploymentRecord.save();
    }

    throw new ApiError(500, error.message || 'Deploy error');
  }
}

function hasReadableFunction(abi = [], name = '') {
  return abi.some(
    (item) =>
      item?.type === 'function' &&
      item?.name === name &&
      ['view', 'pure'].includes(item?.stateMutability)
  );
}

function firstNoArgReadableFunction(abi = []) {
  return (
    abi.find(
      (item) =>
        item?.type === 'function' &&
        ['view', 'pure'].includes(item?.stateMutability) &&
        !item?.inputs?.length &&
        item?.outputs?.length
    )?.name || ''
  );
}

async function verifyReadableContractCall({ contract, abi, capabilities }) {
  const candidates = [];

  if (hasReadableFunction(abi, 'owner')) {
    candidates.push({ method: 'owner', args: [] });
  }

  const noArgReadable = firstNoArgReadableFunction(abi);
  if (noArgReadable && noArgReadable !== 'owner') {
    candidates.push({ method: noArgReadable, args: [] });
  }

  if (capabilities?.verifyFunctionName) {
    candidates.push({ method: capabilities.verifyFunctionName, args: [ethers.ZeroHash] });
  }

  for (const candidate of candidates) {
    try {
      const value = await contract[candidate.method](...(candidate.args || []));
      return {
        ok: true,
        method: candidate.method,
        value: typeof value === 'bigint' ? value.toString() : String(value ?? ''),
      };
    } catch {
      continue;
    }
  }

  return {
    ok: false,
    method: '',
    value: '',
  };
}

export async function registerExistingContract(
  { address = '', contractType = 'merkle_anchor' } = {},
  actor = null
) {
  assertAnchorManager(actor);

  const config = getContractConfig(contractType);
  const normalizedAddress = cleanString(address);

  if (!ethers.isAddress(normalizedAddress)) {
    throw new ApiError(400, 'A valid contract address is required.');
  }

  const checksumAddress = ethers.getAddress(normalizedAddress);
  const provider = getProvider();
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId || env.blockchain.chainId);

  if (Number(env.blockchain.chainId) && chainId !== Number(env.blockchain.chainId)) {
    throw new ApiError(
      409,
      `Connected chainId ${chainId} does not match configured chainId ${env.blockchain.chainId}.`
    );
  }

  const code = await provider.getCode(checksumAddress);
  if (!code || code === '0x') {
    throw new ApiError(404, 'No contract code was found at this address on the configured network.');
  }

  const isLegacyAnchor =
    config.contractType === 'merkle_anchor' && isLegacyMerkleAnchorAddress(checksumAddress);
  const abi = isLegacyAnchor ? LEGACY_MERKLE_ANCHOR_ABI : loadArtifact(config.contractType).abi;
  const capabilities = detectContractCapabilities(abi);
  const contract = new ethers.Contract(checksumAddress, abi, provider);
  const readableCheck = isLegacyAnchor
    ? {
        ok: true,
        method: 'legacy_anchor_write_only',
        value: '',
      }
    : await verifyReadableContractCall({
        contract,
        abi,
        capabilities,
      });

  if (!readableCheck.ok) {
    throw new ApiError(
      409,
      'Contract exists, but it did not respond to a readable MerkleAnchor ABI method.'
    );
  }

  if (config.contractType === 'merkle_anchor') {
    if (!capabilities.canAnchorMerkleRoot) {
      throw new ApiError(409, 'Contract does not support Merkle root anchoring.');
    }
  }

  const Contract = getContractModel();
  const ownerAddress =
    readableCheck.method === 'owner' && ethers.isAddress(readableCheck.value)
      ? ethers.getAddress(readableCheck.value)
      : '';
  const explorerBaseUrl = getExplorerBaseUrl(chainId);

  let record = await Contract.findOne({
    address: checksumAddress,
    chainId,
    contractType: config.contractType,
  });

  const payload = {
    contractType: config.contractType,
    contractName: config.contractName,
    address: checksumAddress,
    deployerAddress: ownerAddress || '',
    ownerAddress,
    chainId,
    network: network.name || `chain-${chainId}`,
    gasToken: 'POL',
    status: 'success',
    verified: true,
    capabilities,
    explorerUrl: explorerBaseUrl || null,
    abiVersion: isLegacyAnchor ? LEGACY_MERKLE_ABI_VERSION : '',
    errorMessage: null,
  };

  if (record) {
    Object.assign(record, payload);
  } else {
    record = await Contract.create(payload);
  }

  await record.save();

  return {
    success: true,
    contract: serializeContract(record),
    address: checksumAddress,
    contractType: config.contractType,
    contractName: config.contractName,
    ownerAddress,
    chainId,
    network: network.name || `chain-${chainId}`,
    verified: true,
    readableMethod: readableCheck.method,
    capabilities,
  };
}

export async function findContractByIdOrAddress(value) {
  const normalized = cleanString(value);
  if (!normalized) return null;

  const Contract = getContractModel();
  const clauses = [{ address: normalized }];

  if (ethers.isAddress(normalized)) {
    clauses.push({ address: ethers.getAddress(normalized) });
  }

  if (/^[0-9a-fA-F]{24}$/.test(normalized)) {
    clauses.push({ _id: normalized });
  }

  const contract = await Contract.findOne({
    status: 'success',
    $or: clauses,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (contract) return serializeContract(contract);
  if (isLegacyMerkleAnchorAddress(normalized)) return buildLegacyMerkleAnchorRecord();
  return null;
}

export async function getActiveContractRecord(settings) {
  const configuredAnchor = cleanString(
    settings?.blockchain?.activeAnchorContractId ||
      settings?.blockchain?.activeAnchorContractAddress
  );

  if (configuredAnchor) {
    const anchorContract = await findContractByIdOrAddress(configuredAnchor);
    if (anchorContract?.contractType === 'merkle_anchor') return anchorContract;
  }

  const configured = cleanString(settings?.blockchain?.selectedContractId);
  if (configured) {
    return findContractByIdOrAddress(configured);
  }

  return buildLegacyMerkleAnchorRecord({
    chainId: settings?.blockchain?.activeAnchorContractChainId || env.blockchain.chainId,
    network: settings?.blockchain?.activeAnchorContractNetwork || '',
    explorerUrl: settings?.blockchain?.activeAnchorContractExplorerUrl || '',
  });
}

export async function getContractCapabilitiesByAddress(address) {
  const contract = await findContractByIdOrAddress(address);
  if (!contract) {
    throw new ApiError(404, 'Contract was not found.');
  }

  return {
    contract,
    capabilities: getCapabilitiesForContract(contract),
  };
}

function assertAnchorManager(actor) {
  if (!actor || actor.role !== 'developer') {
    throw new ApiError(403, 'Only the MIS developer can switch the active anchor contract.');
  }
}

export async function selectActiveAnchorContract({ contractId = '', contractAddress = '' } = {}, actor = null) {
  assertAnchorManager(actor);

  const normalizedId = cleanString(contractId || contractAddress);
  if (!normalizedId) {
    throw new ApiError(400, 'Anchor contract id or address is required.');
  }

  const contract = await findContractByIdOrAddress(normalizedId);
  if (!contract) {
    throw new ApiError(404, 'Selected anchor contract was not found.');
  }

  if (contract.contractType !== 'merkle_anchor') {
    throw new ApiError(409, 'Only MerkleAnchor contracts can be selected for anchoring.');
  }

  const capabilities = getCapabilitiesForContract(contract);
  if (!capabilities.canAnchorMerkleRoot) {
    throw new ApiError(409, 'Selected contract does not support Merkle root anchoring.');
  }

  const settings = await ensureMainSettings();
  const Contract = getContractModel();

  settings.blockchain.activeAnchorContractId = String(contract._id);
  settings.blockchain.activeAnchorContractAddress = contract.address || '';
  settings.blockchain.activeAnchorContractName = contract.contractName || 'MerkleAnchor';
  settings.blockchain.activeAnchorContractChainId = contract.chainId ?? null;
  settings.blockchain.activeAnchorContractNetwork = contract.network || '';
  settings.blockchain.activeAnchorContractExplorerUrl = contract.explorerUrl || '';
  settings.blockchain.activeAnchorContractCapabilities = capabilities;

  settings.blockchain.selectedContractId = contract.address || String(contract._id);
  settings.blockchain.selectedContractName = contract.contractName || 'MerkleAnchor';
  settings.blockchain.selectedContractType = contract.contractType;
  settings.blockchain.selectedContractAddress = contract.address || '';
  settings.blockchain.selectedContractChainId = contract.chainId ?? null;
  settings.blockchain.selectedContractNetwork = contract.network || '';
  settings.blockchain.selectedContractExplorerUrl = contract.explorerUrl || '';
  settings.blockchain.selectedContractCapabilities = capabilities;
  settings.updatedBy = actor?._id || null;

const storedContractId = cleanString(contract._id);
  const hasStoredContractRecord =
  /^[0-9a-fA-F]{24}$/.test(storedContractId);

  await Contract.updateMany(
    hasStoredContractRecord
      ? { contractType: 'merkle_anchor', _id: { $ne: contract._id } }
      : { contractType: 'merkle_anchor' },
    { $set: { isActive: false, active: false } }
  );

  if (hasStoredContractRecord) {
    await Contract.updateOne(
      { _id: contract._id },
      {
        $set: {
          isActive: true,
          active: true,
          verified: true,
          capabilities,
        },
      }
    );
  }

  await settings.save();

  return {
    activeAnchorContractId: settings.blockchain.activeAnchorContractId,
    activeAnchorContractAddress: settings.blockchain.activeAnchorContractAddress,
    activeAnchorContractName: settings.blockchain.activeAnchorContractName,
    activeAnchorContractChainId: settings.blockchain.activeAnchorContractChainId,
    activeAnchorContractNetwork: settings.blockchain.activeAnchorContractNetwork,
    activeAnchorContractExplorerUrl: settings.blockchain.activeAnchorContractExplorerUrl,
    activeAnchorContractCapabilities: settings.blockchain.activeAnchorContractCapabilities,
    contract,
  };
}

function requireBytes32Root(root) {
  const normalized = normalizeHex(root);
  if (!ethers.isHexString(normalized, 32)) {
    throw new ApiError(400, 'Merkle root must be a non-zero bytes32 value.');
  }

  if (/^0x0{64}$/i.test(normalized)) {
    throw new ApiError(400, 'Merkle root cannot be zero.');
  }

  return normalized;
}

function makeAnchorBatchId(prefix = 'bcvs') {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  return `${prefix}-${stamp}`;
}

function getFunctionFragment(abi = [], functionName = '') {
  return abi.find((item) => item?.type === 'function' && item?.name === functionName) || null;
}

function buildAnchorFunctionCall({ abi, functionName, root, batchId = '' } = {}) {
  const fragment = getFunctionFragment(abi, functionName);
  const inputs = fragment?.inputs || [];

  if (inputs.length === 1 && inputs[0]?.type === 'bytes32') {
    return {
      args: [root],
      batchId: cleanString(batchId),
    };
  }

  if (
    inputs.length === 2 &&
    inputs[0]?.type === 'bytes32' &&
    inputs[1]?.type === 'string'
  ) {
    const resolvedBatchId = cleanString(batchId) || makeAnchorBatchId();
    return {
      args: [root, resolvedBatchId],
      batchId: resolvedBatchId,
    };
  }

  throw new ApiError(409, 'Active contract does not support Merkle root anchoring.');
}

function serializeEventValue(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(serializeEventValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => Number.isNaN(Number(key)))
        .map(([key, next]) => [key, serializeEventValue(next)])
    );
  }
  return value;
}

function serializeParsedEvent(parsed) {
  if (!parsed) return null;

  const args = {};
  parsed.fragment.inputs.forEach((input, index) => {
    args[input.name || String(index)] = serializeEventValue(parsed.args[index]);
  });

  return {
    name: parsed.name,
    args,
  };
}

function parsedEventMatchesRoot(parsed, root) {
  const normalizedRoot = normalizeHex(root);
  if (!normalizedRoot || !parsed?.fragment?.inputs?.length) return true;

  return parsed.fragment.inputs.some((input, index) => {
    if (input?.type !== 'bytes32') return false;
    return normalizeHex(parsed.args[index]) === normalizedRoot;
  });
}

function findRootAnchoredEvent(contract, receipt, eventName, root = '') {
  const expectedName = cleanString(eventName);
  if (!expectedName) return null;

  for (const log of receipt?.logs || []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === expectedName && parsedEventMatchesRoot(parsed, root)) {
        return serializeParsedEvent(parsed);
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function callVerifyFunction(contract, functionName, root) {
  const result = await contract[functionName](root);
  return Boolean(result);
}

async function verifyRootByTransaction({
  provider,
  abi,
  address,
  root,
  txHash = '',
  blockNumber = null,
  eventName = '',
  capabilities = null,
} = {}) {
  const hash = cleanString(txHash);
  if (!hash) {
    return {
      verified: false,
      reason: 'on_chain_anchor_tx_missing',
      contractAddress: address,
      capabilities,
    };
  }

  try {
    const receipt = await provider.getTransactionReceipt(hash);
    if (!receipt) {
      return {
        verified: false,
        reason: 'anchor_transaction_not_found',
        contractAddress: address,
        capabilities,
      };
    }

    const expectedAddress = cleanString(address).toLowerCase();
    const receiptTo = cleanString(receipt.to).toLowerCase();
    if (expectedAddress && receiptTo && receiptTo !== expectedAddress) {
      return {
        verified: false,
        reason: 'anchor_transaction_contract_mismatch',
        contractAddress: address,
        capabilities,
      };
    }

    if (Number(receipt.status) !== 1) {
      return {
        verified: false,
        reason: 'anchor_transaction_failed',
        contractAddress: address,
        capabilities,
      };
    }

    const expectedBlock = Number(blockNumber || 0);
    if (Number.isFinite(expectedBlock) && expectedBlock > 0 && Number(receipt.blockNumber) !== expectedBlock) {
      return {
        verified: false,
        reason: 'anchor_transaction_block_mismatch',
        contractAddress: address,
        capabilities,
      };
    }

    const eventContract = new ethers.Contract(address, abi, provider);
    const parsedEvent = findRootAnchoredEvent(eventContract, receipt, eventName, root);

    return {
      verified: true,
      rootVerified: false,
      eventVerified: Boolean(parsedEvent),
      eventCheck: {
        checked: Boolean(eventName),
        found: Boolean(parsedEvent),
        logs: parsedEvent
          ? [
              {
                transactionHash: receipt.hash || receipt.transactionHash || hash,
                blockNumber: Number(receipt.blockNumber || 0) || null,
                index: null,
              },
            ]
          : [],
        reason: parsedEvent ? '' : 'anchor_transaction_confirmed_without_read_method',
      },
      reason: '',
      contractAddress: address,
      capabilities,
    };
  } catch {
    return {
      verified: false,
      reason: 'anchor_transaction_lookup_failed',
      contractAddress: address,
      capabilities,
    };
  }
}

async function findRootAnchoredLogs({
  contract,
  eventName,
  root,
  blockNumber = null,
  txHash = '',
} = {}) {
  const normalizedEventName = cleanString(eventName);
  if (!normalizedEventName || !contract?.filters?.[normalizedEventName]) {
    return {
      checked: false,
      found: false,
      logs: [],
      reason: 'root_anchored_event_missing_from_abi',
    };
  }

  try {
    const filter = contract.filters[normalizedEventName](root);
    const block = Number(blockNumber || 0);
    const fromBlock = Number.isFinite(block) && block > 0 ? block : 0;
    const toBlock = Number.isFinite(block) && block > 0 ? block : 'latest';
    const logs = await contract.queryFilter(filter, fromBlock, toBlock);
    const hash = cleanString(txHash).toLowerCase();
    const matchingLogs = hash
      ? logs.filter((log) => cleanString(log.transactionHash).toLowerCase() === hash)
      : logs;

    return {
      checked: true,
      found: matchingLogs.length > 0,
      logs: matchingLogs.map((log) => ({
        transactionHash: log.transactionHash,
        blockNumber: Number(log.blockNumber || 0) || null,
        index: Number(log.index || 0),
      })),
      reason: matchingLogs.length ? '' : 'root_anchored_event_not_found',
    };
  } catch (error) {
    return {
      checked: true,
      found: false,
      logs: [],
      reason: 'root_anchored_event_lookup_failed',
    };
  }
}

export async function verifyMerkleRootOnChain({
  merkleRoot,
  contractAddress,
  contractRecord = null,
  blockNumber = null,
  txHash = '',
} = {}) {
  let root = '';
  try {
    root = requireBytes32Root(merkleRoot);
  } catch (error) {
    return {
      verified: false,
      reason: error.message || 'invalid_merkle_root',
    };
  }

  const record = contractRecord || (await findContractByIdOrAddress(contractAddress));
  const address = cleanString(record?.address || contractAddress);

  if (!record || !address) {
    return {
      verified: false,
      reason: 'anchor_contract_missing',
      contractAddress: address,
    };
  }

  const capabilities = getCapabilitiesForContract(record);
  try {
    const provider = getProvider();
    const abi = getAbiForContract(record);

    if (!capabilities.canVerifyMerkleRoot || !capabilities.verifyFunctionName) {
      const txCheck = await verifyRootByTransaction({
        provider,
        abi,
        address,
        root,
        txHash,
        blockNumber,
        eventName: capabilities.rootAnchoredEventName,
        capabilities,
      });

      return {
        ...txCheck,
        contractType: record.contractType,
      };
    }

    const contract = new ethers.Contract(address, abi, provider);
    const rootVerified = await callVerifyFunction(contract, capabilities.verifyFunctionName, root);
    const eventCheck = rootVerified
      ? await findRootAnchoredLogs({
          contract,
          eventName: capabilities.rootAnchoredEventName,
          root,
          blockNumber,
          txHash,
        })
      : {
          checked: false,
          found: false,
          logs: [],
          reason: 'merkle_root_not_anchored_on_chain',
        };
    const verified = rootVerified;

    return {
      verified,
      rootVerified,
      eventVerified: eventCheck.found,
      eventCheck,
      reason: verified
        ? ''
        : 'merkle_root_not_anchored_on_chain',
      contractAddress: address,
      contractType: record.contractType,
      capabilities,
    };
  } catch (error) {
    return {
      verified: false,
      reason: 'chain_root_verification_failed',
      contractAddress: address,
      contractType: record.contractType,
      capabilities,
    };
  }
}

export async function anchorMerkleRoot({
  merkleRoot,
  contractRecord,
  batchId = '',
  actor = null,
} = {}) {
  const root = requireBytes32Root(merkleRoot);
  const record = contractRecord;
  const address = cleanString(record?.address);

  if (!record || !address) {
    throw new ApiError(409, 'No active contract selected.');
  }

  const capabilities = getCapabilitiesForContract(record);
  if (!capabilities.canAnchorMerkleRoot || !capabilities.anchorFunctionName) {
    throw new ApiError(409, 'Active contract does not support Merkle root anchoring.');
  }

  const provider = getProvider();
  const wallet = getWallet();
  const abi = getAbiForContract(record);
  const contract = new ethers.Contract(address, abi, wallet);
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId || record.chainId || env.blockchain.chainId);
  const anchorCall = buildAnchorFunctionCall({
    abi,
    functionName: capabilities.anchorFunctionName,
    root,
    batchId,
  });

  const tx = await contract[capabilities.anchorFunctionName](...anchorCall.args);
  const confirmations = Math.max(1, Number(env.blockchain.confirmations || 1));
  const receipt = await tx.wait(confirmations);

  if (Number(receipt?.status) !== 1) {
    throw new ApiError(500, 'Anchor transaction failed.');
  }

  if (capabilities.canVerifyMerkleRoot && capabilities.verifyFunctionName) {
    const anchored = await callVerifyFunction(contract, capabilities.verifyFunctionName, root);
    if (!anchored) {
      throw new ApiError(500, 'Anchor transaction succeeded, but the contract did not confirm the root.');
    }
  }

  const parsedEvent = findRootAnchoredEvent(
    contract,
    receipt,
    capabilities.rootAnchoredEventName,
    root
  );
  const timestamp = Number(parsedEvent?.args?.timestamp || 0);
  const anchoredAt =
    Number.isFinite(timestamp) && timestamp > 0
      ? new Date(timestamp * 1000)
      : new Date();

  return {
    anchorStatus: 'anchored',
    anchoredAt,
    anchoredBy: actor?._id || null,
    anchorTxHash: receipt.hash || receipt.transactionHash || tx.hash || '',
    anchorBlockNumber: Number(receipt.blockNumber || 0) || null,
    anchorBatchId: anchorCall.batchId || '',
    anchorContractAddress: address,
    contractAddress: address,
    anchorNetwork: record.network || network.name || '',
    anchorChainId: chainId,
    anchorExplorerUrl: buildExplorerTxUrl(chainId, receipt.hash || receipt.transactionHash || tx.hash),
    anchorEventName: parsedEvent?.name || capabilities.rootAnchoredEventName || '',
    anchorEventArgs: parsedEvent?.args || null,
    capabilities,
  };
}
