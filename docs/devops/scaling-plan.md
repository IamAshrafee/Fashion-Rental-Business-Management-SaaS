# DevOps: Scaling Plan

## Overview

The platform starts on a single VPS and scales incrementally as tenant count and traffic grow.

---

## Growth Stages

### Stage 1: Launch (0–50 Tenants)

**Infrastructure**: Single VPS

| Resource | Spec |
|---|---|
| VPS | 4 vCPU, 8 GB RAM, 200 GB SSD |
| Provider | DigitalOcean / Hetzner |
| Cost | ~$40-60/month |

```
[Single VPS]
├── Nginx
├── Next.js (1 instance)
├── NestJS (1 instance)
├── PostgreSQL
├── Redis
└── MinIO
```

**Handles**: ~100 concurrent users, ~10K requests/hour

---

### Stage 2: Growth (50–200 Tenants)

**Changes**:
- Upgrade VPS: 8 vCPU, 16 GB RAM, 500 GB SSD
- Add managed PostgreSQL (separate from VPS)
- External MinIO or S3-compatible storage
- PM2 cluster mode for NestJS (4 workers)

```
[VPS — Application]               [Managed DB]
├── Nginx                         ├── PostgreSQL
├── Next.js (1 instance)          └── Auto backups
├── NestJS (4 workers via PM2)
├── Redis                         [Object Storage]
└──                               └── MinIO / S3
```

**Cost**: ~$100-150/month

---

### Stage 3: Scale (200–1000 Tenants)

**Changes**:
- Separate VPS for frontend and backend
- Managed Redis (e.g., Redis Cloud)
- CDN for all static assets (Cloudflare)
- Load balancer in front of backend instances
- Read replica for PostgreSQL

```
[Load Balancer]
      │
      ├── [Frontend VPS]        [Database Cluster]
      │   ├── Nginx             ├── Primary (write)
      │   └── Next.js (2)       └── Replica (read)
      │
      ├── [Backend VPS 1]       [Managed Redis]
      │   └── NestJS (4)        └── Redis cluster
      │
      └── [Backend VPS 2]       [CDN / Storage]
          └── NestJS (4)        ├── Cloudflare CDN
                                └── S3 object storage
```

**Cost**: ~$300-500/month

---

### Stage 4: Enterprise (1000+ Tenants)

**Changes**:
- Kubernetes (K8s) orchestration
- Horizontal auto-scaling
- Database sharding consideration
- Multi-region deployment
- Dedicated support infrastructure

---

## Scaling Triggers

| Metric | Threshold | Action |
|---|---|---|
| CPU usage | > 80% sustained 5 min | Scale up VPS or add worker |
| Memory usage | > 85% | Scale up RAM |
| DB connections | > 80% pool | Add read replica |
| API latency p95 | > 500ms | Add backend instance |
| Storage usage | > 80% disk | Migrate to external storage |
| Tenant count | > 50 | Move DB to managed service |

---

## Cost Projections

| Stage | Tenants | Monthly Cost | Revenue (Est.) |
|---|---|---|---|
| Launch | 0-50 | $40-60 | ৳0-125,000 |
| Growth | 50-200 | $100-150 | ৳125,000-500,000 |
| Scale | 200-1000 | $300-500 | ৳500,000-2,500,000 |

Assuming average ৳2,500/tenant/month for Pro plan.

---

## Optimization Before Scaling

Before adding hardware, optimize:

1. **Database queries**: Add indexes, optimize N+1 queries
2. **Redis caching**: Cache tenant settings, product listings
3. **Image optimization**: Ensure WebP conversion, proper sizing
4. **API pagination**: Never return unbounded lists
5. **Connection pooling**: Proper Prisma connection pool size
