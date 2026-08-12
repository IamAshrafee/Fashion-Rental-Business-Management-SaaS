# Double-Click Development Launchers Design

## Goal

Every common local-development operation must have one clearly named macOS launcher that can be run by double-clicking it. The user should not need to remember or type terminal commands.

## Launcher Set

The repository root will contain exactly these five macOS launchers:

### `start-dev.command`

The normal daily launcher. It validates the local environment, starts PostgreSQL, Redis, and MinIO when required, waits for them to become healthy, and starts the NestJS backend and Next.js frontend.

It must not install dependencies, generate Prisma Client, deploy migrations, seed the database, provision storage, reset data, or delete anything.

### `prepare-dev.command`

The deliberate setup and upgrade launcher. It installs dependencies when missing or outdated, starts infrastructure, creates the public and private storage buckets, generates Prisma Client, deploys committed migrations, and applies the idempotent platform seed. When preparation succeeds, it automatically starts the backend and frontend so the project is ready to use from this single double-click.

Use it for the first project setup and after dependency, Prisma schema, migration, seed, or storage-configuration changes.

### `reset-dev.command`

The guarded fresh-environment launcher. It confirms that the configured database is the local `closetrent_dev` database, asks the user to type `RESET`, removes only this repository's local Compose containers and named data volumes, recreates infrastructure, prepares storage, deploys migrations, seeds the platform, and then automatically starts the backend and frontend.

It must refuse production, remote database hosts, and any database other than `closetrent_dev`.

### `stop-dev.command`

The safe shutdown launcher. It stops the active development supervisor and its NestJS and Next.js child processes when they were started by one of these launchers, then stops this project's Docker infrastructure. PostgreSQL, Redis, and MinIO data volumes are preserved. It must not delete local data or terminate an unrelated process that happens to use the same port.

The orchestrator records its supervisor process ID while applications are running. Before sending a termination signal, `stop` verifies that the recorded process still belongs to this repository and development orchestrator. Stale records are removed safely. Closing or interrupting a long-running launcher also terminates its application children and removes the record.

### `status-dev.command`

The read-only diagnostics launcher. It shows the Docker service state, backend and frontend port state, and configured local database target. It does not start, stop, repair, prepare, seed, or reset anything.

## Shared Architecture

The `.command` files remain thin wrappers. All behavior stays in `scripts/dev-environment.mjs`, which receives one explicit command. This preserves one implementation for validation, health checks, process supervision, error messages, and safety rules.

The orchestrator will expose these behaviors:

- `start`: fast daily infrastructure and applications.
- `prepare`: full non-destructive preparation only, retained for command-line and automation use.
- `prepare-start`: full preparation followed by applications.
- `reset`: guarded reset only, retained for command-line and automation use.
- `reset-start`: guarded reset followed by applications.
- `stop`: stop infrastructure while preserving volumes.
- `status`: read-only status.
- `check`: read-only environment validation.

Keeping preparation/reset-only commands prevents package scripts and automation from unexpectedly becoming long-running foreground server processes. The macOS double-click launchers use the combined `prepare-start` and `reset-start` workflows.

## Cleanup and Naming

Obsolete duplicate platform launchers will be removed from the repository root. The existing `start-dev.sh`, `reset-dev.sh`, `start-dev.bat`, and `reset-dev.bat` files duplicate behavior and do not support the requested macOS double-click workflow, so they will be removed rather than maintained as legacy interfaces.

The five `.command` filenames are the only user-facing local launcher contract. Root `package.json` commands remain available for tooling and automation but are not required for normal local use.

## Terminal Behavior and Errors

Long-running launchers (`start-dev.command`, `prepare-dev.command`, and `reset-dev.command`) keep the Terminal window open while the applications run. Pressing Control+C stops the backend and frontend while Docker data remains available.

Short-running launchers (`stop-dev.command` and `status-dev.command`) display their result and wait for Enter before closing, so double-click users can read success messages or errors.

Every launcher resolves the repository from its own location. Failures print a direct next action. Destructive reset retains explicit typed confirmation.

## Documentation

A root-level `DEVELOPMENT-SCRIPTS.md` will explain the five launchers in plain language, with a short "Which one should I use?" table and examples for daily work, first setup, project upgrades, troubleshooting, shutdown, and deliberately starting fresh.

`README.md` and `macbook-setup-guide.md` will link to this guide and describe the double-click-first workflow without requiring terminal commands for routine use.

## Verification

Automated routing tests will prove:

- Daily start never routes through preparation or reset.
- Prepare-and-start performs preparation before starting applications.
- Reset-and-start performs reset before starting applications and does not start applications if reset is cancelled or fails.
- Status and stop remain isolated.
- Unknown commands fail clearly.

Shell syntax, executable permissions, Compose configuration, backend tests, and both application builds will be checked. CLI smoke tests will verify the daily launcher and the combined preparation launcher without browser or visual testing.
