# ClosetRent

ClosetRent is a multi-tenant fashion-rental business management SaaS with product catalogue, hybrid inventory, physical-piece lifecycle, bookings, customers, storefront checkout, fulfillment, courier integration, notifications, staff access, and platform operations.

## Local development

Requirements: Node.js 18+, npm 9+, Docker Desktop, and Docker Compose v2.

```bash
cp .env.example .env
npm install
npm run dev:prepare
npm run dev
```

`npm run dev:prepare` performs the deliberate first-time or after-change setup: it starts infrastructure, creates the public and private object-storage buckets, generates Prisma Client, deploys committed migrations, and applies the idempotent platform seed.

For normal daily work, `npm run dev` only validates the local environment, starts and health-checks PostgreSQL, Redis, and MinIO, and launches the NestJS and Next.js development servers. It does not install dependencies, generate code, migrate, seed, or initialize storage.

The default local endpoints are:

- Storefront and dashboards: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`
- PostgreSQL: `localhost:5433`
- MinIO API: `http://localhost:9000`
- MinIO console: `http://localhost:9001`

## Development commands

```bash
npm run env:check      # validate configuration without exposing secrets
npm run dev:prepare    # after setup, dependency changes, or schema changes
npm run dev:status     # inspect infrastructure and application ports
npm run dev:stop       # stop infrastructure and preserve data volumes
npm run dev:reset      # confirmed, local-only destructive reset
```

The macOS/Linux `.sh`, macOS `.command`, and Windows `.bat` launchers delegate to the same cross-platform workflow. See [the local setup guide](macbook-setup-guide.md) and [environment reference](docs/environment-variables.md).
