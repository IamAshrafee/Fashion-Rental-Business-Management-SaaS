# Security: Data Isolation (Multi-Tenant)

## Strategy

Row-Level Security (RLS) via application-layer enforcement. Every tenant's data is isolated by `tenant_id` on every query.

---

## Isolation Layers

### Layer 1: Middleware (Tenant Resolution)

```typescript
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  async use(req, res, next) {
    const host = req.headers.host; // e.g., hanasboutique.closetrent.com.bd
    const subdomain = host.split('.')[0];

    const tenant = await this.tenantService.findBySubdomainOrDomain(subdomain, host);
    if (!tenant) throw new NotFoundException('Store not found');

    req.tenantId = tenant.id;
    next();
  }
}
```

### Layer 2: Prisma Query Extension

All queries automatically scoped:

```typescript
const prisma = new PrismaClient().$extends({
  query: {
    $allOperations({ args, query, model }) {
      // Auto-inject tenant_id WHERE clause
      if (tenantScopedModels.includes(model)) {
        args.where = { ...args.where, tenantId: currentTenantId };
      }
      return query(args);
    }
  }
});
```

### Layer 3: Service Layer Validation

Every service method explicitly checks tenant ownership:

```typescript
async getProduct(productId: string, tenantId: string) {
  const product = await this.prisma.product.findFirst({
    where: { id: productId, tenantId: tenantId }
  });
  if (!product) throw new NotFoundException();
  return product;
}
```

### Layer 4: Guard Verification

JWT `tenantId` must match the resolved tenant from the Host header:

```typescript
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return request.user.tenantId === request.tenantId;
  }
}
```

---

## Data Isolation Matrix

| Data | Isolation | Method |
|---|---|---|
| Products | Per-tenant | `tenant_id` on every query |
| Bookings | Per-tenant | `tenant_id` on every query |
| Customers | Per-tenant | `tenant_id` + phone unique per tenant |
| Images (MinIO) | Per-tenant | Bucket path: `/tenant-{id}/...` |
| Cache (Redis) | Per-tenant | Key prefix: `tenant:{id}:...` |
| Colors | Shared + tenant | System colors shared, custom colors per tenant |
| Users | Global | Users are global, linked to tenants via `tenant_users` |

---

## Common Attack Vectors & Mitigations

| Vector | Mitigation |
|---|---|
| IDOR (Insecure Direct Object Reference) | Always include `tenantId` in WHERE clauses |
| API parameter tampering | Ignore `tenantId` from request body; always use JWT/middleware |
| Cross-tenant data access | Triple-layer validation (middleware + Prisma + service) |
| Admin endpoint abuse | Separate admin routes with platform-level auth |
| Cache poisoning | Tenant-prefixed Redis keys; never share cache between tenants |
| File access | MinIO paths scoped by tenant ID; no direct URL guessing |

---

## Testing for Isolation

Every integration test must verify:

1. Tenant A cannot read Tenant B's products
2. Tenant A cannot modify Tenant B's bookings
3. API with Tenant A's token cannot access Tenant B's subdomain
4. Search results never include cross-tenant data
