# P18 — Guest Portal: Booking & Checkout

| | |
|---|---|
| **Phase** | 6 — Guest Portal Frontend |
| **Estimated Time** | 4–5 hours |
| **Requires** | P17 (storefront), P07 (booking APIs), P08 (payment APIs) |
| **Unlocks** | P20 |
| **Agent Skills** | `nextjs-best-practices`, `nextjs-app-router-patterns`, `vercel-react-best-practices` |

---

## REFERENCE DOCS

- `docs/ui/guest/cart-page.md` — Cart page spec
- `docs/ui/guest/checkout-page.md` — Checkout page spec
- `docs/ui/guest/booking-confirmation.md` — Confirmation page spec
- `docs/features/cart-system.md` — Client-side cart (localStorage)
- `docs/features/checkout-flow.md` — Checkout process
- `docs/flows/guest-booking-flow.md` — Full booking flow
- `docs/flows/payment-flow.md` — Payment flow
- ADR-03: Client-side cart (no cart API)

---

## SCOPE

### 1. Cart System (localStorage)

```typescript
// Cart structure in localStorage
interface CartItem {
  productId: string;
  variantId: string;
  productName: string;
  featuredImage: string;
  colorName: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  rentalDays: number;
  selectedSize?: string;
  backupSize?: string;
  wantCleaning: boolean;
  wantTryOn: boolean;
  addedAt: string;   // timestamp
}
```

- `useCart()` hook: addItem, removeItem, updateItem, clearCart, getItems, getCount
- Cart persists across sessions (localStorage)
- Cart icon in header shows item count badge

### 2. Cart Page (`/cart`)

- List of cart items with: product image, name, variant info, dates, price
- Per-item: edit dates, remove item
- **Server validation**: on cart page load, validate all items via `POST /api/v1/bookings/validate`
  - Show warnings for unavailable items (dates no longer available)
  - Show updated prices if pricing changed since added
- Price summary: subtotal, fees, deposits, grand total
- "Proceed to Checkout" button (disabled if any items invalid)
- "Continue Shopping" link
- Empty cart state

### 3. Checkout Page (`/checkout`)

**Step 1 — Delivery Information:**
- Customer name, phone, alt phone (optional), email (optional)
- Address fields: line1, line2, city, state, postal code, country
- Extra address fields (tenant-configurable JSONB)
- Customer notes textarea
- Save for future orders option (creates/updates customer record)

**Step 2 — Payment Method:**
- Radio buttons: COD, bKash, Nagad, SSLCommerz (based on tenant's enabled methods)
- For bKash/Nagad: show tenant's payment number + "Send & enter reference" field
- For SSLCommerz: redirect to payment gateway
- For COD: no extra action

**Step 3 — Review & Confirm:**
- Order summary: all items with dates, prices
- Delivery address display
- Payment method display
- "Place Order" button

**On submit:**
1. Call `POST /api/v1/bookings` with all data
2. If SSLCommerz: redirect to gateway → handle success/fail/cancel redirects
3. If manual: show confirmation page

### 4. Booking Confirmation Page (`/booking/confirmation/:id`)

- "Order Placed Successfully!" message
- Booking number prominently displayed
- Order summary
- WhatsApp link to contact store owner
- "Continue Shopping" button

### 5. Booking Tracking Page (`/booking/track`)

- Input: booking number + phone number
- Lookup booking status
- Display: status timeline, item details, tracking number (if shipped)

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | Cart system (localStorage) | Add, remove, persist, count |
| 2 | Cart page with validation | Server validates, shows warnings |
| 3 | Checkout form (3 steps) | Delivery → payment → review |
| 4 | Payment method selection | COD, bKash, Nagad, SSLCommerz |
| 5 | SSLCommerz redirect flow | Init → redirect → handle callbacks |
| 6 | Booking confirmation page | Shows booking details |
| 7 | Booking tracking page | Look up status by # + phone |
| 8 | Cart icon with count badge | Live count in header |
