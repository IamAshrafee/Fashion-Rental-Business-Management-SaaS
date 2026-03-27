# API Design: SaaS Admin Module

## Overview

Admin API is accessed via `admin.closetrent.com/api/v1/admin/`. Requires `UserRole.saas_admin` authentication.

---

## Tenant Management

### GET `/api/v1/admin/tenants`

List all tenants.

**Auth**: Admin token

**Query Params**:
| Param | Type | Description |
|---|---|---|
| `status` | string | active, suspended, cancelled |
| `plan` | string | Plan slug filter |
| `search` | string | Search by business name or subdomain |
| `sort` | string | `created_at`, `revenue`, `products`, `orders` |

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "businessName": "Hana's Boutique",
      "subdomain": "hanasboutique",
      "plan": "Pro",
      "status": "active",
      "productCount": 85,
      "orderCount": 234,
      "totalRevenue": 142000,
      "ownerName": "Hana Rahman",
      "ownerPhone": "01712345678",
      "createdAt": "2026-01-15"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 45 }
}
```

### GET `/api/v1/admin/tenants/:id`

Detailed tenant view.

### PATCH `/api/v1/admin/tenants/:id/status`

Change tenant status.

**Request Body**:
```json
{
  "status": "suspended",
  "reason": "Payment overdue"
}
```

### PATCH `/api/v1/admin/tenants/:id/plan`

Change tenant subscription plan.

**Request Body**:
```json
{
  "planId": "...",
  "billingCycle": "monthly"
}
```

---

## Platform Analytics

### GET `/api/v1/admin/analytics/platform`

Platform-wide metrics.

**Auth**: Admin token

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "tenants": { "total": 45, "active": 40, "newThisMonth": 5 },
    "mrr": 89500,
    "gmv": 1250000,
    "churnRate": 2.2,
    "totalProducts": 3200,
    "totalOrders": 8500
  }
}
```

### GET `/api/v1/admin/analytics/growth`

Tenant growth time series.

---

## Subscription Plans

### GET `/api/v1/admin/plans`

List all subscription plans.

### POST `/api/v1/admin/plans`

Create a new plan.

### PATCH `/api/v1/admin/plans/:id`

Update plan details.

---

## Feature Flags

### GET `/api/v1/admin/feature-flags`

List all feature flags.

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "key": "try-before-rent",
      "enabled": true,
      "scope": "global",
      "enabledForTenants": []
    },
    {
      "key": "bengali-ui",
      "enabled": false,
      "scope": "disabled",
      "enabledForTenants": []
    },
    {
      "key": "courier-integration",
      "enabled": true,
      "scope": "specific",
      "enabledForTenants": ["tenant-1", "tenant-2"]
    }
  ]
}
```

### PATCH `/api/v1/admin/feature-flags/:key`

Toggle a feature flag.

**Request Body**:
```json
{
  "enabled": true,
  "scope": "specific",
  "tenantIds": ["tenant-1", "tenant-2"]
}
```

---

## Announcements

### POST `/api/v1/admin/announcements`

Send announcement to tenants.

**Request Body**:
```json
{
  "target": "all",
  "tenantIds": [],
  "subject": "Scheduled Maintenance",
  "message": "We'll be performing maintenance on April 20th...",
  "type": "maintenance"
}
```

---

## Support

### GET `/api/v1/admin/support/tickets`

List support tickets.

### PATCH `/api/v1/admin/support/tickets/:id`

Update ticket status.

---

## Impersonation

### POST `/api/v1/admin/tenants/:id/impersonate`

Generate impersonation token.

**Auth**: Admin token

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "impersonationToken": "eyJhbG...",
    "tenantId": "...",
    "businessName": "Hana's Boutique",
    "expiresIn": 3600
  }
}
```

All actions taken with this token are logged with `source: "admin_impersonation"` in the audit trail.
