import app from './app.js';
import { connectDatabases } from './config/db.js';
import { env } from './config/env.js';

await connectDatabases();

app.listen(env.port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${env.port}`);
});
