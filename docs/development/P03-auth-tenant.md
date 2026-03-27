# P03 — Auth & Tenant System

| | |
|---|---|
| **Phase** | 1 — Foundation |
| **Estimated Time** | 4–5 hours |
| **Requires** | P02 (database schema, Prisma client) |
| **Unlocks** | P04, P05, P06, P10, P19 |

---

## REFERENCE DOCS

**Cross-cutting:** All 12 cross-cutting docs from `_overview.md`

**Feature specs:**
- `docs/features/multi-tenant.md` — Tenant resolution, data isolation
- `docs/features/session-management.md` — Sessions, device tracking, login history
- `docs/features/staff-access.md` — Roles and permissions

**Security:**
- `docs/security/authentication.md` — JWT strategy, token TTLs
- `docs/security/data-isolation.md` — Tenant data isolation rules
- `docs/security/input-validation.md` — Validation pipeline

**API:**
- `docs/api/_overview.md` — API conventions, error format
- `docs/api/auth.md` — Auth endpoints
- `docs/api/tenant.md` — Tenant endpoints

**Database:**
- `docs/database/tenant.md` — tenants + store_settings tables
- `docs/database/user.md` — users + tenant_users tables

**Flows:**
- `docs/flows/tenant-onboarding-flow.md` — Registration → store live

---

## SCOPE

Build the complete authentication and multi-tenant system. After this package, any request can be authenticated, resolved to a tenant, and authorized by role.

### 1. Tenant Resolution Middleware

```typescript
// Every request goes through this middleware
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  // 1. Read Host header
  // 2. Look up tenant by custom_domain OR subdomain
  // 3. Attach tenant context to request
  // 4. If no tenant found → 404 "Store not found"
  // 5. If tenant suspended/cancelled → 403
  // 6. Cache tenant info in Redis (TTL: 1 hour)
}
```

**Exclusions:** Admin portal routes (`admin.closetrent.com`) bypass tenant middleware.

### 2. Auth Module

**Registration endpoint** (`POST /auth/register`):
- Create User (role: owner)
- Create Tenant (subdomain, business_name, country)
- Create TenantUser junction (user ↔ tenant, role: owner)
- Create StoreSettings (locale defaults from country)
- Seed starter template (categories, events from `seed-data.md`)
- Create Subscription (free plan)
- Create Session + return JWT tokens

**Login endpoint** (`POST /auth/login`):
- Validate credentials (bcrypt)
- Check if user belongs to tenant (via TenantUser)
- Create Session record (IP, user-agent, device info)
- Track login history (device type, browser, OS, location)
- Issue JWT access token (15 min) + refresh token (7 days)
- JWT payload: `{ userId, tenantId, sessionId, role }`

**Token refresh** (`POST /auth/refresh`):
- Validate refresh token
- Check session still active (not revoked)
- Issue new access + refresh tokens
- Rotate session token

**Logout** (`POST /auth/logout`):
- Revoke current session
- Clear refresh token

**Password reset** (`POST /auth/forgot-password`, `POST /auth/reset-password`):
- Generate reset token (UUID, 1-hour expiry)
- Validate token and set new password

### 3. JWT Strategy (Passport)

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  // Extract JWT from Authorization header
  // Validate: check session exists and is active
  // Attach user context to request: { userId, tenantId, sessionId, role }
}
```

**Token config:**
- Access token: 15 minutes, HTTP-only cookie or Authorization header
- Refresh token: 7 days, stored in DB

### 4. Auth Guard

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Validates JWT on protected routes
  // Returns 401 if invalid/expired
}
```

### 5. Tenant Guard

```typescript
@Injectable()
export class TenantGuard implements CanActivate {
  // Ensures the authenticated user belongs to the current tenant
  // Compares JWT.tenantId with request.tenant.id
  // Returns 403 if mismatch
}
```

### 6. Role Guard

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  // Checks @Roles() decorator metadata
  // Compares user's role against required roles
  // Roles: super_admin, owner, manager, staff
}

// Usage:
@Roles('owner', 'manager')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
```

### 7. Session Management

**Active sessions CRUD:**
- `GET /auth/sessions` — List all active sessions for current user
- `DELETE /auth/sessions/:id` — Revoke specific session
- `DELETE /auth/sessions` — Revoke all sessions except current

**Max concurrent sessions:** Configurable per tenant in `store_settings.max_concurrent_sessions` (default: 5). When exceeded on new login, oldest session is revoked.

**Session schema fields:** id, userId, tenantId, ipAddress, userAgent, deviceType, browser, os, location, isActive, lastActiveAt, expiresAt, createdAt

### 8. Login History

- Record every login attempt (success + failure)
- Track: IP, device, browser, OS, location, timestamp, success/failure
- `GET /auth/login-history` — paginated list

### 9. Prisma Middleware for Tenant Isolation

```typescript
// Ensure every tenant-scoped query includes tenant_id
prisma.$use(async (params, next) => {
  const tenantModels = ['Product', 'Booking', 'Customer', ...];
  if (tenantModels.includes(params.model)) {
    // Auto-inject tenantId filter on findMany, findFirst, update, delete
    // Auto-inject tenantId on create
  }
  return next(params);
});
```

### 10. Global Exception Filter

```typescript
// Standardized error response format per docs/api/_overview.md
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": { "phone": ["Invalid phone number"] }
  }
}
```

### 11. Global Validation Pipe

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true }
}));
```

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | Tenant resolution middleware | Request to `store1.localhost:4000/api/health` resolves tenant |
| 2 | Registration endpoint | `POST /auth/register` creates user + tenant + store + tokens |
| 3 | Login endpoint | `POST /auth/login` returns JWT + creates session |
| 4 | Token refresh | `POST /auth/refresh` issues new tokens |
| 5 | Logout | `POST /auth/logout` revokes session |
| 6 | Password reset flow | Forgot + reset with token |
| 7 | JWT auth guard | Protected routes require valid JWT |
| 8 | Tenant guard | Users can't access other tenants' data |
| 9 | Role guard with `@Roles()` decorator | Endpoint-level role checks |
| 10 | Session management CRUD | List, revoke, revoke-all |
| 11 | Login history | Recorded and queryable |
| 12 | Prisma tenant isolation middleware | Auto-scoping queries |
| 13 | Global exception filter | Consistent error responses |
| 14 | Global validation pipe | DTO validation on all endpoints |

---

## ACCEPTANCE CRITERIA

```bash
# Registration flow
POST /auth/register → creates tenant + user → returns tokens
# The new tenant's subdomain resolves

# Login flow
POST /auth/login → returns { accessToken, refreshToken }
# JWT contains userId, tenantId, sessionId, role

# Auth protection
GET /api/v1/protected → 401 without token
GET /api/v1/protected → 200 with valid token

# Tenant isolation
# User from tenant-A cannot access tenant-B data

# Role protection
# Staff cannot access owner-only endpoints

# Session management
GET /auth/sessions → lists active sessions
DELETE /auth/sessions/:id → revokes session, token becomes invalid
```

---

## OUTPUT CONTRACTS

| Contract | Used By |
|---|---|
| `TenantMiddleware` — resolves tenant on every request | All backend packages |
| `JwtAuthGuard` — protects routes | P04–P10, P19 |
| `TenantGuard` — ensures tenant isolation | P04–P10, P19 |
| `RolesGuard` + `@Roles()` decorator | P04–P10, P19 |
| `@CurrentUser()` decorator — extracts user from request | P04–P10 |
| `@CurrentTenant()` decorator — extracts tenant from request | P04–P10 |
| Auth endpoints (register, login, refresh, logout) | P11, P12, P17–P19 |
| Session management API | P16 |
| Prisma tenant isolation middleware | P04–P10 |
| Global error response format | All packages |
