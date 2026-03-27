# DevOps: CI/CD Pipeline

## Overview

GitHub Actions pipeline: lint → test → build → deploy.

---

## Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: closetrent_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }

      - name: Install dependencies
        run: npm ci
        working-directory: ./backend

      - name: Lint
        run: npm run lint
        working-directory: ./backend

      - name: Unit tests
        run: npm run test
        working-directory: ./backend

      - name: Integration tests
        run: npm run test:e2e
        working-directory: ./backend
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/closetrent_test
          REDIS_URL: redis://localhost:6379

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/closetrent
            git pull origin main
            docker compose build --no-cache backend frontend
            docker compose up -d backend frontend
            docker compose exec -T backend npx prisma migrate deploy
            docker compose restart nginx
```

---

## Branch Strategy

```
main          ← Production (auto-deploys)
  └── dev     ← Development (manual deploy to staging)
       └── feature/* ← Feature branches (PR to dev)
```

---

## Pre-Deploy Checklist

1. All tests passing
2. Prisma migrations generated
3. Environment variables updated (if new)
4. Docker images build successfully

---

## Rollback

```bash
# SSH into VPS
ssh deploy@vps

# Rollback to previous commit
cd /opt/closetrent
git log --oneline -5        # find previous commit
git checkout <commit>
docker compose build --no-cache backend frontend
docker compose up -d
```
