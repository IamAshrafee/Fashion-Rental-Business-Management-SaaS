# ClosetRent

ClosetRent is a multi-tenant fashion-rental business management SaaS with product catalogue, hybrid inventory, physical-piece lifecycle, bookings, customers, storefront checkout, fulfillment, courier integration, notifications, staff access, and platform operations.

## Local development

Requirements: Node.js 18+, npm 9+, Docker Desktop, and Docker Compose v2.

For a first setup, double-click `prepare-dev.cmd` on Windows or `prepare-dev.command` on macOS. For normal daily work, use `start-dev.cmd` on Windows or `start-dev.command` on macOS. No terminal commands are required.

The prepare launcher creates the local `.env` when missing, prepares dependencies, infrastructure, storage, Prisma, migrations, and the platform seed, then starts both applications.

The start launcher only validates the local environment, starts and health-checks PostgreSQL, Redis, and MinIO, and launches the NestJS and Next.js development servers. It does not install dependencies, generate code, migrate, seed, initialize storage, or delete data.

The default local endpoints are:

- Storefront and dashboards: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`
- PostgreSQL: `localhost:5433`
- MinIO API: `http://localhost:9000`
- MinIO console: `http://localhost:9001`

## Development launchers

- `start-dev.cmd` / `start-dev.command` — normal daily start.
- `prepare-dev.cmd` / `prepare-dev.command` — first setup or project upgrade, followed by start.
- `reset-dev.cmd` / `reset-dev.command` — confirmed fresh local environment, followed by start.
- `stop-dev.cmd` / `stop-dev.command` — stop applications and infrastructure without deleting data.
- `status-dev.cmd` / `status-dev.command` — read-only service status.

In each pair, Windows uses `.cmd` and macOS uses `.command`. See [exactly when to use each development launcher](DEVELOPMENT-SCRIPTS.md), [the macOS setup guide](macbook-setup-guide.md), and [the environment reference](docs/environment-variables.md).
