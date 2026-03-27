# P01 — Project Scaffolding & DevOps

| | |
|---|---|
| **Phase** | 1 — Foundation |
| **Estimated Time** | 3–4 hours |
| **Requires** | Nothing (first package) |
| **Unlocks** | P02, P11 |

---

## CROSS-CUTTING DOCS (Read First)

Before starting, read these foundational docs in order:

1. `docs/vision.md` — What the product is
2. `docs/architecture.md` — System architecture overview
3. `docs/architecture-decisions.md` — 28 ADRs (the golden rules)
4. `docs/tech-stack.md` — Technology choices
5. `docs/coding-standards.md` — Code style and patterns
6. `docs/environment-variables.md` — All env vars
7. `docs/infrastructure.md` — Docker, Nginx, VPS setup
8. `docs/glossary.md` — Consistent terminology

---

## SCOPE

Set up the entire monorepo project from scratch. When complete, another agent can clone the repo and immediately start writing application code.

### 1. Monorepo Structure (npm workspaces)

```
closetrent/
├── package.json                # Root — npm workspaces config
├── turbo.json                  # Turborepo config (optional, for build orchestration)
├── .gitignore
├── .env.example                # All env vars with placeholders
├── .eslintrc.js                # Root ESLint config
├── .prettierrc                 # Prettier config
├── tsconfig.base.json          # Shared TypeScript config
├── docker-compose.yml          # All services
├── docker-compose.dev.yml      # Dev overrides
├── docker-compose.prod.yml     # Prod overrides
├── nginx/
│   └── conf.d/
│       └── default.conf        # Nginx config for dev
├── packages/
│   └── types/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts        # Shared TypeScript types
├── apps/
│   ├── backend/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       └── config/
│   │           └── configuration.ts
│   └── frontend/
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.js
│       └── src/
│           └── app/
│               ├── layout.tsx
│               └── page.tsx
└── docs/                       # Already exists — don't touch
```

### 2. Backend Setup (NestJS)

```bash
# Initialize NestJS in apps/backend/
npx @nestjs/cli new backend --directory apps/backend --package-manager npm --skip-git
```

**Required packages:**
```json
{
  "dependencies": {
    "@nestjs/core": "^10",
    "@nestjs/platform-express": "^10",
    "@nestjs/config": "^3",
    "@nestjs/throttler": "^5",
    "@nestjs/jwt": "^10",
    "@nestjs/passport": "^10",
    "@nestjs/event-emitter": "^2",
    "@nestjs/bull": "^10",
    "@prisma/client": "^5",
    "prisma": "^5",
    "bullmq": "^5",
    "class-validator": "^0.14",
    "class-transformer": "^0.5",
    "passport": "^0.7",
    "passport-jwt": "^4",
    "bcrypt": "^5",
    "minio": "^7",
    "sharp": "^0.33",
    "uuid": "^9"
  }
}
```

**NestJS module structure** (create empty modules):
```
src/
├── main.ts
├── app.module.ts
├── config/
│   └── configuration.ts       # @nestjs/config setup
├── common/
│   ├── decorators/            # Custom decorators
│   ├── filters/               # Exception filters
│   ├── guards/                # Auth, tenant, role guards (stubs)
│   ├── interceptors/          # Response transform, logging
│   ├── middleware/             # Tenant resolution middleware (stub)
│   ├── pipes/                 # Custom validation pipes
│   └── utils/                 # Helper functions
├── modules/
│   ├── auth/                  # Stub module
│   ├── tenant/                # Stub module
│   ├── product/               # Stub module
│   ├── booking/               # Stub module
│   ├── customer/              # Stub module
│   ├── payment/               # Stub module
│   ├── upload/                # Stub module
│   ├── notification/          # Stub module
│   └── admin/                 # Stub module
└── prisma/
    ├── prisma.module.ts       # Prisma service wrapper
    └── prisma.service.ts      # PrismaClient singleton
```

### 3. Frontend Setup (Next.js)

```bash
# Initialize Next.js in apps/frontend/
npx create-next-app@latest apps/frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

**Required packages:**
```json
{
  "dependencies": {
    "next": "^14",
    "react": "^18",
    "@tanstack/react-query": "^5",
    "react-hook-form": "^7",
    "@hookform/resolvers": "^3",
    "zod": "^3",
    "axios": "^1",
    "date-fns": "^3",
    "lucide-react": "^0.300",
    "clsx": "^2",
    "tailwind-merge": "^2"
  }
}
```

### 4. Shared Types Package

```typescript
// packages/types/src/index.ts
// Export shared interfaces used by both frontend and backend

export interface TenantContext {
  id: string;
  subdomain: string;
  customDomain: string | null;
  status: 'active' | 'suspended' | 'cancelled';
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}
```

### 5. Docker Compose

Reference: `docs/infrastructure.md` for container specs.

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: closetrent
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    mem_limit: 1536m
    mem_reservation: 512m

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --maxmemory 200mb --maxmemory-policy allkeys-lru
    volumes:
      - redisdata:/data
    ports:
      - "6379:6379"
    mem_limit: 256m

  minio:
    image: minio/minio:latest
    restart: always
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - miniodata:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    mem_limit: 512m

volumes:
  pgdata:
  redisdata:
  miniodata:
```

### 6. ESLint & Prettier

**ESLint** — enforce project rules:
- No `any` type
- No raw SQL (Prisma only)
- Enforce consistent imports
- NestJS and Next.js specific rules

**Prettier** — consistent formatting:
```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### 7. Environment Variables

Create `.env.example` from `docs/environment-variables.md` with:
- Database connection string
- Redis URL
- MinIO credentials
- JWT secrets
- API URLs
- All other env vars listed in the doc

### 8. Git Configuration

```gitignore
node_modules/
dist/
.next/
.env
*.env.local
pgdata/
redisdata/
miniodata/
```

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | Monorepo with `npm install` working from root | `npm install` succeeds, all workspaces resolved |
| 2 | NestJS app starts | `npm run dev --workspace=apps/backend` → server on port 4000 |
| 3 | Next.js app starts | `npm run dev --workspace=apps/frontend` → server on port 3000 |
| 4 | Docker Compose works | `docker-compose up -d` → postgres, redis, minio running |
| 5 | Prisma connected to DB | Backend connects to postgres via Prisma |
| 6 | Redis connected | Backend connects to Redis |
| 7 | MinIO accessible | MinIO console at localhost:9001 |
| 8 | Shared types package | Import from `@closetrent/types` in both apps |
| 9 | ESLint + Prettier working | `npm run lint` passes on both apps |
| 10 | `.env.example` complete | All env vars documented |

---

## ACCEPTANCE CRITERIA

```bash
# All of these must succeed:
npm install                           # Root install
npm run lint                          # No lint errors
docker-compose up -d                  # All containers healthy
npm run dev --workspace=apps/backend  # NestJS starts on :4000
npm run dev --workspace=apps/frontend # Next.js starts on :3000
# Prisma can connect to postgres
# Backend can connect to Redis
# Frontend loads in browser at localhost:3000
```

---

## OUTPUT CONTRACTS

Other packages depend on these existing after P01:

| Contract | Used By |
|---|---|
| `apps/backend/` — working NestJS app with module structure | P02, P03, P04–P10 |
| `apps/frontend/` — working Next.js app with Tailwind | P11 |
| `packages/types/` — shared TypeScript types | All packages |
| `docker-compose.yml` — running postgres, redis, minio | P02 |
| `apps/backend/src/prisma/` — PrismaService wrapper | P02 |
| `apps/backend/src/common/` — shared decorators, guards, filters (stubs) | P03 |
