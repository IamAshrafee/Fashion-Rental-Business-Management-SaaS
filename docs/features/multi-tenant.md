# Feature Spec: Multi-Tenant Architecture

## Overview

Every business on the platform is a "tenant" with a completely isolated store. Tenants share the same codebase and database but never see each other's data. This spec covers how tenant isolation works at every level.

For the broader architecture context, see [architecture.md](../architecture.md).

---

## Tenant Identification

### How the System Knows Which Tenant

Every request is resolved to a tenant based on the **Host header**:

```
Request: GET https://hanasboutique.closetrent.com/products
Host header: hanasboutique.closetrent.com
  → Extract subdomain: "hanasboutique"
  → Look up in tenants table: WHERE subdomain = 'hanasboutique'
  → Found: tenant_id = "abc-123"
  → Attach to request context
  → All queries scoped: WHERE tenant_id = 'abc-123'
```

### Resolution Priority

1. **Custom domain match**: `SELECT * FROM tenants WHERE custom_domain = 'rentbysara.com'`
2. **Subdomain match**: `SELECT * FROM tenants WHERE subdomain = 'hanasboutique'`
3. **No match**: Return 404 — "Store not found"

---

## Tenant Entity

### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| id | UUID | Auto | Unique tenant identifier |
| businessName | String | Yes | Display name of the business |
| subdomain | String | Yes | Unique subdomain slug |
| customDomain | String | No | Custom domain (see [custom-domain.md](./custom-domain.md)) |
| ownerUserId | UUID | Yes | The primary owner's user ID |
| status | Enum | Yes | Active, Suspended, Cancelled |
| plan | Enum | Yes | Subscription plan tier |
| createdAt | Timestamp | Auto | Sign-up date |

### Tenant Statuses

| Status | Effect |
|---|---|
| **Active** | Store is live, all features available |
| **Suspended** | Store is temporarily disabled (billing issue, policy violation). Guest portal shows "Store temporarily unavailable". |
| **Cancelled** | Store is permanently closed. Data retained for 30 days, then deleted. |

---

## Data Isolation

### Database Level

Every tenant-scoped table includes a `tenant_id` column.

**Tables with tenant_id**:
- products, variants, images
- categories, subcategories, events
- bookings, booking_items
- orders
- customers
- payments
- notifications
- damage_reports
- store_settings

**Tables WITHOUT tenant_id** (global):
- users (a user can own multiple tenants)
- system_colors (global color palette)
- subscription_plans
- saas_admin_settings

### Query Enforcement

**NestJS Guard** (`TenantGuard`):
1. Extracts hostname from request
2. Resolves tenant from database (cached in Redis)
3. Attaches `tenantId` to the request object
4. If no tenant found → throws `NotFoundException`

**Service Layer**:
Every service method that touches tenant data MUST accept `tenantId` as the first parameter:

```typescript
async findProducts(tenantId: string, query: ProductQueryDto): Promise<Product[]> {
  return this.prisma.product.findMany({
    where: { tenantId, ...filters },
  });
}
```

**Prisma Middleware** (defense in depth):
A Prisma middleware that automatically injects `tenant_id` into all queries when tenant context is available. This is a safety net — the primary guard is at the service level.

### Storage Level (MinIO)

Files are isolated by tenant prefix:
```
/tenant-{id}/products/...
/tenant-{id}/branding/...
```

File access URLs include the tenant prefix. No cross-tenant file access possible.

### Cache Level (Redis)

All cache keys include tenant ID:
```
tenant:{id}:products:list
tenant:{id}:product:{productId}
tenant:{id}:categories
tenant:{id}:info
```

---

## Tenant Onboarding Flow

### Sign Up

1. Owner visits main website → clicks "Start Free Trial" / "Sign Up"
2. Fills out:
   - Full Name
   - Email
   - Phone Number
   - Password
   - Business Name
   - Preferred Subdomain (auto-suggested from business name)
3. System validates subdomain availability
4. Creates: User account + Tenant record + default data seeding
5. Redirects to owner portal setup wizard

### Setup Wizard (First-Time Owner)

Step-by-step onboarding after account creation:

```
Step 1: Upload your logo
Step 2: Set your brand colors
Step 3: Add your contact info & social links
Step 4: Add your first product
Step 5: Preview your store
Step 6: Go live!
```

Each step is optional — owner can skip and complete later.

### Default Data Seeding

When a new tenant is created, seed:
- Default categories (Saree, Lehenga, Sherwani, etc.)
- Default subcategories
- Default events (Wedding, Holud, Reception, etc.)
- Default color palette (global)
- Default store settings

---

## Subdomain Rules

| Rule | Detail |
|---|---|
| Characters | Lowercase letters, numbers, hyphens only |
| Length | 3-30 characters |
| Start/end | Must start and end with a letter or number |
| Reserved | Cannot use: admin, api, www, app, dashboard, cdn, mail, blog |
| Uniqueness | Must be unique across all tenants |
| Changeability | Can be changed by owner (redirect from old subdomain for 30 days) |

---

## Cross-Tenant Concerns

### What Is Shared Across Tenants

| Resource | Shared? | Isolation |
|---|---|---|
| Application code | Yes | Same codebase serves all tenants |
| Database server | Yes | Same DB, `tenant_id` isolation |
| Redis server | Yes | Key-prefixed isolation |
| MinIO server | Yes | Path-prefixed isolation |
| SSL certificate | Yes | Wildcard cert for subdomains |
| Color palette | Yes | Global defaults (tenants can add custom) |

### What Must NEVER Leak

- Products from one tenant appearing in another's store
- Customer data accessible by another tenant
- Booking details visible to wrong tenant
- File URLs accessible without tenant context
- Cached data served to wrong tenant

---

## Business Rules Summary

1. Every tenant has a unique subdomain and optional custom domain
2. Tenant resolved from Host header on every request
3. All database queries must include tenant_id
4. Storage, cache, and file access are all tenant-isolated
5. New tenants get seeded default data (categories, events, etc.)
6. Tenant statuses: Active, Suspended, Cancelled
7. Subdomain changes are supported with temporary redirect
8. Defense in depth: Guards + Service layer + Prisma middleware
