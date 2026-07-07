import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');

dotenv.config({
  path: path.join(serverRoot, '.env'),
  quiet: true,
});

const environment = String(process.env.NODE_ENV || 'development').trim().toLowerCase();
const connections = [];

const affectedCollections = [
  'Users / Accounts',
  'Students',
  'Student Records',
  'Curriculum',
  'Programs',
  'Credentials',
  'Verifiable Credentials',
  'Blockchain Anchoring Records',
  'Verification Records',
  'Transactions',
  'Audit Logs',
];

const targetCollections = new Set([
  'accounts',
  'users',
  'roles',
  'sessions',
  'students',
  'studentRecords',
  'student_records',
  'student_grades',
  'curriculum',
  'curricula',
  'programs',
  'credentials',
  'credential_drafts',
  'verifiableCredentials',
  'verifiable_credentials',
  'blockchainTransactions',
  'blockchain_transactions',
  'anchorRecords',
  'anchor_records',
  'merkle_anchors',
  'verificationLogs',
  'verification_logs',
  'verification_sessions',
  'verification_submissions',
  'transactions',
  'auditLogs',
  'audit_logs',
  'uploads',
  'system_settings',
  'admin_permissions',
  'issuer_keys',
  'blockchain_accounts',
  'contracts',
  'push_tokens',
  'notifications',
]);

const generatedArtifactDirs = [
  'generated',
  'profile-images',
  'credentials',
  'credential-files',
  'credential_files',
  'pdf',
  'pdfs',
  'qr',
  'qrs',
  'qr-codes',
  'qrcodes',
  'vc',
  'vcs',
  'verifiable-credentials',
  'verifiable_credentials',
  'temp',
  'tmp',
];

function getMongoTargets() {
  const namedTargets = [
    ['identity', process.env.MONGO_URI_IDENTITY],
    ['credentials', process.env.MONGO_URI_CREDENTIALS],
    ['platform', process.env.MONGO_URI_PLATFORM],
  ].filter(([, uri]) => Boolean(uri));

  if (namedTargets.length > 0) {
    return namedTargets;
  }

  if (process.env.MONGO_URI) {
    return [['default', process.env.MONGO_URI]];
  }

  throw new Error('Missing MongoDB connection string. Set MONGO_URI or the BCVS MONGO_URI_* variables.');
}

async function askForConfirmation() {
  const rl = readline.createInterface({ input, output });

  try {
    console.log('WARNING:');
    console.log('This will permanently delete all BCVS data.');
    console.log('');
    console.log('Affected collections:');
    for (const label of affectedCollections) {
      console.log(`- ${label}`);
    }
    console.log('');

    const answer = await rl.question('Continue? (yes/no) ');
    return answer.trim().toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

async function connectMongoTargets() {
  for (const [label, uri] of getMongoTargets()) {
    const connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 }).asPromise();
    connections.push(connection);
    console.log(`[ok] Connected to ${label} database (${connection.name})`);
  }

  return connections;
}

async function clearCollections(connection) {
  const collections = await connection.db.listCollections({}, { nameOnly: true }).toArray();
  const matchingCollections = collections
    .map((collection) => collection.name)
    .filter((name) => targetCollections.has(name))
    .sort((left, right) => left.localeCompare(right));

  let deletedCount = 0;

  for (const collectionName of matchingCollections) {
    const result = await connection.db.collection(collectionName).deleteMany({});
    deletedCount += result.deletedCount || 0;
    console.log(`[ok] ${connection.name}.${collectionName}: deleted ${result.deletedCount || 0}`);
  }

  return {
    collectionCount: matchingCollections.length,
    deletedCount,
  };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function clearDirectoryContents(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  let removed = 0;

  for (const entry of entries) {
    if (entry.name === '.gitkeep') continue;

    await fs.rm(path.join(dirPath, entry.name), { recursive: true, force: true });
    removed += 1;
  }

  return removed;
}

function isGeneratedArtifact(fileName) {
  const lowerName = fileName.toLowerCase();

  return (
    lowerName.endsWith('.pdf') ||
    lowerName.endsWith('.vc.json') ||
    lowerName.endsWith('.credential.json') ||
    lowerName.endsWith('.credentials.json') ||
    lowerName.endsWith('.tmp') ||
    lowerName.endsWith('.temp') ||
    lowerName.endsWith('.qr.png') ||
    lowerName.endsWith('.qr.svg') ||
    /^qr[-_].*\.(png|svg|jpg|jpeg)$/i.test(fileName) ||
    /^qrcode[-_].*\.(png|svg|jpg|jpeg)$/i.test(fileName) ||
    /^vc[-_].*\.json$/i.test(fileName) ||
    /^credential[-_].*\.json$/i.test(fileName)
  );
}

async function removeGeneratedFilesRecursively(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  let removed = 0;

  for (const entry of entries) {
    if (entry.name === '.gitkeep') continue;

    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      removed += await removeGeneratedFilesRecursively(entryPath);
    } else if (entry.isFile() && isGeneratedArtifact(entry.name)) {
      await fs.rm(entryPath, { force: true });
      removed += 1;
    }
  }

  return removed;
}

async function clearGeneratedArtifacts() {
  const uploadsRoot = path.join(serverRoot, 'uploads');
  let removedEntries = 0;

  if (!(await pathExists(uploadsRoot))) {
    return removedEntries;
  }

  for (const dirName of generatedArtifactDirs) {
    const artifactDir = path.join(uploadsRoot, dirName);

    if (await pathExists(artifactDir)) {
      removedEntries += await clearDirectoryContents(artifactDir);
    }
  }

  removedEntries += await removeGeneratedFilesRecursively(uploadsRoot);
  return removedEntries;
}

async function closeConnections() {
  await Promise.all(connections.map((connection) => connection.close().catch(() => null)));
}

async function flushAllData() {
  if (environment === 'production') {
    console.error('Flush operation disabled in production environment.');
    process.exitCode = 1;
    return;
  }

  if (!(await askForConfirmation())) {
    console.log('Flush cancelled.');
    process.exitCode = 1;
    return;
  }

  let totalCollections = 0;
  let totalDocuments = 0;

  try {
    await connectMongoTargets();

    for (const connection of connections) {
      const result = await clearCollections(connection);
      totalCollections += result.collectionCount;
      totalDocuments += result.deletedCount;
    }

    const removedArtifacts = await clearGeneratedArtifacts();

    console.log('');
    console.log(`BCVS data flush completed. Cleared ${totalDocuments} documents from ${totalCollections} collections.`);
    console.log(`Generated file entries removed: ${removedArtifacts}`);
  } finally {
    await closeConnections();
  }
}

flushAllData().catch(async (error) => {
  console.error(`[x] ${error.message || error}`);
  await closeConnections();
  process.exitCode = 1;
});
