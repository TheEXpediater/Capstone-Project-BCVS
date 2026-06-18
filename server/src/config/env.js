import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['true', '1', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase());
}

function cleanString(value, fallback = '') {
  const cleaned = String(value || '').trim();
  return cleaned || fallback;
}

const required = [
  'MONGO_URI_IDENTITY',
  'MONGO_URI_CREDENTIALS',
  'MONGO_URI_PLATFORM',
  'JWT_SECRET',
  'KEY_ENCRYPTION_SECRET',
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  webPort: Number(process.env.WEB_PORT || 5173),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  publicDomain: cleanString(process.env.PUBLIC_DOMAIN),
  domainApiBaseUrl: cleanString(process.env.DOMAIN_API_BASE_URL),
  domainWebBaseUrl: cleanString(process.env.DOMAIN_WEB_BASE_URL),
  webBaseUrl: cleanString(process.env.WEB_BASE_URL),
  verificationWebBaseUrl: cleanString(process.env.VERIFICATION_WEB_BASE_URL),
  preferredDeploymentMode: ['lan', 'domain'].includes(
    cleanString(process.env.PREFERRED_DEPLOYMENT_MODE, 'domain').toLowerCase()
  )
    ? cleanString(process.env.PREFERRED_DEPLOYMENT_MODE, 'domain').toLowerCase()
    : 'domain',
  discovery: {
    enabled: toBoolean(process.env.DISCOVERY_ENABLED, false),
    serviceName: cleanString(process.env.DISCOVERY_SERVICE_NAME, 'BCVS Registrar Server'),
    serviceType: cleanString(process.env.DISCOVERY_SERVICE_TYPE, 'bcvs-api'),
    serviceProtocol: cleanString(process.env.DISCOVERY_SERVICE_PROTOCOL, 'tcp'),
  },
  mongo: {
    identity: process.env.MONGO_URI_IDENTITY,
    credentials: process.env.MONGO_URI_CREDENTIALS,
    platform: process.env.MONGO_URI_PLATFORM,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),
  keyEncryptionSecret: process.env.KEY_ENCRYPTION_SECRET,
  issuerKeys: {
    algorithm: process.env.ISSUER_KEY_ALGORITHM || 'ES256',
    curve: process.env.ISSUER_KEY_CURVE || 'P-256',
  },
  blockchain: {
    rpcUrl: process.env.RPC_URL || '',
    contractOperatorPrivateKey: process.env.CONTRACT_OPERATOR_PRIVATE_KEY || '',
    chainId: Number(process.env.ANCHOR_CHAIN_ID || 80002),
    confirmations: Number(process.env.ANCHOR_CONFIRMATIONS || 2),
  },
};
