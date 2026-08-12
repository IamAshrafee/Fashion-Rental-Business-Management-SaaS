# ClosetRent

ClosetRent is a multi-tenant fashion-rental business management SaaS with product catalogue, hybrid inventory, physical-piece lifecycle, bookings, customers, storefront checkout, fulfillment, courier integration, notifications, staff access, and platform operations.

## Local development

Requirements: Node.js 18+, npm 9+, Docker Desktop, and Docker Compose v2.

```bash
cp .env.example .env
npm install
npm run dev
```

`npm run dev` validates `.env`, starts and health-checks PostgreSQL, Redis, and MinIO, creates the configured object-storage bucket, generates Prisma Client, deploys committed migrations, applies idempotent platform seeds, and then starts the NestJS and Next.js development servers.

The default local endpoints are:

- Storefront and dashboards: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`
- PostgreSQL: `localhost:5433`
- MinIO API: `http://localhost:9000`
- MinIO console: `http://localhost:9001`

## Development commands

```bash
npm run env:check      # validate configuration without exposing secrets
npm run dev:prepare    # prepare infrastructure, migrations, storage, and seed only
npm run dev:status     # inspect infrastructure and application ports
npm run dev:stop       # stop infrastructure and preserve data volumes
npm run dev:reset      # confirmed, local-only destructive reset
```

The macOS/Linux `.sh`, macOS `.command`, and Windows `.bat` launchers delegate to the same cross-platform workflow. See [the local setup guide](macbook-setup-guide.md) and [environment reference](docs/environment-variables.md).
