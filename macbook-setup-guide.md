# ClosetRent Local Setup (macOS)

## Prerequisites

Install Docker Desktop, Node.js 18 or newer, npm 9 or newer, and Git.

Docker Desktop must be running before the project workflow starts.

## First setup

Open the repository in Finder and double-click `prepare-dev.command`.

The checked-in template already uses PostgreSQL host port `5433`; no manual port correction is required. The application database inside Docker still listens on its normal container port `5432`.

The preparation launcher creates `.env` from `.env.example` when it is missing, installs dependencies, starts PostgreSQL, Redis, and MinIO, waits for all three services, creates the public and private storage buckets, generates Prisma Client, deploys committed migrations, applies the platform seed, and starts both applications.

For normal work, double-click `start-dev.command`. It validates the environment, starts infrastructure when necessary, waits for health, and launches NestJS and Next.js. It deliberately skips installation, generation, migrations, bucket initialization, and seeding.

Use `Control+C` to stop both application development servers. Docker infrastructure stays running for fast subsequent starts.

## Clickable launchers

The five purpose-specific launchers are `start-dev.command`, `prepare-dev.command`, `reset-dev.command`, `stop-dev.command`, and `status-dev.command`. See [the plain-language launcher guide](DEVELOPMENT-SCRIPTS.md) for exactly when to use each one.

If macOS Gatekeeper blocks a launcher after cloning, Control-click it in Finder, select **Open**, and confirm once.

## Deliberate reset

Double-click `reset-dev.command`.

Reset requires typing `RESET`. It refuses to run in production, against a remote database host, or against any database other than `closetrent_dev`. After validation it deletes only this Compose project's local data volumes, recreates infrastructure, deploys migrations, and seeds the platform.

When reset completes, it automatically starts the backend and frontend.

## Local subdomains

Tenant storefronts can be tested at URLs such as `http://demo.localhost:3000`; modern browsers resolve `*.localhost` automatically. The local environment passes `NEXT_PUBLIC_BASE_DOMAIN=localhost` to Next.js and the backend accepts localhost subdomains in development.

## Troubleshooting

First double-click `status-dev.command`. If daily start reports missing or outdated dependencies, double-click `prepare-dev.command` once and retry.

The launcher does not terminate unrelated processes. If ports 3000 or 4000 are already occupied by something outside the launcher, stop the process you intentionally started there and double-click `start-dev.command` again.
