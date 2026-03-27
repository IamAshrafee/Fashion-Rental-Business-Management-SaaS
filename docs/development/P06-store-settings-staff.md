# P06 — Store Settings & Staff Management (Backend)

| | |
|---|---|
| **Phase** | 2 — Core Business Modules |
| **Estimated Time** | 3–4 hours |
| **Requires** | P03 (auth, guards, tenant middleware) |
| **Unlocks** | P12, P16 |

---

## REFERENCE DOCS

- `docs/features/business-branding.md` — Store branding (colors, logo, social links)
- `docs/features/custom-domain.md` — Custom domain management
- `docs/features/localization.md` — Locale configuration
- `docs/features/staff-access.md` — Staff roles and permissions
- `docs/database/tenant.md` — tenants + store_settings tables
- `docs/database/user.md` — users + tenant_users tables
- `docs/database/subscription.md` — subscription plans
- `docs/api/tenant.md` — Tenant/store settings endpoints
- `docs/localization-strategy.md` — Locale implementation details

---

## SCOPE

### 1. Store Settings Module

**Branding settings:**
- Update primary/secondary colors
- Upload/update logo (via MinIO upload service)
- Upload/update favicon
- Update tagline, about text
- Social links (Facebook, Instagram, TikTok, YouTube)

**Contact info:**
- Update phone, WhatsApp, email, address

**Locale settings:**
- Update timezone, country, currency (code, symbol, position)
- Update date/time format, number format, week start
- Update default language

**Payment settings:**
- Update bKash/Nagad numbers
- Update SSLCommerz credentials (store_id, store_pass)
- Toggle SSLCommerz sandbox mode

**Courier settings:**
- Update default courier, API keys
- Update pickup address

**Operational settings:**
- Update max_concurrent_sessions
- Update buffer_days (gap between bookings)

**Get store settings:**
- `GET /api/v1/store/settings` — full settings (owner only)
- `GET /api/v1/store/public` — public store info (for storefront: colors, logo, social, tagline, contact)

### 2. Staff Management Module

**Invite staff:**
- Owner invites staff by phone/email
- Create user account (if new) or link existing
- Create TenantUser junction (role: staff or manager)
- Send invitation SMS/notification

**Update staff:**
- Change role (staff ↔ manager)
- Update permissions

**Remove staff:**
- Remove TenantUser junction (not delete user)
- Revoke all sessions for this user-tenant pair

**List staff:**
- `GET /api/v1/staff` — list all staff for tenant
- Includes: name, role, last active, status

**Role permissions matrix:**

| Permission | Owner | Manager | Staff |
|---|---|---|---|
| Manage products | ✓ | ✓ | ✓ |
| Manage bookings | ✓ | ✓ | ✓ |
| View customers | ✓ | ✓ | ✓ |
| Manage customers | ✓ | ✓ | ✗ |
| View analytics | ✓ | ✓ | ✗ |
| Manage settings | ✓ | ✗ | ✗ |
| Manage staff | ✓ | ✗ | ✗ |
| Billing & subscription | ✓ | ✗ | ✗ |

### 3. Subscription Module

- `GET /api/v1/subscription` — current plan details
- Plan limits enforcement middleware (max products, max staff, etc.)
- Subscription status check (active, trial, expired, grace period)

### 4. Custom Domain Module

- `POST /api/v1/store/domain` — set custom domain
- `DELETE /api/v1/store/domain` — remove custom domain
- Domain validation (DNS check)
- SSL provisioning notes (Let's Encrypt via Nginx)

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | Store settings CRUD API | Update and retrieve all settings |
| 2 | Public store info endpoint | Returns branding info for storefront |
| 3 | Staff invite/remove/update | Full staff lifecycle |
| 4 | Role permissions check | Middleware enforces permission matrix |
| 5 | Subscription status | Plan limits enforced |
| 6 | Custom domain CRUD | Set and remove custom domain |
| 7 | Locale configuration | All locale fields settable |

---

## OUTPUT CONTRACTS

| Contract | Used By |
|---|---|
| Store public info API | P17 (Guest storefront — branding, colors, contact) |
| Store settings API | P16 (Owner Settings UI) |
| Staff CRUD API | P16 (Owner Staff UI) |
| Role permissions middleware | All backend packages (authorization) |
| Locale config retrieval | P11–P18 (frontend locale formatting) |
| Subscription limits check | P04 (product limits), P03 (session limits) |
