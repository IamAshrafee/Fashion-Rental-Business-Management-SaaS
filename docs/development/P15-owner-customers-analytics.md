# P15 — Owner Portal: Customers & Analytics UI

| | |
|---|---|
| **Phase** | 5 — Owner Portal Frontend |
| **Estimated Time** | 3–4 hours |
| **Requires** | P12 (owner layout), P05 (customer APIs) |
| **Unlocks** | P20 |
| **Agent Skills** | `nextjs-best-practices`, `vercel-react-best-practices`, `shadcn`, `tailwind-css-patterns` · Optional: `tailwindcss-advanced-layouts` |

---

## REFERENCE DOCS

- `docs/ui/owner/customer-list.md` — Customer list page spec
- `docs/ui/owner/analytics.md` — Analytics dashboard spec
- `docs/features/customer-management.md` — Customer features
- `docs/features/analytics-dashboard.md` — Metrics and charts
- `docs/api/customer.md` — Customer API endpoints
- `docs/api/analytics.md` — Analytics API endpoints

---

## SCOPE

### 1. Customer List Page (`/customers`)

- DataTable: Name, Phone, Total Bookings, Total Spent, Last Booking, Tags, Actions
- Search by name or phone
- Filter by tag (VIP, Frequent, Blocked, New)
- Sort by name, total_bookings, total_spent, last_booking_at
- Inline tag management (add/remove tags)

### 2. Customer Detail / Profile Page (`/customers/:id`)

- Contact info (name, phone, email, address)
- Stats: total bookings, total spent, average order value
- Booking history table (paginated, recent first)
- Tags section (add/remove)
- Notes section (internal owner notes)
- Edit customer info

### 3. Analytics Dashboard (`/analytics`)

**Revenue metrics:**
- Revenue today, this week, this month, all time
- Revenue chart (line chart, last 30 days)
- Average booking value

**Booking metrics:**
- Bookings today, this week, this month
- Booking status distribution (pie chart)
- Bookings over time (bar chart)

**Product metrics:**
- Most rented products (top 10 table)
- Products by category distribution
- Underperforming products (low bookings)
- Target tracking progress (target vs actual rentals)

**Customer metrics:**
- New customers this month
- Repeat customer rate
- Top customers by spending

**Charts:** Use a lightweight chart library (Recharts or Chart.js wrapped in dynamic import).

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | Customer list with search/filter | Loads, filters, paginates |
| 2 | Customer detail page | Full profile with history |
| 3 | Tag management | Add/remove inline |
| 4 | Revenue analytics | Charts and metric cards |
| 5 | Booking analytics | Status distribution, trends |
| 6 | Product analytics | Top products, targets |
| 7 | Customer analytics | New, repeat, top spenders |
