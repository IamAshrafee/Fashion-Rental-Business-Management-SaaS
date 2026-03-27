# Security: Authorization

## Role-Based Access Control (RBAC)

### Roles

| Role | Scope | Description |
|---|---|---|
| `saas_admin` | Platform-wide | ClosetRent platform administrator |
| `owner` | Per-tenant | Business owner, full tenant access |
| `manager` | Per-tenant | Near-full access, no billing/staff |
| `staff` | Per-tenant | Limited operational access |

### Permission Matrix

| Action | Owner | Manager | Staff | Guest |
|---|---|---|---|---|
| View products | ✅ | ✅ | ✅ (public only) | ✅ (public) |
| Create/edit products | ✅ | ✅ | ❌ | ❌ |
| Delete products | ✅ | ❌ | ❌ | ❌ |
| View bookings | ✅ | ✅ | ✅ | ❌ |
| Update booking status | ✅ | ✅ | ✅ | ❌ |
| Cancel bookings | ✅ | ✅ | ❌ | ❌ |
| Record payments | ✅ | ✅ | ❌ | ❌ |
| Process deposits | ✅ | ✅ | ❌ | ❌ |
| Report damage | ✅ | ✅ | ❌ | ❌ |
| View customers | ✅ | ✅ | ✅ | ❌ |
| View analytics | ✅ | ✅ | ❌ | ❌ |
| View internal prices | ✅ | ✅ | ✅ | ❌ |
| Store settings | ✅ | ❌ | ❌ | ❌ |
| Payment config | ✅ | ❌ | ❌ | ❌ |
| Manage staff | ✅ | ❌ | ❌ | ❌ |
| Billing/subscription | ✅ | ❌ | ❌ | ❌ |
| Place booking (guest) | ❌ | ❌ | ❌ | ✅ |

---

## Implementation

### Roles Guard (NestJS)

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return requiredRoles.includes(user.role);
  }
}
```

### Usage

```typescript
@Controller('owner/products')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ProductController {

  @Post()
  @Roles('owner', 'manager')
  create() { ... }

  @Delete(':id')
  @Roles('owner')
  delete() { ... }

  @Get()
  @Roles('owner', 'manager', 'staff')
  list() { ... }
}
```

---

## Route Protection Strategy

| Route Pattern | Auth | Roles | Tenant |
|---|---|---|---|
| `/api/v1/products` (GET) | None | None | Auto from Host |
| `/api/v1/owner/*` | JWT | owner, manager, staff | JWT tenantId |
| `/api/v1/admin/*` | JWT | saas_admin | N/A |
| `/api/v1/auth/*` | None/JWT | None | N/A |

---

## Admin Impersonation

SaaS admins can impersonate tenant owners for debugging:

- Generates a scoped token with `impersonated: true` flag
- All actions logged with `source: "admin_impersonation"`
- Token expires in 1 hour
- Cannot change billing or delete data while impersonating
