# Feature Spec: SaaS Admin Portal

## Overview

The admin portal is the platform-level management interface. Used by us (the SaaS operators) to manage all tenants, monitor platform health, handle billing, and provide support. This is NOT accessible to business owners or customers.

---

## Access

- URL: `admin.closetrent.com`
- Authentication: Admin credentials (separate from tenant auth)
- Role: SaaS Admin (highest privilege level)
- Must have 2FA (future)

---

## Core Sections

### 1. Tenant Management

**Tenant List**:

```
Tenants (45 active)

| Business Name      | Subdomain          | Plan    | Status  | Products | Orders | Revenue    | Joined     |
|────────────────────|────────────────────|─────────|─────────|──────────|────────|────────────|────────────|
| Hana's Boutique    | hanasboutique      | Pro     | Active  | 85       | 234    | ৳1,42,000  | Jan 2026   |
| Royal Rentals      | royalrentals       | Basic   | Active  | 42       | 89     | ৳56,000    | Feb 2026   |
| Sara's Collection  | sarascollection    | Pro     | Suspended| 120     | 0      | ৳0         | Mar 2026   |
```

**Filtering**: By status, plan, date joined, activity level
**Sorting**: By revenue, products, orders, date

**Tenant Detail**:
- Business information
- Owner contact details
- Store statistics (products, orders, revenue, customers)
- Subscription & billing info
- Activity log (last login, recent actions)
- Support history

**Tenant Actions**:

| Action | Description |
|---|---|
| View Store | Open tenant's storefront in new tab |
| Suspend | Temporarily disable tenant's store |
| Reactivate | Re-enable a suspended tenant |
| Cancel | Permanently close tenant store (with data retention period) |
| Change Plan | Upgrade or downgrade subscription |
| Impersonate | Log in as tenant for support (with audit trail) |
| Send Message | Direct message to tenant owner |

### 2. Subscription & Billing

**Plan Management**:
- Define subscription plans (Free, Basic, Pro, Enterprise)
- Set features and limits per plan
- Set pricing per plan

**Plan Feature Matrix Example**:

| Feature | Free | Basic | Pro |
|---|---|---|---|
| Products | Up to 20 | Up to 100 | Unlimited |
| Custom Domain | ❌ | ✅ | ✅ |
| Staff Members | 0 | 2 | 10 |
| Analytics | Basic | Full | Full |
| SMS Notifications | ❌ | ✅ | ✅ |
| Branding ("Powered by" removed) | ❌ | ❌ | ✅ |
| Price/month | ৳0 | ৳999 | ৳2,499 |

**Billing Dashboard**:
- Total active subscriptions
- Monthly recurring revenue (MRR)
- Billing history per tenant
- Failed payments / overdue accounts

### 3. Platform Analytics

| Metric | Description |
|---|---|
| Total Tenants | Active + suspended + cancelled |
| Monthly Growth | New tenants this month |
| Total Products | Sum across all tenants |
| Total Orders | Sum across all tenants |
| Platform Revenue | Sum of subscription fees |
| GMV | Gross merchandise value (total rental revenue across all tenants) |
| Churn Rate | Tenants who cancelled ÷ total tenants |

**Charts**:
- Tenant growth over time
- MRR trend
- GMV trend
- Top tenants by revenue

### 4. Support System

**Support Tickets** (v1 — simple):
- Tenants can submit support requests from their dashboard
- Admin sees all tickets in a queue
- Priority: Low, Medium, High, Urgent
- Status: Open, In Progress, Resolved, Closed

**Tenant Impersonation**:
- Admin can "log in as" any tenant to debug issues
- All actions during impersonation are logged
- Visual indicator shown when impersonating
- Can be restricted to read-only mode

### 5. System Health

| Check | Description |
|---|---|
| Server Status | CPU, RAM, disk usage |
| Database | Connection pool, query latency, size |
| Redis | Memory usage, hit rate |
| MinIO | Storage used, available space |
| SSL Certificates | Expiry dates for all domains |
| Error Rate | 5xx errors in the last hour/day |
| Uptime | Last downtime, current uptime duration |

### 6. Feature Flags

Toggle features on/off globally or per tenant:

```
Feature Flags
──────────────────────────────────────
try-before-rent:     ✅ Enabled (global)
custom-domain:       ✅ Enabled (Pro plan only)
courier-integration: ⚠️ Beta (enabled for 5 tenants)
bengali-ui:         ❌ Disabled (in development)
```

### 7. Announcements

Send announcements to all tenants or specific groups:

```
📢 New Announcement

To: ⚪ All tenants  ⚪ Pro plan  ⚪ Specific tenants
Subject: [____________]
Message: [Rich text editor]
Type: ⚪ Info  ⚪ Update  ⚪ Maintenance  ⚪ Urgent

[Send →]
```

Announcements appear as banners in the tenant's owner portal.

---

## Admin Authentication

| Rule | Detail |
|---|---|
| Separate auth system | Admin accounts not in tenant user table |
| Strong passwords | Minimum 16 characters |
| 2FA | Required (TOTP — Google Authenticator) — future |
| Session timeout | 1 hour of inactivity |
| IP whitelist | Optional — restrict admin access to specific IPs |
| Audit log | All admin actions logged with timestamp and details |

---

## Business Rules Summary

1. Admin portal is completely separate from tenant portals
2. Admin can manage all tenants: suspend, cancel, change plans
3. Tenant impersonation available with full audit trail
4. Subscription plans define feature limits
5. Platform analytics track business health (MRR, growth, churn)
6. Feature flags allow gradual rollout of new features
7. Support system provides basic ticket management
8. All admin actions are audited
