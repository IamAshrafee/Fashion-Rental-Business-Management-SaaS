# Development Environment and Seeding Design

## Goal

Make local development reproducible and safe after the product, inventory, customer, storefront, fulfillment, notification, and operations modules were expanded. A developer should be able to configure, start, inspect, stop, or deliberately reset the project without knowing which of several legacy scripts is current.

## Current Problems

- `.env.example` points PostgreSQL at port 5432 while the canonical Compose file publishes it on 5433.
- The real local `.env` predates courier credential encryption, SMS delivery, and queue-dashboard configuration.
- Root `package.json` has low-level workspace commands but no canonical project bootstrap, start, status, stop, or reset commands.
- Shell and batch launchers independently implement process management and have already drifted.
- Startup does not guarantee dependencies, generated Prisma client, migrations, object-storage bucket, or system seed data are ready before the applications start.
- Reset scripts remove every Compose volume before validating that the environment is local and dedicated to development.
- The seed contains a fixed platform-admin password and does not distinguish safe development defaults from production provisioning.

## Considered Approaches

### Patch every platform script independently

This preserves the existing implementation but duplicates Docker health checks, migration behavior, and reset safety across Bash and Batch. It has the lowest initial change cost and the highest future drift risk.

### Run the complete application stack in Docker

This creates strong environment parity, but it slows the normal Next.js and NestJS edit/reload loop and requires production-like application images for everyday development.

### One cross-platform orchestrator with thin wrappers

This is the selected approach. A dependency-free Node script owns validation and orchestration. Root npm commands, `.sh`, `.command`, and `.bat` launchers delegate to it. Infrastructure remains in Docker while the applications run natively with their normal hot-reload servers.

## Environment Contract

`.env.example` is the documented local template and must match the default Compose ports and every environment variable consumed by the application or development tooling. Values are grouped by application, database, Redis, storage, authentication, storefront, notifications, operations, and seeding.

The ignored local `.env` is synchronized to the same contract with development-only values. Secrets used locally are clearly marked as unsafe for production. Production startup retains the backend's strict required-variable and minimum-secret validation.

Frontend public configuration uses `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_BASE_DOMAIN`; backend `API_URL` remains a server-side absolute API base. PostgreSQL uses host port 5433 consistently because port 5432 belongs to the container.

## Orchestrator Commands

The root package exposes these stable commands:

- `npm run dev`: prepare infrastructure and run both applications in the foreground.
- `npm run dev:prepare`: validate configuration, start infrastructure, wait for health, ensure the storage bucket, generate Prisma Client, deploy migrations, and apply idempotent system seeds.
- `npm run dev:status`: show Docker service state and configured application endpoints.
- `npm run dev:stop`: stop project infrastructure without deleting data.
- `npm run dev:reset`: reset only the verified local development environment, migrate, and seed it again.

Application processes remain children of the foreground development command. Signals are forwarded and no script kills unrelated processes merely because they occupy a configured port. Port conflicts fail with an actionable error.

## Reset Safety

Reset is intentionally destructive and requires either an interactive `RESET` confirmation or an explicit `--yes` flag for automation. Before deleting anything, the orchestrator verifies all of the following:

- `NODE_ENV` is not `production`.
- The database host is `localhost`, `127.0.0.1`, or `::1`.
- The database name is exactly `closetrent_dev`.
- The Compose project is this repository's named development project.

After validation, reset removes only this project's Compose containers and named data volumes, recreates PostgreSQL, Redis, and MinIO, waits for health, creates the configured bucket, deploys committed migrations, and runs the idempotent seed. It never invents a migration during reset.

## Seed Policy

The seed always upserts platform prerequisites: the SaaS admin, subscription plans, system colors, and starter template. Credentials come from `SEED_ADMIN_*` variables. Development may use documented local defaults; production seeding refuses the known development password and requires explicit credentials.

The seed remains idempotent and updates managed fields so rerunning it repairs stale platform records. It does not manufacture a demo tenant or operational transactions by default, because those records would blur platform prerequisites with mutable business data. Tenant onboarding remains the authoritative path for creating complete tenant foundations.

## Error Handling

Each external command is executed with inherited output and checked exit status. Health checks have finite deadlines and fail instead of continuing into partial startup. Missing prerequisites, missing `.env`, unsafe reset targets, port conflicts, Docker failures, migration failures, bucket failures, and seed failures stop the workflow with a direct remediation message.

## Verification

- Parse and validate both `.env.example` and the ignored development `.env` without printing secret values.
- Syntax-check shell wrappers and inspect Batch wrappers for delegation-only behavior.
- Exercise `dev:status` and `dev:prepare` against the local Compose services.
- Run the full reset non-interactively against the verified `closetrent_dev` target.
- Run the seed twice to prove idempotency.
- Run Prisma validation, backend tests, integration tests, and production builds without browser or visual verification.

