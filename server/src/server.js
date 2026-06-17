import app from './app.js';
import { connectDatabases } from './config/db.js';
import { env } from './config/env.js';
import {
  startDiscoveryAdvertisement,
  stopDiscoveryAdvertisement,
} from './shared/services/discoveryAdvertiser.js';

await connectDatabases();

const server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${env.port}`);
  startDiscoveryAdvertisement();
});

function shutdown(signal) {
  console.log(`${signal} received. Shutting down BCVS API...`);
  stopDiscoveryAdvertisement();
  server.close(() => {
    process.exit(0);
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
