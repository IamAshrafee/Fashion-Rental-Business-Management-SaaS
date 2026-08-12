# Environment Variables

`.env.example` is the canonical local-development contract. Copy it to the ignored `.env`, keep the variable names, and replace development values for each deployed environment.

## Application and public frontend

| Variable                  | Purpose                                   | Local value                    |
| ------------------------- | ----------------------------------------- | ------------------------------ |
| `NODE_ENV`                | Runtime mode                              | `development`                  |
| `APP_PORT`                | NestJS host port                          | `4000`                         |
| `FRONTEND_PORT`           | Next.js host port                         | `3000`                         |
| `APP_URL`                 | Browser-facing application URL            | `http://localhost:3000`        |
| `API_URL`                 | Server-side API base                      | `http://localhost:4000/api/v1` |
| `CORS_ORIGINS`            | Comma-separated trusted browser origins   | `http://localhost:3000`        |
| `NEXT_PUBLIC_API_URL`     | API base compiled/exposed to Next.js      | `http://localhost:4000/api/v1` |
| `NEXT_PUBLIC_BASE_DOMAIN` | Frontend tenant-domain suffix             | `localhost`                    |
| `BASE_DOMAIN`             | Backend cookie and tenant-domain suffix   | `localhost:3000`               |
| `ADMIN_SUBDOMAIN`         | Reserved platform-admin subdomain         | `admin`                        |
| `SERVER_IP`               | DNS target used by custom-domain guidance | `127.0.0.1`                    |

## PostgreSQL

| Variable            | Purpose               | Local value                                                          |
| ------------------- | --------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`      | Prisma connection URL | `postgresql://closetrent:dev_password@localhost:5433/closetrent_dev` |
| `DATABASE_HOST`     | Compose/tooling host  | `localhost`                                                          |
| `DATABASE_PORT`     | Published host port   | `5433`                                                               |
| `DATABASE_NAME`     | Database name         | `closetrent_dev`                                                     |
| `DATABASE_USER`     | Database user         | `closetrent`                                                         |
| `DATABASE_PASSWORD` | Database password     | development only                                                     |

The container listens on 5432. Local applications connect through the published host port 5433.

## Redis

`REDIS_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, and `REDIS_DB` configure cache, metering, queues, and scheduled jobs. The local database index is `0` and the host port is `6379`.

## Object storage

`STORAGE_ENDPOINT`, `STORAGE_PORT`, `STORAGE_CONSOLE_PORT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_USE_SSL`, and `STORAGE_PUBLIC_URL` configure MinIO or an S3-compatible service. `dev:prepare` idempotently creates the configured bucket and its public-download policy.

## Authentication and encryption

`JWT_SECRET`, `JWT_REFRESH_SECRET`, and `COURIER_CREDENTIALS_ENCRYPTION_KEY` are independent secrets. Each must contain at least 32 characters; production validation rejects the documented development values. `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`, and `BCRYPT_SALT_ROUNDS` control token and password-hash policy.

## Notifications and operations

`SMS_PROVIDER_URL`, `SMS_PROVIDER_API_KEY`, and `SMS_SENDER_ID` configure the outbound SMS HTTP provider. Development can leave the URL and key empty to use the development adapter. Production requires both.

`BULL_BOARD_USERNAME` and `BULL_BOARD_PASSWORD` protect the queue operations UI in production and are required there.

## Platform seed

`SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PHONE`, and `SEED_ADMIN_PASSWORD` define the idempotently managed SaaS administrator. The documented password is strictly for local development and is rejected when `NODE_ENV=production`. Production provisioning must supply an explicit password of at least 12 characters.

## Optional integrations

Payment gateway, courier, SMTP, and other provider-specific placeholders remain commented in `.env.example` until the corresponding tenant or deployment integration is enabled. Tenant Pathao and Steadfast credentials are stored encrypted through the application, not as shared plaintext environment variables.

## Validation

Run `npm run env:check` after any configuration change. It reports only safe endpoints and rejects missing keys, invalid ports or URLs, secret lengths, database scalar/URL drift, and obsolete API prefixes without printing secret values.

In production, backend startup additionally requires `DATABASE_URL`, all three application secrets, `CORS_ORIGINS`, SMS provider credentials, and Bull Board credentials.
