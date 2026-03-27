# Infrastructure Plan — ClosetRent SaaS

## Strategy: Single VPS, Zero Extra Cost, Migration-Ready

Start with everything on one VPS. Design it so that any service can be detached and moved to its own server without rewriting application code.

---

## VPS Specifications

| Spec | Value |
|---|---|
| Provider | Cloud VPS |
| Plan | Cloud VPS 10 NVMe |
| CPU | 4 Cores |
| RAM | 8 GB |
| Disk | 75 GB NVMe |
| Backup | Auto-enabled |
| OS | Linux (Ubuntu 22.04 LTS recommended) |
| Cost | $7.59/month |
| Region | USA — globally accessible, primary deployment region |

---

## Service Layout on VPS

All services run as Docker containers on a single VPS, connected via an internal Docker network.

```
┌─────────────────────────────────────────────────────────┐
│                        VPS                               │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │               Nginx (Reverse Proxy)                │  │
│  │  Port 80/443 → SSL → Route to services            │  │
│  └───────────┬────────────────┬───────────────────────┘  │
│              │                │                           │
│    ┌─────────▼──────┐  ┌─────▼──────────┐               │
│    │   Frontend      │  │   Backend       │               │
│    │   (Next.js)     │  │   (NestJS)      │               │
│    │   Port 3000     │  │   Port 4000     │               │
│    └────────────────┘  └───────┬─────────┘               │
│                                │                          │
│           ┌────────────────────┼──────────────┐           │
│           │                    │              │           │
│    ┌──────▼──────┐   ┌────────▼───┐   ┌──────▼──────┐   │
│    │ PostgreSQL   │   │   Redis    │   │   MinIO      │   │
│    │ Port 5432    │   │ Port 6379  │   │ Port 9000    │   │
│    │              │   │            │   │ Console:9001 │   │
│    └──────────────┘   └────────────┘   └─────────────┘   │
│                                                          │
│  All connected via Docker internal network               │
│  No ports exposed externally except 80 and 443           │
└──────────────────────────────────────────────────────────┘
```

---

## Docker Compose Architecture

### Container Definitions

| Container | Image | Restart Policy | Volumes |
|---|---|---|---|
| `nginx` | `nginx:alpine` | always | `./nginx/conf.d:/etc/nginx/conf.d`, `./certbot:/etc/letsencrypt` |
| `frontend` | Custom (Next.js build) | always | None (stateless) |
| `backend` | Custom (NestJS build) | always | None (stateless) |
| `postgres` | `postgres:16-alpine` | always | `pgdata:/var/lib/postgresql/data` |
| `redis` | `redis:7-alpine` | always | `redisdata:/data` |
| `minio` | `minio/minio:latest` | always | `miniodata:/data` |

### Network Configuration

- All containers on a single Docker bridge network: `closetrent-network`
- Inter-service communication uses Docker service names (e.g., `postgres`, `redis`, `minio`)
- Only Nginx exposes ports externally (80, 443)
- All other containers are accessible only within the Docker network

### Volume Strategy

Critical data stored in named Docker volumes:

| Volume | Mount Point | Contains |
|---|---|---|
| `pgdata` | `/var/lib/postgresql/data` | All database data |
| `redisdata` | `/data` | Redis persistence |
| `miniodata` | `/data` | All uploaded files (product images, logos) |

**Why named volumes?**
- Data survives container restarts and rebuilds
- Easy to back up: `docker cp` or volume backup tools
- Clearly named — no accidental deletion

---

## Resource Allocation (Expected)

| Service | RAM (Typical) | RAM (Peak) | CPU |
|---|---|---|---|
| Frontend (Next.js) | 300 MB | 500 MB | Low |
| Backend (NestJS) | 300 MB | 500 MB | Medium |
| PostgreSQL | 500 MB | 1 GB | Medium |
| Redis | 100 MB | 200 MB | Very Low |
| MinIO | 200 MB | 400 MB | Low (I/O heavy) |
| Nginx | 50 MB | 50 MB | Very Low |
| **Total** | **~1.5 GB** | **~2.7 GB** | — |

**Headroom**: 5+ GB RAM free for spikes. This is comfortable.

### Container Memory Limits

Set memory limits in Docker Compose to prevent any single container from consuming all RAM:

| Container | Memory Limit | Memory Reservation |
|---|---|---|
| `frontend` | 512 MB | 256 MB |
| `backend` | 512 MB | 256 MB |
| `postgres` | 1.5 GB | 512 MB |
| `redis` | 256 MB | 64 MB |
| `minio` | 512 MB | 128 MB |
| `nginx` | 128 MB | 32 MB |

---

## Nginx Configuration

### Responsibilities

1. **SSL termination**: Handle HTTPS via Let's Encrypt certificates
2. **Subdomain routing**: Route `*.closetrent.com` to frontend
3. **API routing**: Route `/api/*` requests to backend
4. **Static files**: Serve MinIO files via proxy with cache headers
5. **Custom domains**: Dynamic server blocks for tenant custom domains
6. **Rate limiting**: Prevent abuse at the proxy layer
7. **Security headers**: HSTS, X-Frame-Options, Content-Security-Policy

### Routing Rules

```
# Subdomain → Frontend (Guest Portal)
*.closetrent.com → frontend:3000

# API requests → Backend
*.closetrent.com/api/* → backend:4000

# Owner portal
*.closetrent.com/owner/* → frontend:3000

# Admin portal
admin.closetrent.com → frontend:3000

# File storage proxy
cdn.closetrent.com/* → minio:9000 (with cache headers)

# Custom domains → Frontend
<custom-domain> → frontend:3000
```

### SSL Strategy

| Domain Type | SSL Method |
|---|---|
| `closetrent.com` | Cloudflare (origin certificate) |
| `*.closetrent.com` | Cloudflare wildcard (free) |
| Custom domains | Let's Encrypt (auto-provisioned) |

---

## Disk Space Planning (75 GB NVMe)

### Space Allocation

| Usage | Estimated Size | Notes |
|---|---|---|
| OS + Docker | 5 GB | Base system |
| PostgreSQL data | 2-10 GB | Grows with tenants and bookings |
| Redis data | < 500 MB | Mostly in-memory |
| MinIO data | 10-40 GB | Product images (biggest consumer) |
| Application code | < 1 GB | Container images |
| Logs | 1-5 GB | Must be rotated |
| **Available** | **20-50 GB** | Comfortable headroom |

### Image Optimization Rules

To control disk usage:

| Rule | Value |
|---|---|
| Max upload size | 5 MB per image |
| Storage format | WebP (converted on upload) |
| Max resolution | 1920×1920 px |
| Thumbnail size | 400×400 px |
| Compression quality | 80% (WebP) |

Estimated per product: ~2-5 MB (6 images, optimized)

Capacity: ~10,000+ products in 50 GB

---

## Backup Strategy

### Database Backups

| Type | Frequency | Method | Retention |
|---|---|---|---|
| Full dump | Daily (3 AM) | `pg_dump` → compressed → stored locally | 7 days |
| Full dump | Weekly (Sunday 3 AM) | `pg_dump` → compressed → stored externally | 4 weeks |

External storage: Download to local machine via SCP, or push to a free cloud storage.

### File Storage Backups

| Type | Frequency | Method |
|---|---|---|
| Incremental sync | Daily | `mc mirror` (MinIO client) to local/external |
| Full backup | Weekly | Archive entire MinIO data volume |

### Backup Automation

Cron jobs running inside the VPS:

```bash
# Daily database backup at 3 AM
0 3 * * * /opt/scripts/backup-db.sh

# Daily MinIO sync at 4 AM
0 4 * * * /opt/scripts/backup-minio.sh

# Weekly cleanup of old backups
0 5 * * 0 /opt/scripts/cleanup-backups.sh
```

---

## Monitoring (Minimal but Essential)

| What | Tool | Purpose |
|---|---|---|
| Server resources | `htop`, `df -h` | Manual check of CPU, RAM, disk |
| Container health | `docker stats` | Container resource usage |
| Application logs | Docker logs | Error tracking |
| Uptime | UptimeRobot (free) | Alert if site goes down |
| SSL expiry | Cloudflare / Let's Encrypt auto-renewal | Prevent SSL errors |

Future upgrade: Grafana + Prometheus for visual dashboards (when revenue justifies it).

---

## Scaling Path

### Stage 1: Current (Everything on 1 VPS)
- Cost: $7.59/month
- Capacity: 50-100 concurrent users, 200-500 orders/day
- When to move: When CPU consistently > 70% or RAM consistently > 80%

### Stage 2: Separate Database
- Move PostgreSQL to a dedicated VPS or managed database
- Update `DATABASE_URL` environment variable
- No code changes needed
- Estimated trigger: 50+ active tenants

### Stage 3: Separate File Storage
- Move MinIO to a separate VPS OR switch to Cloudflare R2 / AWS S3
- Update `STORAGE_ENDPOINT` environment variable
- No code changes needed (S3-compatible API)
- Estimated trigger: When image storage exceeds 50 GB

### Stage 4: Frontend Edge Deployment
- Move Next.js to Vercel or Cloudflare Pages
- Backend stays on VPS
- Better global performance
- Estimated trigger: When targeting international traffic

### Stage 5: Load Balancing
- Add a second backend VPS
- Nginx load balancer in front
- Session affinity via Redis (already in place)
- Estimated trigger: When single backend cannot handle request volume

---

## Environment Variable Strategy

**Rule: Never hardcode connection strings, URLs, or secrets in application code.**

All configuration via environment variables:

```env
# Backend connects to these via env vars
DATABASE_URL=postgresql://user:pass@postgres:5432/closetrent
REDIS_URL=redis://redis:6379

# Storage — change this one var to switch from MinIO to S3
STORAGE_ENDPOINT=http://minio:9000
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=closetrent

# Frontend
NEXT_PUBLIC_API_URL=https://api.closetrent.com
NEXT_PUBLIC_STORAGE_URL=https://cdn.closetrent.com
```

This ensures any service can be moved to any server by only updating environment variables. Zero code changes.

---

## Security Hardening (VPS Level)

| Action | How |
|---|---|
| SSH key only | Disable password auth in `/etc/ssh/sshd_config` |
| Non-root user | Run Docker as non-root where possible |
| Firewall | UFW: allow only 80, 443, 22 |
| Fail2ban | Block repeated failed SSH attempts |
| Auto updates | `unattended-upgrades` for security patches |
| Docker security | Non-root containers, read-only filesystems where possible |
| Log rotation | `logrotate` for all application logs |
