# API Design — Overview

## Conventions

### Base URL

```
https://{subdomain}.closetrent.com.bd/api/v1
```

Custom domains also work: `https://rentbysara.com/api/v1`

### Authentication

| Method | Use Case |
|---|---|
| JWT Bearer Token | Owner portal, staff portal, admin portal |
| No auth | Guest-facing endpoints (product listing, search, checkout) |

Token format: `Authorization: Bearer <jwt_token>`

JWT payload:
```json
{
  "sub": "user-uuid",
  "tenantId": "tenant-uuid",
  "role": "owner",
  "sessionId": "session-uuid",
  "iat": 1711519200,
  "exp": 1711520100
}
```

Access token TTL: **15 minutes** (stateless). Refresh token TTL: **7 days** (httpOnly cookie, DB-backed). See [session-management.md](../features/session-management.md).

### Tenant Resolution

Every request is automatically scoped to a tenant via the `Host` header. The API never requires manually passing `tenant_id` — it's extracted by middleware.

### Request Format

- Content-Type: `application/json`
- File uploads: `multipart/form-data`
- Query params for GET filters: `?page=1&limit=20&sort=created_at&order=desc`

### Response Format

**Success**:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 85,
    "pages": 5
  }
}
```

**Error**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Phone number is required",
    "details": [
      { "field": "phone", "message": "Phone number is required" }
    ]
  }
}
```

### Error Codes

| HTTP Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Duplicate or conflicting state |
| 422 | `UNPROCESSABLE` | Business rule violation |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

### Pagination

All list endpoints support:

| Param | Default | Max | Description |
|---|---|---|---|
| `page` | 1 | — | Page number |
| `limit` | 20 | 100 | Items per page |
| `sort` | `created_at` | — | Sort field |
| `order` | `desc` | — | `asc` or `desc` |

### Rate Limiting

| Endpoint Type | Limit |
|---|---|
| Guest endpoints | 60 req/min per IP |
| Authenticated endpoints | 120 req/min per user |
| File uploads | 10 req/min per user |
| Auth endpoints | 10 req/min per IP |

---

## API Module Index

| Module | File | Auth Required | Description |
|---|---|---|---|
| Auth | [auth.md](./auth.md) | Partial | Registration, login, tokens |
| Tenant | [tenant.md](./tenant.md) | Yes | Tenant settings, branding |
| Product | [product.md](./product.md) | Mixed | Product CRUD |
| Category | [category.md](./category.md) | Mixed | Category management |
| Inventory | [inventory.md](./inventory.md) | Mixed | Availability checking |
| Booking | [booking.md](./booking.md) | Mixed | Booking creation and management (unified entity — no separate orders) |
| Customer | [customer.md](./customer.md) | Yes | Customer management |
| Session | [../features/session-management.md](../features/session-management.md) | Yes | Active sessions, login history, revocation |
| Payment | [payment.md](./payment.md) | Mixed | Payment processing |
| Search | [search.md](./search.md) | No | Search and filter |
| Upload | [upload.md](./upload.md) | Yes | File uploads |
| Notification | [notification.md](./notification.md) | Yes | Notification management |
| Analytics | [analytics.md](./analytics.md) | Yes | Dashboard data |
| Admin | [admin.md](./admin.md) | Yes (Admin) | SaaS admin operations |

### Endpoint Naming Convention

```
GET    /api/v1/products          → List
GET    /api/v1/products/:id      → Get one
POST   /api/v1/products          → Create
PATCH  /api/v1/products/:id      → Update
DELETE /api/v1/products/:id      → Delete
```

### NestJS Module Structure

```
src/
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   └── dto/
│   ├── product/
│   │   ├── product.controller.ts
│   │   ├── product.service.ts
│   │   └── ...
│   └── ...
├── guards/
│   ├── jwt-auth.guard.ts
│   ├── tenant.guard.ts
│   └── roles.guard.ts
└── interceptors/
    ├── response.interceptor.ts
    └── tenant.interceptor.ts
```
