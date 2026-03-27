# Feature Spec: Staff Access

## Overview

Business owners can add staff members (e.g., salespersons, managers) who help manage the store. Staff have limited access compared to the owner — they can view and manage day-to-day operations but cannot change critical settings.

---

## Roles

| Role | Description | Access Level |
|---|---|---|
| **Owner** | Business owner, full access | Everything |
| **Manager** | Senior staff, most access | Everything except billing and dangerous settings |
| **Staff / Salesperson** | Day-to-day operations | Orders, products (view + limited edit), customers |

---

## Permissions Matrix

| Feature | Owner | Manager | Staff |
|---|---|---|---|
| **Products** - View | ✅ | ✅ | ✅ |
| **Products** - Add/Edit | ✅ | ✅ | ❌ |
| **Products** - Delete | ✅ | ❌ | ❌ |
| **Products** - See internal prices (min price) | ✅ | ✅ | ✅ |
| **Products** - See purchase price | ✅ | ✅ | ❌ |
| **Orders** - View all | ✅ | ✅ | ✅ |
| **Orders** - Change status | ✅ | ✅ | ✅ |
| **Orders** - Modify prices | ✅ | ✅ | ❌ |
| **Orders** - Process refund | ✅ | ✅ | ❌ |
| **Customers** - View | ✅ | ✅ | ✅ |
| **Customers** - Add notes | ✅ | ✅ | ✅ |
| **Analytics** - View | ✅ | ✅ | ❌ |
| **Store Settings** | ✅ | ❌ | ❌ |
| **Payment Settings** | ✅ | ❌ | ❌ |
| **Staff Management** | ✅ | ❌ | ❌ |
| **Subscription/Billing** | ✅ | ❌ | ❌ |

---

## Staff Management (Owner Portal)

### Adding Staff

```
👥 Staff Members

[+ Add Staff Member]

──────────────────────────
Rashid Ahmed | Manager | rashid@email.com | Active
Ayesha Khan  | Staff   | 01712345678     | Active
──────────────────────────
```

### Add Staff Form

| Field | Type | Required |
|---|---|---|
| Name | Text | Yes |
| Phone Number | Text | Yes |
| Email | Text | No |
| Role | Dropdown (Manager / Staff) | Yes |
| Password | Text (auto-generated or manual) | Yes |

### Staff Login

Staff log in to the owner portal using their credentials:
- Phone number or email + password
- System determines their tenant from their user record
- Dashboard shows only what their role permits

### Staff Actions

| Action | Description |
|---|---|
| Activate / Deactivate | Temporarily disable access without deleting |
| Change Role | Promote/demote staff member |
| Reset Password | Generate new password for staff |
| Remove | Permanently remove staff access |

---

## Internal Price Visibility

A key reason for staff access is the **internal minimum price** feature:

- When a staff member views a product, they see:
  ```
  Rental Price: ৳7,500
  Minimum (internal): ৳5,000
  ```
- This tells the salesperson: "You can negotiate down to ৳5,000 but not lower"
- Purchase price is hidden from Staff role (only visible to Owner and Manager)

---

## Audit Trail

All staff actions are logged:

| Log Entry | Data |
|---|---|
| Who | Staff member name and ID |
| What | Action performed (e.g., "Changed order status") |
| When | Timestamp |
| Details | Order ID, old status → new status |

Owner can review staff activity logs from the dashboard.

---

## Business Rules Summary

1. Owner has full access — cannot be restricted
2. Manager has operational access minus billing and critical settings
3. Staff has day-to-day access: view products, manage orders, see internal prices
4. Staff cannot delete products, modify prices, or access analytics
5. Staff authenticated via phone/email + password
6. Owner can activate/deactivate/remove staff at any time
7. All staff actions are logged for accountability
8. Staff are tenant-scoped — access only their assigned store
