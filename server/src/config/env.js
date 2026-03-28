import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always load server/.env no matter where node is executed from
dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});

const required = [
  'MONGO_URI_IDENTITY',
  'MONGO_URI_CREDENTIALS',
  'MONGO_URI_PLATFORM',
  'JWT_SECRET',
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
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
  keys: {
    vcIssuerPrivateKey: process.env.VC_ISSUER_PRIVATE_KEY || '',
    vcIssuerAddress: process.env.VC_ISSUER_ADDRESS || '',
    contractOperatorPrivateKey: process.env.CONTRACT_OPERATOR_PRIVATE_KEY || '',
    contractOperatorAddress: process.env.CONTRACT_OPERATOR_ADDRESS || '',
  },
};