# DevOps: Monitoring

## Overview

Server health monitoring, error tracking, and application performance management.

---

## Monitoring Stack

| Tool | Purpose | Cost |
|---|---|---|
| **Node.js health endpoints** | Service health checks | Free |
| **Prometheus + Grafana** | Metrics dashboards | Free (self-hosted) |
| **Sentry** | Error tracking + alerting | Free tier |
| **UptimeRobot** | External uptime monitoring | Free tier |
| **Custom logging** | Application logs | Free |

---

## Health Endpoints

### API Health

```
GET /api/v1/health

Response:
{
  "status": "ok",
  "uptime": 345600,
  "services": {
    "database": "connected",
    "redis": "connected",
    "minio": "connected"
  },
  "version": "1.0.0",
  "timestamp": "2026-04-15T10:00:00Z"
}
```

### Deep Health Check

```
GET /api/v1/health/deep

Checks:
- Database: SELECT 1
- Redis: PING
- MinIO: list buckets
- Disk space: > 10% free
- Memory: < 90% used
```

---

## Application Metrics

| Metric | What It Tracks |
|---|---|
| `http_requests_total` | Total API requests by route and status |
| `http_request_duration_seconds` | Response latency |
| `active_bookings` | Currently active rental bookings |
| `db_pool_active` | Active database connections |
| `redis_memory_used` | Redis memory consumption |
| `minio_storage_used` | Storage consumption per tenant |
| `sms_sent_total` | SMS messages sent |
| `sms_failures` | Failed SMS attempts |

---

## Error Tracking (Sentry)

```typescript
// NestJS Sentry integration
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// Global exception filter
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    Sentry.captureException(exception);
    // ... return error response
  }
}
```

---

## Alerts

| Alert | Condition | Channel |
|---|---|---|
| API down | Health check fails 3× | SMS + Telegram |
| High error rate | > 5% of requests return 5xx | Telegram |
| Database connection pool exhausted | Active connections > 80% | Telegram |
| Disk space low | < 10% free | SMS + Telegram |
| SSL expiry | Certificate expires in < 14 days | Email |
| High memory usage | > 90% RAM | Telegram |

---

## Logging

```typescript
// Structured JSON logging
const logger = new Logger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' }),
  ],
});
```

Log rotation: 7 days retention, max 100MB per file.
