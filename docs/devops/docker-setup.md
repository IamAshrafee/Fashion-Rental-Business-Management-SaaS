# DevOps: Docker Setup

## Overview

All services run in Docker containers via Docker Compose on a single VPS.

---

## Container Architecture

```
┌─────────────────────────────────────────────┐
│                 VPS (Ubuntu)                 │
│                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │  Nginx  │  │ Next.js │  │ NestJS  │    │
│  │  :80    │→│  :3000  │  │  :4000  │    │
│  │  :443   │  └─────────┘  └─────────┘    │
│  └─────────┘                               │
│                                             │
│  ┌──────────┐  ┌───────┐  ┌─────────┐    │
│  │PostgreSQL│  │ Redis │  │  MinIO  │    │
│  │  :5432   │  │ :6379 │  │  :9000  │    │
│  └──────────┘  └───────┘  └─────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

---

## docker-compose.yml

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./certbot/www:/var/www/certbot
      - ./certbot/conf:/etc/letsencrypt
    depends_on:
      - frontend
      - backend
    restart: always

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      - NEXT_PUBLIC_API_URL=https://api.closetrent.com.bd
    restart: always

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/closetrent
      - REDIS_URL=redis://redis:6379
      - MINIO_ENDPOINT=minio
      - MINIO_PORT=9000
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: always

  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=closetrent
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: always

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --requirepass ${REDIS_PASSWORD}
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: always

  minio:
    image: minio/minio
    volumes:
      - minio_data:/data
    environment:
      - MINIO_ROOT_USER=${MINIO_USER}
      - MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}
    command: server /data --console-address ":9001"
    restart: always

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

---

## Dockerfiles

### Backend (NestJS)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
EXPOSE 4000
CMD ["node", "dist/main.js"]
```

### Frontend (Next.js)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f backend

# Rebuild after code changes
docker compose up -d --build backend frontend

# Run migrations
docker compose exec backend npx prisma migrate deploy

# Database shell
docker compose exec postgres psql -U ${DB_USER} -d closetrent
```
