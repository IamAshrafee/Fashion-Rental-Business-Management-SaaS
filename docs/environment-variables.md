# Environment Variables — ClosetRent SaaS

Every environment variable used across the system. This is the single reference for all configuration.

---

## Variable Reference

### Application

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `development` | Environment mode: `development`, `production`, `test` |
| `APP_PORT` | No | `4000` | Backend API server port |
| `FRONTEND_PORT` | No | `3000` | Frontend server port |
| `APP_URL` | Yes | — | Base URL of the platform (e.g., `https://closetrent.com`) |
| `API_URL` | Yes | — | Backend API URL (e.g., `https://closetrent.com/api`) |
| `CORS_ORIGINS` | Yes | — | Comma-separated allowed origins for CORS |

### Database (PostgreSQL)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | Full PostgreSQL connection string |
| `DATABASE_HOST` | No | `postgres` | Database host (Docker service name or IP) |
| `DATABASE_PORT` | No | `5432` | Database port |
| `DATABASE_NAME` | No | `closetrent` | Database name |
| `DATABASE_USER` | No | `closetrent` | Database user |
| `DATABASE_PASSWORD` | Yes | — | Database password |

> Use `DATABASE_URL` in Prisma. The individual fields are for Docker Compose setup.

### Cache (Redis)

| Variable | Required | Default | Description |
|---|---|---|---|
| `REDIS_URL` | Yes | — | Full Redis connection string (e.g., `redis://redis:6379`) |
| `REDIS_HOST` | No | `redis` | Redis host |
| `REDIS_PORT` | No | `6379` | Redis port |
| `REDIS_PASSWORD` | No | — | Redis password (empty for local development) |

### Object Storage (MinIO / S3)

| Variable | Required | Default | Description |
|---|---|---|---|
| `STORAGE_ENDPOINT` | Yes | — | MinIO or S3 endpoint URL (e.g., `http://minio:9000`) |
| `STORAGE_PORT` | No | `9000` | Storage port |
| `STORAGE_ACCESS_KEY` | Yes | — | Access key / username |
| `STORAGE_SECRET_KEY` | Yes | — | Secret key / password |
| `STORAGE_BUCKET` | Yes | `closetrent` | Default bucket name |
| `STORAGE_REGION` | No | `us-east-1` | S3 region (MinIO ignores this but SDK requires it) |
| `STORAGE_USE_SSL` | No | `false` | Use HTTPS for storage connection |
| `STORAGE_PUBLIC_URL` | Yes | — | Public-facing URL for stored files (e.g., `https://cdn.closetrent.com`) |

### Authentication

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | Yes | — | Secret key for signing JWT access tokens |
| `JWT_REFRESH_SECRET` | Yes | — | Secret key for signing JWT refresh tokens |
| `JWT_ACCESS_EXPIRY` | No | `15m` | Access token expiration time |
| `JWT_REFRESH_EXPIRY` | No | `7d` | Refresh token expiration time |
| `BCRYPT_SALT_ROUNDS` | No | `12` | Number of bcrypt hashing rounds |

### Payment Gateways

| Variable | Required | Default | Description |
|---|---|---|---|
| `SSLCOMMERZ_STORE_ID` | Yes* | — | SSLCommerz store identifier |
| `SSLCOMMERZ_STORE_PASSWORD` | Yes* | — | SSLCommerz store password |
| `SSLCOMMERZ_IS_SANDBOX` | No | `true` | Use sandbox or live mode |
| `SSLCOMMERZ_SUCCESS_URL` | Yes* | — | Payment success callback URL |
| `SSLCOMMERZ_FAIL_URL` | Yes* | — | Payment failure callback URL |
| `SSLCOMMERZ_CANCEL_URL` | Yes* | — | Payment cancel callback URL |
| `SSLCOMMERZ_IPN_URL` | Yes* | — | Instant Payment Notification URL |

> *Required only when payment integration is enabled.

### SMS Gateway

| Variable | Required | Default | Description |
|---|---|---|---|
| `SMS_PROVIDER` | No | — | SMS provider name (e.g., `bulksms_bd`, `sms_net_bd`) |
| `SMS_API_KEY` | No | — | SMS provider API key |
| `SMS_SENDER_ID` | No | — | Sender ID for SMS messages |

### Courier Integration

| Variable | Required | Default | Description |
|---|---|---|---|
| `PATHAO_API_URL` | No | — | Pathao courier API base URL |
| `PATHAO_API_KEY` | No | — | Pathao API key |
| `PATHAO_SECRET_KEY` | No | — | Pathao secret key |
| `STEADFAST_API_URL` | No | — | Steadfast courier API base URL |
| `STEADFAST_API_KEY` | No | — | Steadfast API key |
| `STEADFAST_SECRET_KEY` | No | — | Steadfast secret key |

### Email (Future)

| Variable | Required | Default | Description |
|---|---|---|---|
| `SMTP_HOST` | No | — | SMTP server host |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASSWORD` | No | — | SMTP password |
| `EMAIL_FROM` | No | — | Default "from" email address |

### Domain & Tenant

| Variable | Required | Default | Description |
|---|---|---|---|
| `BASE_DOMAIN` | Yes | — | Base domain for tenant subdomains (e.g., `closetrent.com`) |
| `ADMIN_SUBDOMAIN` | No | `admin` | Subdomain for admin portal (e.g., `admin.closetrent.com`) |

### Image Processing

| Variable | Required | Default | Description |
|---|---|---|---|
| `MAX_IMAGE_SIZE_MB` | No | `5` | Maximum upload size per image in MB |
| `IMAGE_QUALITY` | No | `80` | WebP compression quality (1-100) |
| `IMAGE_MAX_WIDTH` | No | `1920` | Maximum image width in pixels |
| `IMAGE_MAX_HEIGHT` | No | `1920` | Maximum image height in pixels |
| `THUMBNAIL_WIDTH` | No | `400` | Thumbnail width in pixels |
| `THUMBNAIL_HEIGHT` | No | `400` | Thumbnail height in pixels |

---

## Example `.env` Files

### `.env.development`

```env
NODE_ENV=development
APP_PORT=4000
FRONTEND_PORT=3000
APP_URL=http://localhost:3000
API_URL=http://localhost:4000/api
CORS_ORIGINS=http://localhost:3000

# Database
DATABASE_URL=postgresql://closetrent:dev_password@localhost:5432/closetrent_dev

# Redis
REDIS_URL=redis://localhost:6379

# MinIO
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=closetrent-dev
STORAGE_PUBLIC_URL=http://localhost:9000/closetrent-dev

# Auth
JWT_SECRET=dev-jwt-secret-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
BCRYPT_SALT_ROUNDS=10

# Domain
BASE_DOMAIN=localhost:3000
```

### `.env.production`

```env
NODE_ENV=production
APP_PORT=4000
FRONTEND_PORT=3000
APP_URL=https://closetrent.com
API_URL=https://closetrent.com/api
CORS_ORIGINS=https://*.closetrent.com

# Database
DATABASE_URL=postgresql://closetrent:STRONG_PASSWORD_HERE@postgres:5432/closetrent

# Redis
REDIS_URL=redis://redis:6379

# MinIO
STORAGE_ENDPOINT=http://minio:9000
STORAGE_ACCESS_KEY=STRONG_KEY_HERE
STORAGE_SECRET_KEY=STRONG_SECRET_HERE
STORAGE_BUCKET=closetrent
STORAGE_PUBLIC_URL=https://cdn.closetrent.com

# Auth
JWT_SECRET=RANDOM_64_CHAR_STRING_HERE
JWT_REFRESH_SECRET=DIFFERENT_RANDOM_64_CHAR_STRING_HERE
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
BCRYPT_SALT_ROUNDS=12

# Domain
BASE_DOMAIN=closetrent.com

# Payment
SSLCOMMERZ_STORE_ID=your_store_id
SSLCOMMERZ_STORE_PASSWORD=your_store_password
SSLCOMMERZ_IS_SANDBOX=false
SSLCOMMERZ_SUCCESS_URL=https://closetrent.com/api/payment/success
SSLCOMMERZ_FAIL_URL=https://closetrent.com/api/payment/fail
SSLCOMMERZ_CANCEL_URL=https://closetrent.com/api/payment/cancel
SSLCOMMERZ_IPN_URL=https://closetrent.com/api/payment/ipn
```

---

## Rules

1. **Never commit `.env` files** — add `.env*` to `.gitignore`
2. **Always commit `.env.example`** — with placeholder values, no real secrets
3. **Use Docker Compose `env_file`** — reference `.env` from `docker-compose.yml`
4. **Validate on startup** — backend must validate all required env vars at boot and fail fast if missing
5. **Use `@nestjs/config`** — centralized config module with validation
6. **No hardcoded values** — if it could change between environments, it's an env var
