#!/usr/bin/env node

import { access, readFile, stat } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');
const ENV_FILE = path.join(REPOSITORY_ROOT, '.env');
const COMPOSE_FILE = path.join(REPOSITORY_ROOT, 'docker-compose.yml');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const REQUIRED_KEYS = [
  'NODE_ENV',
  'APP_PORT',
  'FRONTEND_PORT',
  'APP_URL',
  'API_URL',
  'CORS_ORIGINS',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_BASE_DOMAIN',
  'DATABASE_URL',
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_NAME',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'REDIS_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_DB',
  'STORAGE_ENDPOINT',
  'STORAGE_PORT',
  'STORAGE_CONSOLE_PORT',
  'STORAGE_ACCESS_KEY',
  'STORAGE_SECRET_KEY',
  'STORAGE_BUCKET',
  'STORAGE_PUBLIC_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'COURIER_CREDENTIALS_ENCRYPTION_KEY',
  'SEED_ADMIN_EMAIL',
  'SEED_ADMIN_PASSWORD',
];

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function parseDotEnv(contents) {
  const parsed = {};
  for (const sourceLine of contents.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      const quote = value[0];
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    parsed[match[1]] = value;
  }
  return parsed;
}

function asPort(value, key) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${key} must be an integer between 1 and 65535`);
  }
  return port;
}

function asUrl(value, key) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${key} must be a valid absolute URL`);
  }
}

export function validateConfiguration(environment) {
  const missing = REQUIRED_KEYS.filter((key) => !String(environment[key] ?? '').trim());
  if (missing.length)
    throw new Error(`Missing required local environment variables: ${missing.join(', ')}`);

  const appPort = asPort(environment.APP_PORT, 'APP_PORT');
  const frontendPort = asPort(environment.FRONTEND_PORT, 'FRONTEND_PORT');
  const databasePort = asPort(environment.DATABASE_PORT, 'DATABASE_PORT');
  asPort(environment.REDIS_PORT, 'REDIS_PORT');
  asPort(environment.STORAGE_PORT, 'STORAGE_PORT');
  asPort(environment.STORAGE_CONSOLE_PORT, 'STORAGE_CONSOLE_PORT');

  const database = asUrl(environment.DATABASE_URL, 'DATABASE_URL');
  if (!['postgres:', 'postgresql:'].includes(database.protocol)) {
    throw new Error('DATABASE_URL must use the postgresql protocol');
  }
  const databaseName = decodeURIComponent(database.pathname.replace(/^\//, ''));
  const databaseUser = decodeURIComponent(database.username);
  if (database.hostname !== environment.DATABASE_HOST) {
    throw new Error('DATABASE_HOST must match the hostname in DATABASE_URL');
  }
  if (Number(database.port || 5432) !== databasePort) {
    throw new Error('DATABASE_PORT must match the port in DATABASE_URL');
  }
  if (databaseName !== environment.DATABASE_NAME) {
    throw new Error('DATABASE_NAME must match the database in DATABASE_URL');
  }
  if (databaseUser !== environment.DATABASE_USER) {
    throw new Error('DATABASE_USER must match the username in DATABASE_URL');
  }

  const apiUrl = asUrl(environment.API_URL, 'API_URL');
  const publicApiUrl = asUrl(environment.NEXT_PUBLIC_API_URL, 'NEXT_PUBLIC_API_URL');
  if (!apiUrl.pathname.endsWith('/api/v1') || !publicApiUrl.pathname.endsWith('/api/v1')) {
    throw new Error('API_URL and NEXT_PUBLIC_API_URL must target the /api/v1 prefix');
  }
  asUrl(environment.APP_URL, 'APP_URL');
  asUrl(environment.REDIS_URL, 'REDIS_URL');
  asUrl(environment.STORAGE_ENDPOINT, 'STORAGE_ENDPOINT');
  asUrl(environment.STORAGE_PUBLIC_URL, 'STORAGE_PUBLIC_URL');

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'COURIER_CREDENTIALS_ENCRYPTION_KEY']) {
    if (String(environment[key]).length < 32)
      throw new Error(`${key} must contain at least 32 characters`);
  }

  return { appPort, frontendPort, database };
}

export function validateResetTarget(environment) {
  const { database } = validateConfiguration(environment);
  if (environment.NODE_ENV === 'production')
    throw new Error('Reset is disabled when NODE_ENV=production');
  if (!['localhost', '127.0.0.1', '::1'].includes(database.hostname)) {
    throw new Error('Reset is restricted to a local PostgreSQL host');
  }
  const databaseName = decodeURIComponent(database.pathname.replace(/^\//, ''));
  if (databaseName !== 'closetrent_dev') {
    throw new Error('Reset is restricted to the closetrent_dev database');
  }
  return true;
}

async function loadEnvironment() {
  let contents;
  try {
    contents = await readFile(ENV_FILE, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error('Missing .env. Copy .env.example to .env and review the development values.');
    }
    throw error;
  }
  return { ...parseDotEnv(contents), ...process.env };
}

function execute(command, args, { environment, quiet = false, allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: REPOSITORY_ROOT,
      env: environment,
      stdio: quiet ? 'ignore' : 'inherit',
      shell: false,
    });
    child.once('error', (error) => {
      if (allowFailure) resolve(false);
      else reject(new Error(`Could not run ${command}: ${error.message}`));
    });
    child.once('exit', (code, signal) => {
      if (code === 0) resolve(true);
      else if (allowFailure) resolve(false);
      else
        reject(
          new Error(
            `${command} ${args.join(' ')} failed${signal ? ` with ${signal}` : ` with exit code ${code}`}`,
          ),
        );
    });
  });
}

function composeArgs(...args) {
  return ['compose', '--project-directory', REPOSITORY_ROOT, '-f', COMPOSE_FILE, ...args];
}

function compose(environment, args, options = {}) {
  return execute('docker', composeArgs(...args), { environment, ...options });
}

async function ensurePrerequisites(environment) {
  await execute('docker', ['--version'], { environment, quiet: true });
  await execute('docker', ['compose', 'version'], { environment, quiet: true });
  await execute(NPM, ['--version'], { environment, quiet: true });
}

async function ensureDependencies(environment) {
  const installedLock = path.join(REPOSITORY_ROOT, 'node_modules', '.package-lock.json');
  const sourceLock = path.join(REPOSITORY_ROOT, 'package-lock.json');
  try {
    const [installed, source] = await Promise.all([stat(installedLock), stat(sourceLock)]);
    if (installed.mtimeMs >= source.mtimeMs) return;
  } catch {
    // A missing install marker means dependencies must be restored.
  }
  console.log('\nInstalling workspace dependencies...');
  await execute(NPM, ['install'], { environment });
}

async function waitForService(environment, name, checkArgs, attempts = 60) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await compose(environment, checkArgs, { quiet: true, allowFailure: true })) return;
    if (attempt % 5 === 0) console.log(`Waiting for ${name}... (${attempt}/${attempts})`);
    await sleep(1_000);
  }
  throw new Error(`${name} did not become ready within ${attempts} seconds`);
}

async function prepare(environment) {
  validateConfiguration(environment);
  await ensurePrerequisites(environment);
  await ensureDependencies(environment);

  console.log('\nStarting PostgreSQL, Redis, and MinIO...');
  await compose(environment, ['up', '-d', 'postgres', 'redis', 'minio']);
  await Promise.all([
    waitForService(environment, 'PostgreSQL', [
      'exec',
      '-T',
      'postgres',
      'pg_isready',
      '-U',
      environment.DATABASE_USER,
      '-d',
      environment.DATABASE_NAME,
    ]),
    waitForService(environment, 'Redis', ['exec', '-T', 'redis', 'redis-cli', 'ping']),
    waitForService(environment, 'MinIO', [
      'exec',
      '-T',
      'minio',
      'curl',
      '-fsS',
      'http://localhost:9000/minio/health/live',
    ]),
  ]);

  console.log('Ensuring the object-storage bucket exists...');
  await compose(environment, ['--profile', 'tools', 'run', '--rm', '-T', 'minio-init']);

  console.log('Generating Prisma Client and applying committed migrations...');
  await execute(NPM, ['run', 'db:generate'], { environment });
  await execute(NPM, ['run', 'db:migrate'], { environment });

  console.log('Applying idempotent platform seed data...');
  await execute(NPM, ['run', 'db:seed'], { environment });
  console.log('\nDevelopment infrastructure is ready.');
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(500);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function assertApplicationPortsAvailable(environment) {
  const { appPort, frontendPort } = validateConfiguration(environment);
  const conflicts = [];
  if (await isPortOpen(appPort)) conflicts.push(`backend port ${appPort}`);
  if (await isPortOpen(frontendPort)) conflicts.push(`frontend port ${frontendPort}`);
  if (conflicts.length) {
    throw new Error(
      `Cannot start because ${conflicts.join(' and ')} already ${conflicts.length === 1 ? 'is' : 'are'} in use`,
    );
  }
}

function terminateChild(child, signal = 'SIGTERM') {
  if (!child.pid || child.exitCode !== null) return;
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
}

async function startApplications(environment) {
  await assertApplicationPortsAvailable(environment);
  console.log(`\nStorefront and dashboard: ${environment.APP_URL}`);
  console.log(`API: ${environment.NEXT_PUBLIC_API_URL}`);
  console.log(
    'Press Ctrl+C to stop both application processes. Infrastructure will remain available.\n',
  );

  const children = [
    spawn(NPM, ['run', 'dev:backend'], {
      cwd: REPOSITORY_ROOT,
      env: environment,
      stdio: 'inherit',
      detached: process.platform !== 'win32',
      shell: false,
    }),
    spawn(NPM, ['run', 'dev:frontend'], {
      cwd: REPOSITORY_ROOT,
      env: environment,
      stdio: 'inherit',
      detached: process.platform !== 'win32',
      shell: false,
    }),
  ];

  const exits = children.map(
    (child) =>
      new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', (code, signal) => resolve({ code, signal }));
      }),
  );
  let resolveSignal;
  const interrupted = new Promise((resolve) => {
    resolveSignal = resolve;
  });
  const signalHandlers = new Map();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const handler = () => resolveSignal({ code: 0, signal });
    signalHandlers.set(signal, handler);
    process.once(signal, handler);
  }

  const result = await Promise.race([...exits, interrupted]);
  for (const child of children) terminateChild(child, result.signal || 'SIGTERM');
  await Promise.allSettled(exits);
  for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);
  if (!result.signal && result.code !== 0)
    throw new Error(`A development application exited with code ${result.code}`);
}

async function confirmReset() {
  if (process.argv.includes('--yes')) return true;
  if (!process.stdin.isTTY)
    throw new Error('Reset requires an interactive confirmation or the explicit --yes flag');
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(
    "Type RESET to delete this project's local PostgreSQL, Redis, and MinIO data: ",
  );
  prompt.close();
  return answer === 'RESET';
}

async function reset(environment) {
  validateResetTarget(environment);
  if (!(await confirmReset())) {
    console.log('Reset cancelled.');
    return;
  }
  await ensurePrerequisites(environment);
  const configured = await compose(environment, ['config', '--services'], {
    quiet: true,
    allowFailure: true,
  });
  if (!configured) throw new Error('The repository Compose configuration is invalid');
  console.log("\nDeleting only this repository's development containers and named volumes...");
  await compose(environment, ['down', '--volumes', '--remove-orphans']);
  await prepare(environment);
  console.log(
    '\nReset complete: database migrated and seeded, Redis empty, and storage bucket recreated.',
  );
}

async function status(environment) {
  const { appPort, frontendPort, database } = validateConfiguration(environment);
  await ensurePrerequisites(environment);
  console.log('Docker services:');
  await compose(environment, ['ps']);
  const [backendOpen, frontendOpen] = await Promise.all([
    isPortOpen(appPort),
    isPortOpen(frontendPort),
  ]);
  console.log(
    `\nBackend   ${backendOpen ? 'RUNNING' : 'STOPPED'}  http://localhost:${appPort}/api/v1`,
  );
  console.log(
    `Frontend  ${frontendOpen ? 'RUNNING' : 'STOPPED'}  http://localhost:${frontendPort}`,
  );
  console.log(`Database  ${database.hostname}:${database.port}/${environment.DATABASE_NAME}`);
}

function printConfigurationSummary(environment) {
  const { database } = validateConfiguration(environment);
  console.log('Environment contract is valid.');
  console.log(`Application: ${environment.APP_URL}`);
  console.log(`API: ${environment.NEXT_PUBLIC_API_URL}`);
  console.log(`Database: ${database.hostname}:${database.port}/${environment.DATABASE_NAME}`);
  console.log(`Redis: ${environment.REDIS_HOST}:${environment.REDIS_PORT}/${environment.REDIS_DB}`);
  console.log(`Storage: ${environment.STORAGE_ENDPOINT}/${environment.STORAGE_BUCKET}`);
}

async function main() {
  const command = process.argv[2] || 'start';
  const environment = await loadEnvironment();
  switch (command) {
    case 'check':
      printConfigurationSummary(environment);
      break;
    case 'prepare':
      await prepare(environment);
      break;
    case 'start':
      await prepare(environment);
      await startApplications(environment);
      break;
    case 'status':
      await status(environment);
      break;
    case 'stop':
      validateConfiguration(environment);
      await ensurePrerequisites(environment);
      await compose(environment, ['down', '--remove-orphans']);
      console.log('Development infrastructure stopped; named data volumes were preserved.');
      break;
    case 'reset':
      await reset(environment);
      break;
    default:
      throw new Error(
        `Unknown command "${command}". Use start, prepare, status, stop, reset, or check.`,
      );
  }
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectExecution) {
  main().catch((error) => {
    console.error(`\nDevelopment workflow failed: ${error.message}`);
    process.exitCode = 1;
  });
}
