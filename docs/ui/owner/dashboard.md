# UI Spec: Owner Dashboard

## Overview

Landing page after owner/staff login. Shows business health at a glance with quick actions.

**Route**: `/dashboard`

---

## Layout

```
┌──────────┬─────────────────────────────────────────────────────┐
│          │  Dashboard                    🔔(3)  [Hana ▾]       │
│ SIDEBAR  │ ────────────────────────────────────────────────── │
│          │                                                     │
│ 🏠 Home  │  Today's Snapshot                                   │
│ 📦 Products │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│ 📋 Bookings │ │📋 New   │ │💰 Rev   │ │📦 Active│ │⚠ Over │ │
│ 👥 Customers│ │   3     │ │ ৳22,500 │ │   12    │ │  due   │ │
│ 📊 Analytics│ │ +2 vs   │ │  +15%   │ │         │ │   1    │ │
│ ⚙️ Settings │ └─────────┘ └─────────┘ └─────────┘ └────────┘ │
│ 👷 Staff │                                                     │
│          │  Pending Actions                                    │
│          │ ┌───────────────────────────────────────────────┐   │
│          │ │ 🟡 2 bookings waiting for confirmation        │   │
│          │ │ 📦 1 order ready to ship                      │   │
│          │ │ ⚠️ 1 overdue return                           │   │
│          │ │ 🔍 3 items need inspection                    │   │
│          │ └───────────────────────────────────────────────┘   │
│          │                                                     │
│          │  Recent Activity                                    │
│          │ ┌───────────────────────────────────────────────┐   │
│          │ │ 📋 New booking — Fatima Rahman ৳13K   5m ago  │   │
│          │ │ ✅ #0042 completed                    1h ago  │   │
│          │ │ ↩️ Return received — Evening Gown      2h ago  │   │
│          │ │ 📦 Shipped Royal Saree                3h ago  │   │
│          │ └───────────────────────────────────────────────┘   │
│          │                                                     │
│          │  Quick Actions                                      │
│          │  [+ Add Product] [View All Bookings]               │
│          │                                                     │
│ ─────── │  Revenue This Month      ৳185,000                   │
│ Preview  │  [Mini line chart showing last 30 days]            │
│ Store →  │                                                     │
└──────────┴─────────────────────────────────────────────────────┘
```

---

## Sidebar

Persistent on desktop (240px width). Collapsible to icon-only on smaller screens.

On mobile: hidden behind hamburger menu.

### Sidebar Items

| Icon | Label | Route | Badge |
|---|---|---|---|
| 🏠 | Dashboard | `/dashboard` | — |
| 📦 | Products | `/dashboard/products` | — |
| 📋 | Bookings | `/dashboard/bookings` | Pending count |
| 👥 | Customers | `/dashboard/customers` | — |
| 📊 | Analytics | `/dashboard/analytics` | — |
| ⚙️ | Settings | `/dashboard/settings` | — |
| 👷 | Staff | `/dashboard/staff` | — |

Bottom of sidebar:
- "Preview Store →" link opens storefront in new tab
- User avatar + name + role badge

---

## Notification Bell

Top-right corner. Click opens notification dropdown (see [notification-system.md](../../features/notification-system.md)).

---

## Stat Cards

Each stat card is clickable — navigates to the relevant page with filters applied:

| Card | Clicks to |
|---|---|
| New Bookings | `/dashboard/bookings?status=pending` |
| Revenue | `/dashboard/analytics` |
| Active Rentals | `/dashboard/bookings?status=delivered` |
| Overdue | `/dashboard/bookings?status=overdue` |

---

## Mobile Layout

Stack all sections vertically. Stat cards in a 2×2 grid. Sidebar becomes bottom tab bar or hamburger.
