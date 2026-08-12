# ClosetRent Local Setup (macOS)

## Prerequisites

Install Docker Desktop, Node.js 18 or newer, npm 9 or newer, and Git. Confirm them from a terminal:

```bash
docker --version
docker compose version
node --version
npm --version
```

Docker Desktop must be running before the project workflow starts.

## First setup

From the repository root:

```bash
cp .env.example .env
npm install
npm run env:check
npm run dev
```

The checked-in template already uses PostgreSQL host port `5433`; no manual port correction is required. The application database inside Docker still listens on its normal container port `5432`.

The preparation phase starts PostgreSQL, Redis, and MinIO, waits for all three services, creates the storage bucket, generates Prisma Client, deploys committed migrations, and applies the platform seed. NestJS and Next.js start only after preparation succeeds.

Use `Control+C` to stop both application development servers. Docker infrastructure stays running for fast subsequent starts.

## Clickable launchers

You may double-click `start-dev.command` in Finder instead of running `npm run dev`. If macOS blocks it after cloning, restore executable permissions once:

```bash
chmod +x start-dev.command reset-dev.command start-dev.sh reset-dev.sh scripts/dev-environment.mjs
```

All command, shell, and Windows launchers call the same Node orchestrator; there are no platform-specific workflow differences.

## Daily commands

```bash
npm run dev
npm run dev:status
npm run dev:stop
```

`dev:stop` removes containers and the project network but preserves PostgreSQL, Redis, and MinIO volumes.

## Deliberate reset

```bash
npm run dev:reset
```

Reset requires typing `RESET`. It refuses to run in production, against a remote database host, or against any database other than `closetrent_dev`. After validation it deletes only this Compose project's local data volumes, recreates infrastructure, deploys migrations, and seeds the platform.

For non-interactive local automation only:

```bash
npm run dev:reset -- --yes
```

## Local subdomains

Tenant storefronts can be tested at URLs such as `http://demo.localhost:3000`; modern browsers resolve `*.localhost` automatically. The local environment passes `NEXT_PUBLIC_BASE_DOMAIN=localhost` to Next.js and the backend accepts localhost subdomains in development.

## Troubleshooting

Run these in order:

```bash
npm run env:check
npm run dev:status
docker compose logs --tail=100 postgres redis minio
```

The launcher does not terminate unrelated processes. If ports 3000 or 4000 are already occupied, stop the process you intentionally started there and run `npm run dev` again.
