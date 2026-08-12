# Fast Daily Development Start Design

## Goal

Make the normal local launcher start ClosetRent quickly without repeating installation, Prisma generation, migrations, object-storage provisioning, or platform seeding on every use.

## Command Contract

The existing daily entry points remain familiar:

- `npm run dev`
- `start-dev.command`
- `start-dev.sh`
- `start-dev.bat`

They will validate `.env`, confirm Docker, npm, and Compose are available, start PostgreSQL, Redis, and MinIO if necessary, wait for all three services to become healthy, reject occupied frontend or backend ports, and run the NestJS and Next.js watch servers in the foreground.

Daily start will not install dependencies, generate Prisma Client, deploy migrations, run seeds, or execute the MinIO initialization container.

## Explicit Preparation and Reset

`npm run dev:prepare` remains the deliberate preparation command. It installs dependencies when required, starts and health-checks infrastructure, creates the configured MinIO bucket, generates Prisma Client, deploys committed migrations, and applies the idempotent platform seed.

`npm run dev:reset` remains the guarded destructive workflow. It verifies the local `closetrent_dev` target, recreates only this repository's Compose volumes, and then performs full preparation.

This makes the distinction explicit:

- Daily coding: `npm run dev` or a platform launcher.
- First setup or dependency/schema change: `npm run dev:prepare`.
- Deliberately clean local environment: `npm run dev:reset`.

## Error Handling

Daily start fails with a direct message if `.env` is invalid, Docker is unavailable, infrastructure does not become healthy, dependencies are missing, or ports 3000/4000 are occupied. It does not silently mutate dependencies or database state to recover from those conditions.

## Verification

Automated tests will verify that the command routing keeps daily startup separate from preparation. Shell syntax and all wrapper routes will be checked. A CLI smoke test will confirm that both applications start successfully while seed output, Prisma generation, migration deployment, and MinIO initialization are absent from the daily-start output.

