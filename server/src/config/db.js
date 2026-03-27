import mongoose from 'mongoose';
import { env } from './env.js';

let identityConnection;
let credentialsConnection;
let platformConnection;

export async function connectDatabases() {
  if (identityConnection && credentialsConnection && platformConnection) {
    return {
      identityConnection,
      credentialsConnection,
      platformConnection,
    };
  }

  identityConnection = await mongoose.createConnection(env.mongo.identity).asPromise();
  credentialsConnection = await mongoose.createConnection(env.mongo.credentials).asPromise();
  platformConnection = await mongoose.createConnection(env.mongo.platform).asPromise();

  console.log('Mongo connected:', {
    identity: identityConnection.name,
    credentials: credentialsConnection.name,
    platform: platformConnection.name,
  });

  return {
    identityConnection,
    credentialsConnection,
    platformConnection,
  };
}

export function getIdentityConnection() {
  if (!identityConnection) {
    throw new Error('Identity DB connection is not initialized');
  }
  return identityConnection;
}

export function getCredentialsConnection() {
  if (!credentialsConnection) {
    throw new Error('Credentials DB connection is not initialized');
  }
  return credentialsConnection;
}

export function getPlatformConnection() {
  if (!platformConnection) {
    throw new Error('Platform DB connection is not initialized');
  }
  return platformConnection;
}
