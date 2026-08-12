import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isSupervisorIdentityValid,
  parseDotEnv,
  processMatchesSupervisor,
  runCommand,
  validateConfiguration,
  validateResetTarget,
} from './dev-environment.mjs';

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
  COURIER_CREDENTIALS_ENCRYPTION_KEY: 'development-courier-key-at-least-32-characters',
  SEED_ADMIN_EMAIL: 'admin@closetrent.local',
  SEED_ADMIN_PASSWORD: 'ClosetRent-Local-Admin-2026',
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
  assert.equal(isSupervisorIdentityValid({ ...identity, repositoryRoot: '/other' }, repositoryRoot), false);
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

test('unknown development workflow commands are rejected', async () => {
  const { operations } = workflowRecorder();

  await assert.rejects(
    runCommand('surprise', validEnvironment(), operations),
    /Unknown command "surprise"/,
  );
});
