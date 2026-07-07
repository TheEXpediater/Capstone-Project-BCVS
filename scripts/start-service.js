import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

async function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function readEnv(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return Object.fromEntries(
      raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const index = line.indexOf('=');
          return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
        })
    );
  } catch {
    return {};
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '0.0.0.0');
  });
}

function startChild(label, cwd, args, url) {
  console.log(`${label}:`);
  console.log(`Running on ${url}`);

  const command = process.platform === 'win32' ? [npmCmd, ...args].join(' ') : npmCmd;
  const commandArgs = process.platform === 'win32' ? [] : args;
  const child = spawn(command, commandArgs, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  let shuttingDown = false;

  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    child.kill(signal);
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  child.on('exit', (code, signal) => {
    process.exit(code ?? (signal ? 0 : 0));
  });
}

async function getServiceConfig(service) {
  const systemConfig = await readJson(path.join(rootDir, 'system.json'));
  const serverEnv = await readEnv(path.join(rootDir, 'server', '.env'));

  if (service === 'backend' || service === 'server') {
    return {
      label: 'Backend',
      cwd: path.join(rootDir, 'server'),
      args: ['run', 'dev'],
      port: Number(serverEnv.PORT || systemConfig.ports?.backend || 5000),
    };
  }

  if (service === 'frontend' || service === 'client') {
    const port = Number(systemConfig.ports?.frontend || 5173);

    return {
      label: 'Frontend',
      cwd: path.join(rootDir, 'client'),
      args: ['run', 'dev', '--', '--host', '0.0.0.0', '--port', String(port)],
      port,
    };
  }

  throw new Error(`Unknown service "${service}". Use "backend" or "frontend".`);
}

async function main() {
  const service = process.argv[2];
  const config = await getServiceConfig(service);
  const url = `http://localhost:${config.port}`;

  if (!(await isPortFree(config.port))) {
    console.log(`[!] ${config.label} port conflict`);
    console.log(`    Port ${config.port} is already in use. Assuming ${config.label.toLowerCase()} is already running.`);
    console.log(`${config.label}: ${url}`);
    return;
  }

  startChild(config.label, config.cwd, config.args, url);
}

main().catch((error) => {
  console.error(`[x] ${error.message || error}`);
  process.exitCode = 1;
});
