import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  isSupervisorIdentityValid,
  isVerifiedRepositoryApplicationGroup,
  npmInvocation,
  parseDotEnv,
  processMatchesSupervisor,
  runCommand,
  validateConfiguration,
  validateResetTarget,
} from './dev-environment.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const validEnvironment = () => ({
  NODE_ENV: 'development',
  APP_PORT: '4000',
  FRONTEND_PORT: '3000',
  APP_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:4000/api/v1',
  CORS_ORIGINS: 'http://localhost:3000',
  NEXT_PUBLIC_API_URL: 'http://localhost:4000/api/v1',
  NEXT_PUBLIC_BASE_DOMAIN: 'localhost',
  DATABASE_URL: 'postgresql://closetrent:dev_password@localhost:5433/closetrent_dev',
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '5433',
  DATABASE_NAME: 'closetrent_dev',
  DATABASE_USER: 'closetrent',
  DATABASE_PASSWORD: 'dev_password',
  REDIS_URL: 'redis://localhost:6379',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  REDIS_DB: '0',
  STORAGE_ENDPOINT: 'http://localhost:9000',
  STORAGE_PORT: '9000',
  STORAGE_CONSOLE_PORT: '9001',
  STORAGE_ACCESS_KEY: 'minioadmin',
  STORAGE_SECRET_KEY: 'minioadmin',
  STORAGE_BUCKET: 'closetrent-dev',
  STORAGE_PUBLIC_URL: 'http://localhost:9000/closetrent-dev',
  JWT_SECRET: 'development-jwt-secret-at-least-32-characters',
  JWT_REFRESH_SECRET: 'development-refresh-secret-at-least-32-characters',
  CREDENTIALS_ENCRYPTION_KEY: 'development-provider-key-at-least-32-characters',
  SEED_ADMIN_EMAIL: 'admin@closetrent.local',
  SEED_ADMIN_PASSWORD: 'ClosetRent-Local-Admin-2026',
});

test('npmInvocation bypasses npm.cmd on Windows', () => {
  assert.deepEqual(
    npmInvocation(['--version'], {
      platform: 'win32',
      nodeExecutable: 'C:\\Program Files\\nodejs\\node.exe',
    }),
    {
      command: 'C:\\Program Files\\nodejs\\node.exe',
      args: ['C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js', '--version'],
    },
  );
});

test('npmInvocation keeps the native npm executable on non-Windows platforms', () => {
  assert.deepEqual(npmInvocation(['run', 'dev:backend'], { platform: 'darwin' }), {
    command: 'npm',
    args: ['run', 'dev:backend'],
  });
});

test('parseDotEnv supports comments, empty values, quotes, and export syntax', () => {
  assert.deepEqual(
    parseDotEnv('A=one\nB="two words"\nC=three # note\nD=\nexport E=\'five\'\n# ignored'),
    { A: 'one', B: 'two words', C: 'three', D: '', E: 'five' },
  );
});

test('validateConfiguration accepts the canonical local contract', () => {
  const result = validateConfiguration(validEnvironment());
  assert.equal(result.appPort, 4000);
  assert.equal(result.database.port, '5433');
});

test('validateConfiguration rejects drift between DATABASE_URL and scalar settings', () => {
  const environment = validEnvironment();
  environment.DATABASE_PORT = '5432';
  assert.throws(() => validateConfiguration(environment), /DATABASE_PORT must match/);
});

test('validateConfiguration rejects the obsolete API prefix', () => {
  const environment = validEnvironment();
  environment.API_URL = 'http://localhost:4000/api';
  assert.throws(() => validateConfiguration(environment), /must target the \/api\/v1 prefix/);
});

test('validateConfiguration accepts the legacy courier credentials key alias', () => {
  const environment = validEnvironment();
  environment.COURIER_CREDENTIALS_ENCRYPTION_KEY = environment.CREDENTIALS_ENCRYPTION_KEY;
  delete environment.CREDENTIALS_ENCRYPTION_KEY;

  assert.doesNotThrow(() => validateConfiguration(environment));
});

test('validateResetTarget accepts only the dedicated local development database', () => {
  assert.equal(validateResetTarget(validEnvironment()), true);

  const production = validEnvironment();
  production.NODE_ENV = 'production';
  assert.throws(() => validateResetTarget(production), /disabled.*production/);

  const remote = validEnvironment();
  remote.DATABASE_URL = 'postgresql://closetrent:dev_password@db.example.com:5433/closetrent_dev';
  remote.DATABASE_HOST = 'db.example.com';
  assert.throws(() => validateResetTarget(remote), /local PostgreSQL host/);

  const wrongDatabase = validEnvironment();
  wrongDatabase.DATABASE_URL = 'postgresql://closetrent:dev_password@localhost:5433/production';
  wrongDatabase.DATABASE_NAME = 'production';
  assert.throws(() => validateResetTarget(wrongDatabase), /closetrent_dev database/);
});

function workflowRecorder() {
  const calls = [];
  const operations = Object.fromEntries(
    ['check', 'prepare', 'startDaily', 'startApplications', 'status', 'stop', 'reset'].map(
      (name) => [
        name,
        async () => {
          calls.push(name);
          return name === 'reset';
        },
      ],
    ),
  );
  return { calls, operations };
}

test('start uses the non-mutating daily path before starting applications', async () => {
  const { calls, operations } = workflowRecorder();

  await runCommand('start', validEnvironment(), operations);

  assert.deepEqual(calls, ['startDaily', 'startApplications']);
  assert.equal(calls.includes('prepare'), false);
});

test('prepare remains an explicit standalone workflow', async () => {
  const { calls, operations } = workflowRecorder();

  await runCommand('prepare', validEnvironment(), operations);

  assert.deepEqual(calls, ['prepare']);
});

test('prepare-start prepares before starting applications', async () => {
  const { calls, operations } = workflowRecorder();

  await runCommand('prepare-start', validEnvironment(), operations);

  assert.deepEqual(calls, ['prepare', 'startApplications']);
});

test('reset-start starts applications only after a completed reset', async () => {
  const { calls, operations } = workflowRecorder();

  await runCommand('reset-start', validEnvironment(), operations);

  assert.deepEqual(calls, ['reset', 'startApplications']);

  calls.length = 0;
  operations.reset = async () => {
    calls.push('reset');
    return false;
  };

  await runCommand('reset-start', validEnvironment(), operations);

  assert.deepEqual(calls, ['reset']);
});

test('stop and status remain isolated workflows', async () => {
  for (const command of ['stop', 'status']) {
    const { calls, operations } = workflowRecorder();
    await runCommand(command, validEnvironment(), operations);
    assert.deepEqual(calls, [command]);
  }
});

test('supervisor validation requires this repository and orchestrator identity', () => {
  const repositoryRoot = '/workspace/closetrent';
  const identity = {
    pid: 123,
    repositoryRoot,
    command: 'scripts/dev-environment.mjs',
  };

  assert.equal(isSupervisorIdentityValid(identity, repositoryRoot), true);
  assert.equal(isSupervisorIdentityValid({ ...identity, pid: -1 }, repositoryRoot), false);
  assert.equal(
    isSupervisorIdentityValid({ ...identity, repositoryRoot: '/other' }, repositoryRoot),
    false,
  );
  assert.equal(
    processMatchesSupervisor(identity, {
      command: 'node scripts/dev-environment.mjs start',
      workingDirectory: repositoryRoot,
    }),
    true,
  );
  assert.equal(
    processMatchesSupervisor(identity, {
      command: 'node unrelated.mjs',
      workingDirectory: repositoryRoot,
    }),
    false,
  );
});

test('stale application cleanup accepts only the expected repository process group', () => {
  const repositoryRoot = path.join(path.parse(process.cwd()).root, 'workspace', 'closetrent');
  const frontendListener = {
    pid: 104,
    parentPid: 103,
    processGroupId: 101,
    command: 'next-server (v14.2.35)',
    workingDirectory: path.join(repositoryRoot, 'apps', 'frontend'),
  };
  const frontendLeader = {
    pid: 101,
    parentPid: 1,
    processGroupId: 101,
    command: 'npm run dev:frontend',
    workingDirectory: repositoryRoot,
  };

  assert.equal(
    isVerifiedRepositoryApplicationGroup(
      frontendListener,
      frontendLeader,
      'frontend',
      repositoryRoot,
    ),
    true,
  );
  assert.equal(
    isVerifiedRepositoryApplicationGroup(
      { ...frontendListener, workingDirectory: '/unrelated/project' },
      frontendLeader,
      'frontend',
      repositoryRoot,
    ),
    false,
  );
  assert.equal(
    isVerifiedRepositoryApplicationGroup(
      frontendListener,
      { ...frontendLeader, command: 'python unrelated-server.py' },
      'frontend',
      repositoryRoot,
    ),
    false,
  );
  assert.equal(
    isVerifiedRepositoryApplicationGroup(
      frontendListener,
      frontendLeader,
      'backend',
      repositoryRoot,
    ),
    false,
  );
});

test('unknown development workflow commands are rejected', async () => {
  const { operations } = workflowRecorder();

  await assert.rejects(
    runCommand('surprise', validEnvironment(), operations),
    /Unknown command "surprise"/,
  );
});

test('Windows launchers delegate to the intended orchestrator workflows', async () => {
  const launchers = {
    'start-dev.cmd': 'start',
    'prepare-dev.cmd': 'prepare-start',
    'reset-dev.cmd': 'reset-start',
    'stop-dev.cmd': 'stop',
    'status-dev.cmd': 'status',
  };

  for (const [filename, command] of Object.entries(launchers)) {
    const source = await readFile(path.join(repositoryRoot, filename), 'utf8');

    assert.match(source, /cd \/d "%~dp0"/i, `${filename} must use its own directory`);
    assert.match(
      source,
      new RegExp(`node scripts\\\\dev-environment\\.mjs ${command} %\\*`, 'i'),
      `${filename} must delegate to ${command} and forward arguments`,
    );
    assert.match(source, /exit \/b /i, `${filename} must propagate an exit code`);
  }
});

test('long-running Windows launchers pause only on failure and preserve the exit code', async () => {
  for (const filename of ['start-dev.cmd', 'prepare-dev.cmd', 'reset-dev.cmd']) {
    const source = await readFile(path.join(repositoryRoot, filename), 'utf8');

    assert.match(
      source,
      /set "result=%errorlevel%"/i,
      `${filename} must preserve the Node exit code`,
    );
    assert.match(source, /if "%result%"=="0" exit \/b 0/i, `${filename} must not pause on success`);
    assert.match(source, /CLOSERENT_NO_PAUSE/i, `${filename} must support non-interactive use`);
    assert.match(source, /\bpause\b/i, `${filename} must keep failures visible`);
    assert.match(
      source,
      /exit \/b %result%/i,
      `${filename} must return the preserved failure code`,
    );
  }
});

test('short-running Windows launchers always keep interactive output visible', async () => {
  for (const filename of ['stop-dev.cmd', 'status-dev.cmd']) {
    const source = await readFile(path.join(repositoryRoot, filename), 'utf8');
    assert.match(
      source,
      /set "result=%errorlevel%"/i,
      `${filename} must preserve the Node exit code`,
    );
    assert.match(source, /CLOSERENT_NO_PAUSE/i, `${filename} must support non-interactive use`);
    assert.match(source, /\bpause\b/i, `${filename} must keep double-click output visible`);
    assert.match(source, /exit \/b %result%/i, `${filename} must return the preserved exit code`);
  }
});
