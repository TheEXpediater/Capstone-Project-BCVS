import crypto from 'node:crypto';
import { ethers } from 'ethers';
import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { ApiError } from '../../shared/utils/ApiError.js';
import { getCredentialDraftModel } from '../credentials/model.js';
import { getMerkleAnchorModel } from '../anchors/model.js';
import { getBlockchainAccountModel } from './blockchainAccount.model.js';

const ALGORITHM = 'aes-256-gcm';

function cleanString(value, fallback = '') {
  const cleaned = String(value || '').trim();
  return cleaned || fallback;
}

function normalizePrivateKey(value) {
  const cleaned = cleanString(value);
  if (!cleaned) return '';

  const unquoted = cleaned.replace(/^['"]|['"]$/g, '');
  if (/^0X/.test(unquoted)) return `0x${unquoted.slice(2)}`;
  return /^[a-fA-F0-9]{64}$/.test(unquoted) ? `0x${unquoted}` : unquoted;
}

function assertDeveloper(actor, message = 'Only the MIS developer can manage blockchain accounts') {
  if (!actor || actor.role !== 'developer') {
    throw new ApiError(403, message);
  }
}

function getEncryptionKey() {
  return crypto.createHash('sha256').update(env.blockchain.keySecret).digest();
}

function encryptBlockchainPrivateKey(privateKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(privateKey, 'utf8'),
    cipher.final(),
  ]);

  return JSON.stringify({
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  });
}

function decryptBlockchainPrivateKey(encryptedPrivateKey) {
  let payload = null;

  try {
    payload = JSON.parse(encryptedPrivateKey);
  } catch {
    throw new ApiError(500, 'Stored blockchain account key is invalid.');
  }

  if (!payload?.ciphertext || !payload?.iv || !payload?.authTag) {
    throw new ApiError(500, 'Stored blockchain account key is incomplete.');
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(payload.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

function serializeAccount(account) {
  const raw = typeof account?.toObject === 'function' ? account.toObject() : account;

  return {
    id: String(raw?._id || raw?.id || ''),
    _id: raw?._id,
    name: raw?.name || '',
    address: raw?.address || '',
    isActive: Boolean(raw?.isActive),
    createdAt: raw?.createdAt || null,
    updatedAt: raw?.updatedAt || null,
  };
}

function makeAccountName(name, address) {
  const cleaned = cleanString(name);
  if (cleaned) return cleaned;
  return `Blockchain Account ${cleanString(address).slice(0, 10)}`;
}

function normalizeAccountId(accountId) {
  const normalized = cleanString(accountId);
  if (!Types.ObjectId.isValid(normalized)) {
    throw new ApiError(400, 'Invalid blockchain account id.');
  }
  return normalized;
}

export async function listBlockchainAccounts(actor) {
  assertDeveloper(actor);

  const BlockchainAccount = getBlockchainAccountModel();
  const accounts = await BlockchainAccount.find().sort({ isActive: -1, createdAt: -1 }).lean();
  const serialized = accounts.map(serializeAccount);

  return {
    accounts: serialized,
    activeAccount: serialized.find((item) => item.isActive) || null,
  };
}

export async function getActiveBlockchainAccount() {
  const BlockchainAccount = getBlockchainAccountModel();
  const account = await BlockchainAccount.findOne({ isActive: true }).select('+encryptedPrivateKey');

  if (!account) {
    throw new ApiError(409, 'No active blockchain account is configured in MIS Settings.');
  }

  return account;
}

export async function getActiveBlockchainWallet(provider) {
  const account = await getActiveBlockchainAccount();
  const privateKey = normalizePrivateKey(decryptBlockchainPrivateKey(account.encryptedPrivateKey));
  const wallet = new ethers.Wallet(privateKey, provider);

  if (wallet.address.toLowerCase() !== account.address.toLowerCase()) {
    throw new ApiError(500, 'Active blockchain account key does not match its stored address.');
  }

  return {
    wallet,
    account: serializeAccount(account),
  };
}

export async function createBlockchainAccount(payload = {}, actor = null) {
  assertDeveloper(actor);

  const privateKey = normalizePrivateKey(payload.privateKey);
  if (!privateKey) {
    throw new ApiError(400, 'Private key is required.');
  }

  let wallet = null;
  try {
    wallet = new ethers.Wallet(privateKey);
  } catch {
    throw new ApiError(400, 'Private key is invalid.');
  }

  const BlockchainAccount = getBlockchainAccountModel();
  const existing = await BlockchainAccount.findOne({ address: wallet.address }).lean();
  if (existing) {
    throw new ApiError(409, 'A blockchain account with this wallet address already exists.');
  }

  const activeAccount = await BlockchainAccount.findOne({ isActive: true }).lean();
  const shouldActivate = payload.isActive === true || !activeAccount;

  if (shouldActivate) {
    await BlockchainAccount.updateMany(
      { isActive: true },
      { $set: { isActive: false } }
    );
  }

  const account = await BlockchainAccount.create({
    name: makeAccountName(payload.name, wallet.address),
    address: wallet.address,
    encryptedPrivateKey: encryptBlockchainPrivateKey(privateKey),
    isActive: shouldActivate,
  });

  return serializeAccount(account);
}

export async function updateBlockchainAccount(accountId, payload = {}, actor = null) {
  assertDeveloper(actor);

  const BlockchainAccount = getBlockchainAccountModel();
  const account = await BlockchainAccount.findById(normalizeAccountId(accountId));

  if (!account) {
    throw new ApiError(404, 'Blockchain account not found.');
  }

  const name = cleanString(payload.name);
  if (!name) {
    throw new ApiError(400, 'Account name is required.');
  }

  account.name = name;
  await account.save();

  return serializeAccount(account);
}

export async function activateBlockchainAccount(accountId, actor = null) {
  assertDeveloper(actor);

  const BlockchainAccount = getBlockchainAccountModel();
  const account = await BlockchainAccount.findById(normalizeAccountId(accountId));

  if (!account) {
    throw new ApiError(404, 'Blockchain account not found.');
  }

  await BlockchainAccount.updateMany(
    { _id: { $ne: account._id }, isActive: true },
    { $set: { isActive: false } }
  );

  account.isActive = true;
  await account.save();

  return serializeAccount(account);
}

export async function getBlockchainAccountUsage(accountId) {
  const normalizedId = normalizeAccountId(accountId);
  const BlockchainAccount = getBlockchainAccountModel();
  const account = await BlockchainAccount.findById(normalizedId).lean();

  if (!account) {
    throw new ApiError(404, 'Blockchain account not found.');
  }

  const Anchor = getMerkleAnchorModel();
  const CredentialDraft = getCredentialDraftModel();
  const address = cleanString(account.address);

  const [anchorCount, credentialCount] = await Promise.all([
    Anchor.countDocuments({
      $or: [
        { blockchainAccountId: normalizedId },
        { blockchainAccountAddress: address },
      ],
      status: 'anchored',
    }),
    CredentialDraft.countDocuments({
      $or: [
        { anchorBlockchainAccountId: normalizedId },
        { anchorBlockchainAccountAddress: address },
        { 'anchoring.blockchainAccountId': normalizedId },
        { 'anchoring.blockchainAccountAddress': address },
      ],
      anchorStatus: 'anchored',
    }),
  ]);

  return {
    account: serializeAccount(account),
    anchoredCredentialsCount: Math.max(anchorCount, credentialCount),
  };
}

export async function deleteBlockchainAccount(accountId, actor = null) {
  assertDeveloper(actor);

  const BlockchainAccount = getBlockchainAccountModel();
  const account = await BlockchainAccount.findById(normalizeAccountId(accountId));

  if (!account) {
    throw new ApiError(404, 'Blockchain account not found.');
  }

  if (account.isActive) {
    throw new ApiError(409, 'Active blockchain accounts cannot be deleted.');
  }

  const usage = await getBlockchainAccountUsage(account._id);
  if (usage.anchoredCredentialsCount > 0) {
    throw new ApiError(
      409,
      'This blockchain account has anchored credentials and cannot be deleted.'
    );
  }

  await account.deleteOne();

  return {
    deleted: true,
    account: serializeAccount(account),
  };
}

export async function listAnchoredCredentialsForAccount(accountId, actor = null) {
  assertDeveloper(actor);

  const normalizedId = normalizeAccountId(accountId);
  const BlockchainAccount = getBlockchainAccountModel();
  const account = await BlockchainAccount.findById(normalizedId).lean();

  if (!account) {
    throw new ApiError(404, 'Blockchain account not found.');
  }

  const CredentialDraft = getCredentialDraftModel();
  const address = cleanString(account.address);
  const credentials = await CredentialDraft.find({
    $or: [
      { anchorBlockchainAccountId: normalizedId },
      { anchorBlockchainAccountAddress: address },
      { 'anchoring.blockchainAccountId': normalizedId },
      { 'anchoring.blockchainAccountAddress': address },
    ],
    anchorStatus: 'anchored',
  })
    .sort({ anchoredAt: -1, updatedAt: -1 })
    .limit(500)
    .lean();

  return {
    account: serializeAccount(account),
    credentials: credentials.map((credential) => ({
      id: String(credential._id),
      credentialId: String(credential._id),
      student: credential.studentName || credential.studentNo || '',
      vcType: credential.credentialType || '',
      transactionHash: credential.anchorTxHash || credential?.anchoring?.txHash || '',
      anchorDate: credential.anchoredAt || credential?.anchoring?.anchoredAt || null,
      status: credential.anchorStatus || credential?.anchoring?.status || credential.status || '',
    })),
  };
}
