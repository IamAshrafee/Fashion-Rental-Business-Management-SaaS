# P05 — Customer Management (Backend)

| | |
|---|---|
| **Phase** | 2 — Core Business Modules |
| **Estimated Time** | 2–3 hours |
| **Requires** | P03 (auth, guards, tenant middleware) |
| **Unlocks** | P07, P15 |

---

## REFERENCE DOCS

- `docs/features/customer-management.md` — Full feature spec
- `docs/database/customer.md` — Schema: customers + customer_tags
- `docs/api/customer.md` — API endpoints
- `docs/deletion-strategy.md` — Soft delete rules (customers with bookings cannot be deleted)

---

## SCOPE

### 1. Customer Service

**Auto-creation:** Customers are auto-created on first checkout (by phone number). Manual creation also supported from owner portal.

**CRUD:**
- Create customer (name, phone, email, address fields)
- Update customer details
- Get customer by ID (with booking history summary)
- List customers (paginated, filterable, searchable)
- Soft delete customer (only if no active/pending bookings)

**Search & filter:**
- Search by name (partial match via index)
- Search by phone (exact match)
- Filter by tag (VIP, Frequent, Blocked, etc.)
- Sort by: name, total_bookings, total_spent, last_booking_at, created_at

### 2. Customer Tags

- Add tag to customer (e.g., VIP, Frequent, New, Blocked)
- Remove tag
- List all tags used in this tenant (for filter dropdown)
- Tags are free-text, unique per customer

### 3. Customer Stats (Denormalized)

Cached counters updated via events:
- `total_bookings` — incremented on booking confirmation
- `total_spent` — incremented on payment
- `last_booking_at` — updated on booking creation

### 4. Duplicate Detection

- On customer creation, check if phone already exists (tenant-scoped)
- If exists, return the existing customer instead of creating duplicate
- Phone is the primary identifier (per `docs/features/customer-management.md`)

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | Customer CRUD API | Create, read, update, soft-delete |
| 2 | Customer search | By name (partial) and phone (exact) |
| 3 | Customer filtering | By tag, sortable |
| 4 | Tag management | Add/remove tags |
| 5 | Auto-creation on checkout | `findOrCreateByPhone()` method |
| 6 | Stats cache update logic | Event listeners for booking/payment events |
| 7 | Duplicate prevention | Unique phone per tenant enforced |

---

## OUTPUT CONTRACTS

| Contract | Used By |
|---|---|
| `CustomerService.findOrCreateByPhone()` | P07 (Booking engine — creates customer at checkout) |
| Customer CRUD API endpoints | P15 (Owner Customer UI) |
| Customer stats update method | P07, P08 (after booking/payment) |
