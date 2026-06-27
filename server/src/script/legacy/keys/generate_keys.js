import { connectDatabases } from '../../config/db.js';
import { env } from '../../config/env.js';
import { getIssuerKeyModel } from '../../modules/settings/issuerKey.model.js';
import {
  buildIssuerKid,
  buildPublicKeyFingerprint,
  encryptPrivateKey,
} from '../../shared/utils/keyVault.js';
import { generateKeyPairSync } from 'node:crypto';

function getArg(flag, fallback = '') {
  const index = process.argv.findIndex((item) => item === flag);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function makeName(rawName) {
  const cleaned = typeof rawName === 'string' ? rawName.trim() : '';
  if (cleaned) return cleaned;
  return `Issuer Key ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`;
}

const name = makeName(getArg('--name'));
const rotationReason = getArg('--reason', '');
const activate = hasFlag('--activate');

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: env.issuerKeys.curve,
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
});

await connectDatabases();

const IssuerKey = getIssuerKeyModel();
const encrypted = encryptPrivateKey(privateKey);

if (activate) {
  await IssuerKey.updateMany(
    { isActive: true },
    {
      $set: {
        isActive: false,
        status: 'inactive',
      },
    }
  );
}

const keyDoc = await IssuerKey.create({
  name,
  kid: buildIssuerKid(publicKey),
  fingerprint: buildPublicKeyFingerprint(publicKey),
  algorithm: env.issuerKeys.algorithm,
  curve: env.issuerKeys.curve,
  publicKeyPem: publicKey,
  privateKeyCiphertext: encrypted.ciphertext,
  privateKeyIv: encrypted.iv,
  privateKeyAuthTag: encrypted.authTag,
  status: activate ? 'active' : 'inactive',
  isActive: activate,
  rotationReason,
  activatedAt: activate ? new Date() : null,
});

console.log('Issuer key created successfully');
console.log(
  JSON.stringify(
    {
      id: keyDoc._id,
      name: keyDoc.name,
      kid: keyDoc.kid,
      status: keyDoc.status,
      isActive: keyDoc.isActive,
      createdAt: keyDoc.createdAt,
    },
    null,
    2
  )
);

process.exit(0);