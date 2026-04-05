import crypto from 'node:crypto';
import { env } from '../../config/env.js';

const ALGORITHM = 'aes-256-gcm';

function getMasterKey() {
  return crypto.createHash('sha256').update(env.keyEncryptionSecret).digest();
}

export function encryptPrivateKey(privateKeyPem) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(privateKeyPem, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decryptPrivateKey({ ciphertext, iv, authTag }) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getMasterKey(),
    Buffer.from(iv, 'base64')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export function buildPublicKeyFingerprint(publicKeyPem) {
  return crypto.createHash('sha256').update(publicKeyPem).digest('hex');
}

export function buildIssuerKid(publicKeyPem) {
  const fingerprint = buildPublicKeyFingerprint(publicKeyPem).slice(0, 16);
  return `issuer-${fingerprint}-${Date.now()}`;
}