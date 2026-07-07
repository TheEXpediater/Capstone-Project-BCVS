import path from 'node:path';
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

const connections = [];

function resolveUri(name, fallback = process.env.MONGO_URI) {
  const value = process.env[name] || fallback;

  if (!value) {
    throw new Error(`Missing MongoDB connection string: ${name}`);
  }

  return value;
}

async function connect(label, uri) {
  const connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 }).asPromise();
  connections.push(connection);
  return [label, connection];
}

async function countFromCollections(connection, collectionNames, filter = {}) {
  const existingCollections = new Set(
    (await connection.db.listCollections({}, { nameOnly: true }).toArray()).map((collection) => collection.name)
  );

  let total = 0;

  for (const collectionName of collectionNames) {
    if (!existingCollections.has(collectionName)) continue;

    total += await connection.db.collection(collectionName).countDocuments(filter);
  }

  return total;
}

function report(label, passed) {
  console.log(`${passed ? '[ok]' : '[x]'} ${label}`);
}

async function closeConnections() {
  await Promise.all(connections.map((connection) => connection.close().catch(() => null)));
}

async function verifySeededData() {
  const [, identityConnection] = await connect('identity', resolveUri('MONGO_URI_IDENTITY'));
  const [, platformConnection] = await connect('platform', resolveUri('MONGO_URI_PLATFORM'));

  const adminCount = await countFromCollections(identityConnection, ['users', 'accounts'], {
    kind: 'web',
    role: { $in: ['super_admin', 'admin', 'developer', 'cashier'] },
  });
  const curriculumCount = await countFromCollections(platformConnection, ['curricula', 'curriculum']);
  const studentCount = await countFromCollections(platformConnection, ['students']);

  console.log('BCVS seed verification');

  report('Admin account exists', adminCount > 0);
  report('Curriculum exists', curriculumCount > 0);
  report('Students exist', studentCount > 0);

  if (adminCount === 0 || curriculumCount === 0 || studentCount === 0) {
    process.exitCode = 1;
  }
}

verifySeededData()
  .catch((error) => {
    console.error(`[x] ${error.message || error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeConnections();
  });
