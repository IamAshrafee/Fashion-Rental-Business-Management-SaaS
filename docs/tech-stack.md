# Tech Stack Decisions — ClosetRent SaaS

Every technology decision documented with rationale. No technology is chosen "because it's popular" — each choice has a specific reason tied to our product requirements.

---

## Overview

| Layer | Technology | Role |
|---|---|---|
| Frontend Framework | Next.js (React) | SSR, routing, UI rendering |
| Frontend Styling | Tailwind CSS | Utility-first CSS framework |
| UI Components (Owner/Admin) | ShadCN/ui | Pre-built, accessible dashboard components |
| UI Components (Guest) | Custom + Tailwind | Fully custom design for storefront |
| Server State Management | TanStack Query | Caching, refetching, loading states for API data |
| Form Management | React Hook Form | Multi-step wizards, validation, performance |
| Backend Framework | NestJS | Structured API server |
| Runtime | Node.js | JavaScript/TypeScript runtime |
| Language | TypeScript | Type safety across frontend and backend |
| Database | PostgreSQL | Relational data storage |
| ORM | Prisma | Schema definition, migrations, queries |
| Search | PostgreSQL pg_trgm | Trigram-based fuzzy search |
| Cache | Redis | Session storage, data caching, job queues |
| Job Queue | BullMQ | Background jobs with retry, scheduling, monitoring |
| Event System | EventEmitter2 | Decoupled side-effects (NestJS module) |
| Object Storage | MinIO | Self-hosted S3-compatible file storage |
| Reverse Proxy | Nginx | SSL, routing, static serving |
| Containerization | Docker + Docker Compose | Service isolation, deployment |
| DNS / CDN | Cloudflare (Free) | DNS management, CDN for images, DDoS protection |
| SSL | Let's Encrypt | Free SSL certificates |
| Monorepo | npm workspaces | Shared types between frontend and backend |

---

## Frontend

### Next.js (v14+, App Router)

**Why Next.js:**
- **SSR for SEO**: Product pages must be indexable. When someone searches for rental items, our product pages must appear in results. Next.js SSR makes this possible.
- **App Router**: The latest routing paradigm with React Server Components — better performance and simpler data fetching.
- **Same-language full stack**: TypeScript everywhere. Shared types between frontend and backend.
- **Route-based code splitting**: Only loads JavaScript needed for the current page.
- **Built-in image optimization**: Critical for a product with heavy image content.
- **Social sharing**: SSR enables proper og:image and og:description for products shared on Facebook/WhatsApp.

**Why NOT plain React (Vite)?**
- No SSR = no SEO = missed traffic
- No built-in image optimization
- Manual routing setup

### Tailwind CSS

**Why Tailwind:**
- Rapid UI development
- Consistent spacing, colors, typography via config
- Responsive design utilities built-in
- Small production bundle (tree-shaking unused classes)
- Works perfectly with component-based architecture

**Usage rules:**
- Guest Portal: **Custom design** using Tailwind utilities. No component libraries. The storefront must look unique, premium, and branded.
- Owner Portal: **ShadCN/ui** components styled with Tailwind. Speed of development matters more than visual uniqueness here.

### ShadCN/ui (Owner Portal Only)

**Why ShadCN:**
- Not a dependency — components are copied into your codebase
- Fully customizable
- Built on Radix UI accessibility primitives
- Consistent dashboard components (tables, forms, dialogs, dropdowns)
- Accelerates development of admin/management interfaces

**Why NOT for Guest Portal:**
- The storefront must feel unique and premium, not like a generic dashboard
- Custom design = higher conversion

---

## Backend

### NestJS

**Why NestJS (not Express, not Fastify):**
- **Structured architecture**: Modules, controllers, services, guards — enforces clean code organization. Essential for a large SaaS codebase.
- **Dependency injection**: Services are properly isolated and testable.
- **Guards and interceptors**: Built-in support for auth guards, tenant guards, role guards — exactly what multi-tenant SaaS needs.
- **Enterprise-ready**: Designed for large-scale applications. This is not a portfolio project.
- **TypeScript-first**: Full type safety in the backend.
- **Decorator-based**: Clean, readable controller code with decorators like `@Get()`, `@UseGuards()`.

**Why NOT Express?**
- No enforced structure. A solo developer building a large SaaS without structure will create a mess.
- No built-in guards, interceptors, or dependency injection.
- Fine for small APIs, not for a product with 15+ modules.

### TypeScript (Everywhere)

**Why TypeScript:**
- Catch errors at compile time, not runtime
- Shared type definitions between frontend and backend
- Better IDE support (autocomplete, refactoring)
- Self-documenting code through types
- Essential for a large codebase maintained by AI agents — types provide context

---

## Database

### PostgreSQL

**Why PostgreSQL:**
- **Relational data**: Products, variants, bookings, orders — everything is relational. NoSQL would be a mistake here.
- **Strong indexing**: Fast lookups by tenant_id, date ranges, color, category.
- **JSON support**: `jsonb` columns for flexible data (e.g., product details key-value pairs) without sacrificing query performance.
- **Date/time handling**: Superior date range operations, essential for booking availability.
- **Mature and stable**: Battle-tested in production SaaS applications.
- **Free**: No licensing costs.

**Why NOT MongoDB?**
- Rental data is heavily relational (product → variants → bookings → orders → customers)
- Date-range availability queries are complex in MongoDB
- Schema enforcement prevents data inconsistency

### Prisma ORM

**Why Prisma:**
- **Schema-as-code**: `schema.prisma` is the single source of truth for the database structure
- **Auto migrations**: Schema changes automatically generate SQL migrations
- **Type-safe queries**: Generated TypeScript client means no runtime type errors
- **Readable queries**: `prisma.product.findMany()` is clearer than raw SQL for most operations
- **Relation handling**: Easy eager/lazy loading of relations (product → variants → images)

**Limitations to be aware of:**
- Complex aggregations may need raw SQL
- Bulk operations can be slower than raw queries
- Migration system is less flexible than Knex for advanced cases

---

## Caching & Session

### Redis

**Why Redis:**
- **Session storage**: JWT refresh tokens, active sessions per tenant
- **Data caching**: Frequently accessed data (tenant info, category lists, product details)
- **Availability caching**: Short-TTL cache for product availability status
- **Rate limiting**: Track request counts per IP/tenant
- **Lightweight**: Uses minimal RAM for the value it provides

**Why NOT skip caching?**
- Database queries on every request will slow down with scale
- Tenant info is read on every single request — must be cached
- Availability checks are the most frequent read operation

---

## File Storage

### MinIO

**Why MinIO:**
- **S3-compatible**: Uses the exact same API as AWS S3. When we migrate, we change one environment variable.
- **Self-hosted**: No external costs. Runs as a Docker container on our VPS.
- **Proven**: Used by large companies as S3 replacement.
- **Future-proof**: Can migrate to AWS S3, DigitalOcean Spaces, or Cloudflare R2 without changing application code.

**Image handling strategy:**
- Accept uploads via backend API
- Validate file type and size
- Compress and resize using Sharp (Node.js)
- Convert to WebP for optimal file size
- Store original + optimized versions
- Serve via Nginx + Cloudflare CDN with cache headers

---

## Infrastructure

### Docker + Docker Compose

**Why Docker:**
- Each service (frontend, backend, PostgreSQL, Redis, MinIO) runs in its own container
- Clean isolation — one service cannot crash another
- Reproducible builds — same result on any machine
- Easy migration — move any container to a new VPS by copying config
- Industry standard for SaaS deployment

### Nginx

**Why Nginx:**
- Lightweight, high-performance reverse proxy
- Handles SSL termination (Let's Encrypt integration)
- Routes subdomains and custom domains to correct services
- Serves static assets with proper caching headers
- Rate limiting at the proxy level

### Cloudflare (Free Plan)

**Why Cloudflare:**
- Free DNS management with fast propagation
- Basic DDoS protection
- SSL at the edge (additional layer)
- Basic caching for static assets
- Analytics on traffic patterns
- Zero cost

---

## Development Tools

| Tool | Purpose |
|---|---|
| ESLint | Linting TypeScript/JavaScript code |
| Prettier | Code formatting |
| Husky | Git hooks (pre-commit linting) |
| Git | Version control |
| Docker Desktop | Local development environment |
| Postman / Insomnia | API testing during development |
| pgAdmin | PostgreSQL GUI for development |
| MinIO Console | File storage management UI |

---

## Not Using (And Why)

| Technology | Why Not |
|---|---|
| Vercel | Running our own VPS. Vercel costs add up and limits backend control. |
| MongoDB | Data is relational. MongoDB would be a mistake for bookings + availability. |
| GraphQL | REST is simpler and sufficient. GraphQL adds complexity without proportional benefit for this product. |
| Microservices | Overkill for v1. Monolith with clean module separation first. Microservices later if needed. |
| RabbitMQ / Kafka | BullMQ + Redis is sufficient for our job queue needs. |
| Kubernetes | Massive overkill. Docker Compose is sufficient for single-VPS deployment. |
| Firebase | Vendor lock-in. Does not align with self-hosted strategy. |
| tRPC | Ties frontend and backend too tightly. We want separate deployability. |
