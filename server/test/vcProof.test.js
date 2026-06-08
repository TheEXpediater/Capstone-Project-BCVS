import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  buildMerkleLeaf,
  buildMerkleProof,
  buildMerkleTree,
  canonicalizeCredential,
  computeVcHash,
  signVcPayload,
  verifyMerkleProof,
  verifyVcSignature,
} from '../src/shared/utils/vcProof.js';

function keyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });

  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
  };
}

test('canonical credential hash is stable across key order', () => {
  const a = {
    type: ['VerifiableCredential', 'TranscriptOfRecordsCredential'],
    credentialSubject: {
      studentNo: '2020-0001',
      studentName: 'Ada Lovelace',
    },
  };
  const b = {
    credentialSubject: {
      studentName: 'Ada Lovelace',
      studentNo: '2020-0001',
    },
    type: ['VerifiableCredential', 'TranscriptOfRecordsCredential'],
  };

  assert.equal(canonicalizeCredential(a), canonicalizeCredential(b));
  assert.equal(computeVcHash(a), computeVcHash(b));
});

test('issuer signature verifies against the canonical VC payload', () => {
  const keys = keyPair();
  const vc = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: 'urn:test:credential:1',
    type: ['VerifiableCredential', 'DiplomaCredential'],
    issuer: { id: 'did:bcvs:test', name: 'BCVS Registrar' },
    issuanceDate: '2026-01-01T00:00:00.000Z',
    credentialType: 'diploma',
    credentialSubject: {
      id: 'urn:test:student:1',
      studentNo: '2020-0001',
      studentName: 'Ada Lovelace',
    },
  };

  const signed = signVcPayload(
    vc,
    {
      _id: 'issuer-key-1',
      kid: 'did:bcvs:test#issuer-key-1',
      publicKeyPem: keys.publicKeyPem,
      algorithm: 'ES256',
    },
    keys.privateKeyPem,
    { issuedAt: new Date('2026-01-01T00:00:00.000Z') }
  );

  assert.equal(verifyVcSignature(signed.signedCredential, keys.publicKeyPem).valid, true);
  assert.equal(signed.vcHash, computeVcHash(signed.signedCredential));
});

test('sorted-pair Merkle proof verifies for a credential leaf', () => {
  const hashes = [
    computeVcHash({ id: 'urn:test:1', credentialSubject: { studentNo: '1' } }),
    computeVcHash({ id: 'urn:test:2', credentialSubject: { studentNo: '2' } }),
    computeVcHash({ id: 'urn:test:3', credentialSubject: { studentNo: '3' } }),
  ];
  const leaves = hashes.map(buildMerkleLeaf);
  const tree = buildMerkleTree(leaves);
  const proof = buildMerkleProof(leaves, 1);

  assert.equal(verifyMerkleProof({ leaf: leaves[1], proof, root: tree.root }), true);
  assert.equal(verifyMerkleProof({ leaf: leaves[0], proof, root: tree.root }), false);
});
