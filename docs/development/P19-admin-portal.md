# P19 — SaaS Admin Portal (Full Stack)

| | |
|---|---|
| **Phase** | 7 — Admin Portal |
| **Estimated Time** | 4–5 hours |
| **Requires** | P11 (frontend foundation), P03 (auth — super_admin role) |
| **Unlocks** | P20 |

---

## REFERENCE DOCS

- `docs/features/saas-admin-portal.md` — Full admin portal spec
- `docs/api/admin.md` — Admin API endpoints
- `docs/database/tenant.md` — Tenant management
- `docs/database/subscription.md` — Subscription plans
- `docs/database/user.md` — User management

---

## SCOPE

The admin portal is for the **SaaS platform owner** (super_admin role). It manages all tenants, subscriptions, and platform health.

> Route prefix: `admin.closetrent.com` — bypasses tenant resolution middleware.

### 1. Admin Backend (API)

**Tenant management:**
- `GET /admin/tenants` — list all tenants (paginated, searchable)
- `GET /admin/tenants/:id` — tenant detail with stats
- `PATCH /admin/tenants/:id/status` — activate, suspend, cancel tenant
- `GET /admin/tenants/:id/stats` — product count, booking count, revenue, storage used

**Subscription management:**
- `GET /admin/subscriptions/plans` — list plans
- `POST /admin/subscriptions/plans` — create plan
- `PATCH /admin/subscriptions/plans/:id` — update plan
- `PATCH /admin/tenants/:id/subscription` — change tenant's plan
- `POST /admin/tenants/:id/subscription/extend` — extend subscription

**Platform stats:**
- Total tenants, active tenants, total bookings across platform
- Revenue by tenant (top earners)
- Storage usage per tenant
- System health (DB connections, Redis memory, queue depth)

**Support tools:**
- Impersonate tenant (login as owner) — generates temporary JWT
- View tenant's audit logs

### 2. Admin Frontend

**Dashboard:**
- Platform KPIs: total tenants, active tenants, MRR, total bookings
- Growth chart (new tenant signups over time)
- System health indicators

**Tenant list page:**
- Table: Store name, Subdomain, Plan, Status, Products, Bookings, Joined date
- Search by name/subdomain
- Filter by status, plan
- Actions: view detail, suspend, activate

**Tenant detail page:**
- Store info, owner info, subscription details
- Usage stats (products, bookings, storage, staff)
- Action buttons: change plan, extend subscription, suspend, impersonate

**Subscription plans page:**
- Plan list with features and limits
- Edit plan (name, price, limits)
- Create new plan

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | Admin API (tenant CRUD) | List, detail, status change |
| 2 | Subscription management API | Plans CRUD, assign to tenant |
| 3 | Platform stats API | Aggregate stats |
| 4 | Admin dashboard UI | KPIs, growth chart, health |
| 5 | Tenant management UI | List, detail, actions |
| 6 | Subscription plans UI | Plans CRUD |
| 7 | Impersonation | Login as tenant owner |
| 8 | Super_admin auth guard | Only super_admin can access /admin |
