# P12 — Owner Portal: Layout & Dashboard

| | |
|---|---|
| **Phase** | 5 — Owner Portal Frontend |
| **Estimated Time** | 3–4 hours |
| **Requires** | P11 (frontend foundation), P06 (store settings API) |
| **Unlocks** | P13, P14, P15, P16 |

---

## REFERENCE DOCS

- `docs/ui/owner/dashboard.md` — Dashboard UI spec
- `docs/ui/_overview.md` — UI framework decisions
- `docs/frontend-architecture.md` — Component patterns
- `docs/features/analytics-dashboard.md` — Dashboard metrics

---

## SCOPE

### 1. Owner Layout (Polish)

Refine the owner layout from P11:
- **Sidebar navigation** with links: Dashboard, Products, Bookings, Customers, Analytics, Settings
- **Top header**: store name, notification bell (unread count), user avatar + dropdown
- **Breadcrumbs**: auto-generated from route path
- **Mobile**: sidebar collapses to hamburger menu
- **Theme**: ShadCN/ui dark mode support

### 2. Dashboard Page

**Quick stats cards** (from `GET /api/v1/bookings/stats` + other endpoints):
- Total active bookings (confirmed + shipped + delivered)
- Pending bookings (needs action)
- Overdue items
- Today's deliveries
- Today's expected returns
- Revenue this month

**Recent bookings table**: Last 10 bookings with status, customer, total, date

**Quick actions**: Add Product, Create Booking, View All Orders

### 3. Setup Wizard / Onboarding Checklist

First-time owner sees a checklist:
- [ ] Upload store logo
- [ ] Set store colors
- [ ] Add first category
- [ ] Add first product
- [ ] Set payment method
- [ ] Set delivery area

Track progress in localStorage or store_settings.

### 4. Notification Center

- Bell icon in header with unread count badge
- Dropdown shows latest notifications
- Click to view full notification list page
- Mark as read on click/view

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | Polished owner layout | Sidebar, header, breadcrumbs, mobile responsive |
| 2 | Dashboard with stat cards | Shows live data from APIs |
| 3 | Recent bookings table | Clickable rows navigate to booking detail |
| 4 | Quick actions | Navigate to correct pages |
| 5 | Setup wizard | Shows incomplete steps for new tenants |
| 6 | Notification dropdown | Shows unread, mark as read |

---

## OUTPUT CONTRACTS

| Contract | Used By |
|---|---|
| Owner layout wrapper | P13–P16 (all owner pages use this layout) |
| Dashboard route `/dashboard` | Entry point after login |
| Notification component | Reused in header across all owner pages |
