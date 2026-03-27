# ClosetRent SaaS — Project Rules

These rules are NON-NEGOTIABLE. Every AI agent working on this project MUST follow them. Violating these rules will produce bugs, inconsistencies, and integration failures.

---

## 🏗️ Architecture Rules

### Multi-Tenancy (CRITICAL)
- Every database query on a tenant-scoped table MUST include `tenantId` in the WHERE clause
- Never use `findMany()` without a `tenantId` filter on tenant-scoped models
- Tenant-scoped models: Product, Booking, BookingItem, Customer, Category, Event, Payment, Notification, AuditLog, DateBlock, ProductVariant, ProductImage, ProductPricing, ProductService, ProductSize, FAQ, Review
- NOT tenant-scoped: User, Tenant, StoreSettings, Subscription, SubscriptionPlan
- The `TenantMiddleware` attaches `req.tenant` to every request — use `@CurrentTenant()` decorator to access it

### Booking = Order (ADR-02)
- There is NO separate orders table. The `bookings` table IS the order
- Never create an "order" model, service, or controller
- Use "booking" terminology everywhere in code (exception: UI can say "Order" in labels if needed)

### Client-Side Cart (ADR-03)
- Cart lives in `localStorage` on the frontend. There is NO cart table or cart API
- Server only validates cart contents at checkout time via `POST /api/v1/bookings/validate`

### Event-Driven (ADR-05)
- Use `EventEmitter2` for cross-module communication
- Never call another module's service directly for side effects (e.g., don't call NotificationService from BookingService)
- Instead, emit events: `this.eventEmitter.emit('booking.created', payload)`
- Listener in the notification module picks it up

---

## 💰 Money Rules (ADR-04 — CRITICAL)

- ALL currency values are stored as `Int` (integers) in the database
- ৳7,500.00 is stored as `7500` (integer, no decimals)
- NEVER use `Decimal`, `Float`, or `number` with decimal points for money
- All calculations use integer math
- Rounding rule: ALWAYS round UP (`Math.ceil()`)
- Display formatting happens ONLY in the frontend via `formatPrice()` utility
- Prisma type: `Int` (not `Decimal`)

---

## 🗄️ Database Rules

### Naming
- Table names: `snake_case` plural (e.g., `booking_items`)
- Column names: `snake_case` (e.g., `total_paid`)
- Prisma models: `PascalCase` with `@@map("table_name")`
- Prisma fields: `camelCase` with `@map("column_name")`

### IDs
- All primary keys: UUID (`@id @default(uuid())`)
- Use `uuid_generate_v7()` if on PostgreSQL 17+, otherwise `gen_random_uuid()`

### Timestamps
- Every table has `createdAt` and `updatedAt`
- Use `@default(now())` and `@updatedAt`
- Store in UTC always

### Soft Delete
- Products, Bookings, Customers use soft delete: `deletedAt DateTime? @map("deleted_at")`
- Never hard delete these records (except from trash after 90 days)
- All queries on soft-deletable tables must filter `WHERE deleted_at IS NULL` (use Prisma middleware)

### Indexes
- Don't create standalone `@@index([tenantId])` when composite indexes starting with `tenantId` exist
- Use partial indexes for hot queries (e.g., published products only)

---

## 🔐 Security Rules

### Authentication
- JWT access tokens: 15 minutes TTL
- JWT refresh tokens: 7 days TTL, stored in database
- Always validate session is active before accepting a token
- Bcrypt for password hashing (salt rounds: 12)

### Authorization
- Every endpoint MUST have `@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)` unless explicitly `@Public()`
- Use `@Roles('owner', 'manager')` decorator for role-based access
- Roles: `super_admin`, `owner`, `manager`, `staff`

### Input Validation
- Every endpoint with a body MUST use a DTO with `class-validator` decorators
- `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))`
- Sanitize HTML input with DOMPurify (descriptions, notes)
- Never trust client-side data — always re-validate and re-calculate on the server

---

## 🎨 Frontend Rules

### UI Framework
- Owner Portal + Admin Portal: **ShadCN/ui** components + Tailwind CSS
- Guest Storefront: **Custom Tailwind CSS only** — NOT ShadCN/ui
- The storefront must look like a premium fashion website, not a dashboard

### State Management
- Server state: **TanStack Query** (React Query) — no Redux, no Zustand for API data
- Form state: **React Hook Form** + Zod validation
- Cart: `localStorage` via `useCart()` hook
- Auth: Context + `useAuth()` hook
- Tenant: Context + `useTenant()` hook

### API Communication
- Use the shared Axios instance from `lib/api-client.ts`
- Every API call must go through TanStack Query hooks
- Handle loading, error, and empty states for every data-fetching component
- Use optimistic updates for mutations where appropriate

### Styling
- Use `cn()` utility for conditional classes (from `lib/utils.ts`)
- No inline styles
- Use CSS variables for tenant branding colors
- Mobile-first responsive design

---

## 📁 File & Module Structure

### Backend
```
apps/backend/src/modules/{module-name}/
├── {module}.module.ts        # NestJS module definition
├── {module}.controller.ts    # HTTP endpoints
├── {module}.service.ts       # Business logic
├── dto/                      # Input/output DTOs
│   ├── create-{entity}.dto.ts
│   └── update-{entity}.dto.ts
├── entities/                 # Response types (if needed)
└── {module}.listener.ts      # Event listeners (if any)
```

### Frontend
```
apps/frontend/src/app/(portal)/{feature}/
├── page.tsx                  # Route page component
├── components/               # Feature-specific components
├── hooks/                    # Feature-specific hooks
└── loading.tsx               # Loading skeleton
```

---

## 📝 Code Style

### TypeScript
- Strict mode enabled
- No `any` type — use proper types or `unknown`
- Use `interface` for object shapes, `type` for unions/intersections
- Export types from `packages/types/` for shared definitions
- Prefer `const` over `let`, never use `var`

### API Response Format
```typescript
// Success
{ success: true, data: T, message?: string }

// Success with pagination
{ success: true, data: T[], meta: { total, page, limit, totalPages } }

// Error
{ success: false, error: { code: string, message: string, details?: Record<string, string[]> } }
```

### Commits
- Follow conventional commits: `feat(scope): description`
- Scopes: `auth`, `product`, `booking`, `customer`, `payment`, `notification`, `frontend`, `infra`, `admin`
- Reference package number in commit body when applicable

---

## 🌍 Localization Rules

- All dates stored as UTC in database
- Rental dates stored as `DATE` type (calendar dates, no timezone conversion)
- Display dates formatted per tenant's `date_format` and `timezone` settings
- Currency formatted per tenant's `currency_code`, `currency_symbol`, `currency_position`
- Phone validation is per tenant's `country` — no hardcoded BD regex
- Address structure is flexible (JSONB `extra` field for tenant-specific fields)
- Default language: English. Multi-language support deferred to future.

---

## 📏 Performance Rules

- Every Prisma query must declare its `include`/`select` strategy — no implicit loading
- List endpoints: max 100 items per page, default 20
- Use cursor-based pagination for unbounded lists (bookings, audit logs)
- Use denormalized counters for frequently-read stats (product.totalBookings, customer.totalSpent)
- Update counters via background events, not synchronous queries
- Cache tenant info in Redis (TTL: 1 hour)
- Images: must go through the processing pipeline (validate → WebP → 3 sizes → MinIO)

---

## 🚫 Forbidden Patterns

| ❌ Never Do | ✅ Instead |
|---|---|
| `any` type | Use proper TypeScript types |
| `console.log` in production code | Use NestJS Logger |
| Hardcoded connection strings | Use environment variables |
| Direct SQL queries | Use Prisma ORM |
| Storing money as Decimal/Float | Use Int (ADR-04) |
| Creating a cart table/API | Client-side localStorage |
| Creating an orders table | Use bookings table (ADR-02) |
| Calling services across modules | Emit events (ADR-05) |
| `import * from` | Named imports only |
| `moment.js` | Use `date-fns` |
| Full lodash import | Individual function imports |
| Querying without tenantId | Always scope by tenant |
| Hardcoded BD/BDT/৳ references | Use tenant's locale settings |
