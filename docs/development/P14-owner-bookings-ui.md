# P14 — Owner Portal: Booking & Order Management UI

| | |
|---|---|
| **Phase** | 5 — Owner Portal Frontend |
| **Estimated Time** | 4–5 hours |
| **Requires** | P12 (owner layout), P07 (booking APIs), P08 (payment APIs) |
| **Unlocks** | P20 |
| **Agent Skills** | `nextjs-best-practices`, `vercel-react-best-practices` |

---

## REFERENCE DOCS

- `docs/ui/owner/booking-management.md` — Booking list/detail UI spec
- `docs/ui/owner/order-management.md` — Order processing UI
- `docs/flows/owner-fulfill-order-flow.md` — Fulfillment workflow
- `docs/flows/deposit-refund-flow.md` — Deposit refund UI
- `docs/flows/damage-claim-flow.md` — Damage report UI
- `docs/flows/late-return-flow.md` — Late return UI

---

## SCOPE

### 1. Booking List Page (`/bookings`)

- DataTable: Booking #, Customer, Items, Status, Total, Date, Actions
- Status filter tabs: All, Pending, Confirmed, Shipped, Delivered, Returned, Completed, Overdue, Cancelled
- Date range filter
- Search by booking number or customer name
- Color-coded status badges

### 2. Booking Detail Page (`/bookings/:id`)

**Header:** Booking number, status badge, date, customer info

**Item list:** Each booking item with:
- Product image/name, variant, size
- Rental dates (start → end)
- Price breakdown (base rental, fees, deposit)
- Status per item

**Action buttons** (conditional on current status):
- Confirm Booking (from pending)
- Ship Order (from confirmed) — opens courier dialog with tracking number
- Mark Delivered (from shipped)
- Mark Returned (from delivered)
- Inspect Items (from returned) — per-item inspection with damage report
- Complete Order (from inspected) — triggers deposit refund
- Cancel Booking (from pending/confirmed)

**Payment section:**
- Payment summary (grand total, paid, balance)
- Record payment button → dialog with amount, method, reference
- Payment history table

**Deposit section:**
- Per-item deposit status
- Refund deposit button → dialog with amount, method
- Damage deduction display

**Timeline:** Visual timeline of status changes with timestamps

### 3. Damage Report Form

- Damage level selector (minor, moderate, severe, destroyed, lost)
- Description textarea
- Photo upload (multiple)
- Estimated repair cost
- Auto-calculated deduction from deposit
- Additional charge if damage exceeds deposit

### 4. Calendar View (`/bookings/calendar`)

- Month view calendar showing bookings by delivery/return dates
- Color-coded by status
- Click date → list of bookings for that day

### 5. Create Booking (Owner-Side)

- Owner can create bookings manually (e.g., phone orders)
- Product selector, customer selector (or create new)
- Date picker, pricing auto-calculated
- Same validation as guest checkout

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | Booking list with status tabs | Filters, sorts, paginates |
| 2 | Booking detail page | Full info with action buttons |
| 3 | Status transition actions | Each transition works with confirmation |
| 4 | Payment recording dialog | Record payments correctly |
| 5 | Deposit management | Refund and forfeit actions |
| 6 | Damage report form | Submit with photos |
| 7 | Calendar view | Visual booking calendar |
| 8 | Owner-side booking creation | Manual booking flow |
| 9 | Status timeline | Visual history |
