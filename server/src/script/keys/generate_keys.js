import fs from 'node:fs';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
});

fs.writeFileSync(path.join(__dirname, 'issuer-priv-pkcs8.pem'), privateKey);
fs.writeFileSync(path.join(__dirname, 'issuer-pub-spki.pem'), publicKey);

console.log('Keys generated successfully');
console.log('Private:', path.join(__dirname, 'issuer-priv-pkcs8.pem'));
console.log('Public :', path.join(__dirname, 'issuer-pub-spki.pem'));