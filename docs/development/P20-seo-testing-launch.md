# P20 — SEO, Testing & Launch Preparation

| | |
|---|---|
| **Phase** | 8 — Polish & Launch |
| **Estimated Time** | 4–5 hours |
| **Requires** | P18, P14, P19 (all user-facing pages complete) |
| **Unlocks** | None (final package) |
| **Agent Skills** | `nextjs-best-practices`, `vercel-react-best-practices` · Optional: `postgresql-database-engineering`, `tailwind-css-patterns` |

---

## REFERENCE DOCS

- `docs/seo.md` — SEO strategy
- `docs/performance-engineering.md` — Performance targets
- `docs/scalability-engineering.md` — Infrastructure tuning
- `docs/infrastructure.md` — Production deployment
- `docs/coding-standards.md` — Testing standards

---

## SCOPE

### 1. SEO Optimization

**Per-page meta tags (using Next.js Metadata API):**
- Storefront home: dynamic title from tenant name + tagline
- Product listing: "Shop [Category] | [Tenant Name]"
- Product detail: "[Product Name] — Rent for [Price] | [Tenant Name]"
- All pages: Open Graph tags, Twitter cards, canonical URL

**Structured data (JSON-LD):**
- Product schema (name, price, availability, images)
- Organization schema (tenant business info)
- BreadcrumbList schema (navigation)

**Sitemap:**
- Dynamic `sitemap.xml` per tenant (products, categories)
- `robots.txt` (allow search engines, disallow admin/owner routes)

**SEO technical:**
- Semantic HTML (proper heading hierarchy per page)
- Alt text on all images
- Internal linking between related products
- 404 page with helpful navigation

### 2. Core Web Vitals Optimization

**LCP (< 2.5s):**
- Preload hero image and product images above the fold
- SSR for storefront pages
- Next.js `<Image>` with priority for above-fold images

**CLS (< 0.1):**
- Fixed image dimensions (aspect-ratio CSS)
- Skeleton loading states for dynamic content
- Font preloading (prevent FOUT)

**FID (< 100ms):**
- Code splitting per route (Next.js automatic)
- Dynamic imports for heavy components (calendar, charts, rich text)
- Minimize main thread blocking

### 3. Testing

**Unit tests (Jest/Vitest):**
- Service methods: pricing calculations, booking validation, date calculations
- Utility functions: formatPrice, formatDate, slug generation
- Guards: auth guard, tenant guard, role guard

**Integration tests (Supertest):**
- Auth flow: register → login → refresh → logout
- Product CRUD: create → update → soft delete → restore
- Booking flow: validate → create → confirm → ship → deliver → return → complete
- Payment flow: record → verify totals → deposit refund

**E2E tests (Playwright):**
- Guest flow: browse → add to cart → checkout → confirmation
- Owner flow: login → add product → view bookings → manage order
- Admin flow: login → view tenants → change plan

### 4. Production Docker Configuration

```yaml
# docker-compose.prod.yml overrides
services:
  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile.prod
    environment:
      NODE_ENV: production
    restart: always
    mem_limit: 1024m

  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile.prod
    environment:
      NODE_ENV: production
    restart: always
    mem_limit: 512m
```

**Dockerfiles** for production builds (multi-stage, minimal image size).

### 5. Nginx Production Config

- SSL termination (Let's Encrypt)
- Wildcard subdomain routing (`*.closetrent.com`)
- Custom domain proxy pass
- Gzip/Brotli compression
- Static asset caching (1 year for hashed, short for dynamic)
- Rate limiting zones (guest: 60r/m, api: 120r/m)
- Security headers (HSTS, X-Frame-Options, X-Content-Type-Options)

### 6. Monitoring Setup

- Health check endpoints: `GET /api/health` (DB, Redis, MinIO status)
- Application logging (JSON format, structured)
- Error tracking (Sentry or similar — environment variable for DSN)
- Uptime monitoring (simple cron curl to health endpoint)

### 7. Launch Checklist

- [ ] All environment variables set for production
- [ ] Database migrated and seeded (admin user, plans)
- [ ] MinIO bucket created with proper permissions
- [ ] SSL certificates issued and configured
- [ ] DNS configured (A record for main, CNAME for wildcard)
- [ ] Nginx config tested
- [ ] All Docker containers running and healthy
- [ ] Health check endpoint returning 200
- [ ] First tenant registration working end-to-end
- [ ] Guest checkout flow working end-to-end
- [ ] Backup strategy configured (pg_dump cron)
- [ ] Log rotation configured

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | SEO meta tags on all pages | Verify with SEO audit tool |
| 2 | Structured data (JSON-LD) | Verify with Google Rich Results Test |
| 3 | Dynamic sitemap + robots.txt | Accessible at /sitemap.xml |
| 4 | Skeleton loading states | Visual loading on slow network |
| 5 | Unit tests (critical paths) | `npm test` passes |
| 6 | Integration tests (API flows) | All flow tests pass |
| 7 | E2E tests (3 flows) | Playwright tests pass |
| 8 | Production Docker config | `docker-compose -f prod up` works |
| 9 | Nginx production config | SSL + routing + caching working |
| 10 | Health check endpoint | Returns system status |
| 11 | Launch checklist complete | All items checked |
