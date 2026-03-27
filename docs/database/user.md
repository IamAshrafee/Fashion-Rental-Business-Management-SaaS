# Database Schema: `users`

## Overview

Users represent anyone who can log in: business owners, staff members, and SaaS admins. Users are **global** (not tenant-scoped) because one person can own multiple tenants or be staff at multiple stores.

Tenant membership is established via the `tenant_users` junction table.

---

## Table: `users`

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `full_name` | VARCHAR(200) | No | — | User's display name |
| `email` | VARCHAR(255) | Yes | `NULL` | Email address (unique if provided) |
| `phone` | VARCHAR(20) | Yes | `NULL` | Phone number |
| `password_hash` | VARCHAR(255) | No | — | bcrypt hashed password |
| `role` | ENUM | No | `'owner'` | Global role type |
| `is_active` | BOOLEAN | No | `true` | Account active status |
| `last_login_at` | TIMESTAMP | Yes | `NULL` | Last login timestamp |
| `created_at` | TIMESTAMP | No | `NOW()` | Created timestamp |
| `updated_at` | TIMESTAMP | No | `NOW()` | Last updated |

### Enums

```prisma
enum UserRole {
  saas_admin
  owner
  manager
  staff
}
```

### Indexes

| Index | Columns | Type | Purpose |
|---|---|---|---|
| `users_email_key` | `email` | UNIQUE (where not null) | Email lookup |
| `users_phone_idx` | `phone` | INDEX | Phone lookup |

---

## Table: `tenant_users`

Junction table linking users to tenants with their role at that specific tenant.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `user_id` | UUID | No | — | FK → `users.id` |
| `role` | ENUM | No | — | Role at this tenant (owner/manager/staff) |
| `is_active` | BOOLEAN | No | `true` | Active at this tenant |
| `created_at` | TIMESTAMP | No | `NOW()` | Joined date |
| `updated_at` | TIMESTAMP | No | `NOW()` | Last updated |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `tenant_users_tenant_user_key` | `tenant_id, user_id` | UNIQUE |
| `tenant_users_tenant_id_idx` | `tenant_id` | INDEX |
| `tenant_users_user_id_idx` | `user_id` | INDEX |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `tenant` | belongs-to | `tenants` |
| `user` | belongs-to | `users` |

---

## Prisma Models

```prisma
model User {
  id            String       @id @default(uuid())
  fullName      String       @map("full_name")
  email         String?      @unique
  phone         String?
  passwordHash  String       @map("password_hash")
  role          UserRole     @default(owner)
  isActive      Boolean      @default(true) @map("is_active")
  lastLoginAt   DateTime?    @map("last_login_at")
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")

  ownedTenants  Tenant[]
  tenantUsers   TenantUser[]
  auditLogs     AuditLog[]

  @@map("users")
}

model TenantUser {
  id        String     @id @default(uuid())
  tenantId  String     @map("tenant_id")
  userId    String     @map("user_id")
  role      TenantRole
  isActive  Boolean    @default(true) @map("is_active")
  createdAt DateTime   @default(now()) @map("created_at")
  updatedAt DateTime   @updatedAt @map("updated_at")

  tenant    Tenant     @relation(fields: [tenantId], references: [id])
  user      User       @relation(fields: [userId], references: [id])

  @@unique([tenantId, userId])
  @@map("tenant_users")
}

enum TenantRole {
  owner
  manager
  staff
}
```

---

## Notes

- `UserRole` is the global system role (saas_admin vs regular user)
- `TenantRole` is the per-tenant role (owner/manager/staff)
- A user with `UserRole.saas_admin` can access the SaaS admin portal
- Password hashed with bcrypt (12 salt rounds)
- Email is optional because in Bangladesh, phone is more common than email
