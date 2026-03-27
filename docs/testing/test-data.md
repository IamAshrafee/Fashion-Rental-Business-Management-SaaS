# Testing: Test Data

## Seed Data

Realistic Bangladeshi test data used across all test suites.

---

## Test Tenants

| ID | Business Name | Subdomain | Plan |
|---|---|---|---|
| tenant-1 | Hana's Boutique | hanasboutique | Pro |
| tenant-2 | Fashion House BD | fashionhousebd | Free |
| tenant-3 | Royal Collection | royalcollection | Pro |

---

## Test Users

| ID | Name | Phone | Role | Tenant |
|---|---|---|---|---|
| user-1 | Hana Rahman | 01712345678 | Owner | tenant-1 |
| user-2 | Rashid Ahmed | 01812345678 | Manager | tenant-1 |
| user-3 | Ayesha Khan | 01912345678 | Staff | tenant-1 |
| user-4 | Karim Hossain | 01612345678 | Owner | tenant-2 |

---

## Test Products

| Name | Category | Price | Deposit | Tenant |
|---|---|---|---|---|
| Royal Banarasi Saree | Saree | ৳7,500/3d | ৳5,000 | tenant-1 |
| Evening Gown | Gown | ৳5,000/3d | ৳3,000 | tenant-1 |
| Sherwani Set | Sherwani | ৳12,000/5d | ৳8,000 | tenant-1 |
| Bridal Lehenga | Lehenga | ৳20,000/5d | ৳15,000 | tenant-1 |
| Simple Saree | Saree | ৳2,500/3d | ৳1,500 | tenant-2 |

---

## Test Customers

| Name | Phone | Tenant | Orders |
|---|---|---|---|
| Fatima Rahman | 01711111111 | tenant-1 | 5 (VIP) |
| Anika Hasan | 01811111111 | tenant-1 | 3 |
| Rashida Begum | 01611111111 | tenant-1 | 1 (New) |
| Sumaiya Akter | 01511111111 | tenant-2 | 2 |

---

## Test Bookings

| Number | Customer | Product | Status | Dates | Tenant |
|---|---|---|---|---|---|
| ORD-2026-0001 | Fatima | Royal Saree | completed | Apr 1-3 | tenant-1 |
| ORD-2026-0002 | Anika | Evening Gown | delivered | Apr 10-12 | tenant-1 |
| ORD-2026-0003 | Rashida | Bridal Lehenga | pending | Apr 20-24 | tenant-1 |
| ORD-2026-0004 | Fatima | Sherwani | overdue | Apr 5-7 | tenant-1 |
| ORD-2026-0005 | Sumaiya | Simple Saree | completed | Apr 2-4 | tenant-2 |

---

## Test Payment Scenarios

| Scenario | Setup |
|---|---|
| COD unpaid | Booking pending, no payments recorded |
| bKash paid | Payment with TXN ID, verified |
| Partial payment | ৳10,000 paid of ৳15,000 total |
| SSLCommerz success | Valid IPN callback simulation |
| SSLCommerz fail | Failed payment, booking not created |

---

## Factory Functions

```typescript
// Create test tenant with seeded data
const tenant = await TestFactory.createTenant({
  name: 'Test Boutique',
  subdomain: 'testboutique',
  plan: 'pro',
});

// Create test product
const product = await TestFactory.createProduct(tenant.id, {
  name: 'Test Saree',
  rentalPrice: 5000,
  includedDays: 3,
});

// Create test booking
const booking = await TestFactory.createBooking(tenant.id, {
  customerId: customer.id,
  items: [{ productId: product.id, variantId: variant.id }],
  startDate: '2026-04-15',
  endDate: '2026-04-17',
});
```

---

## Locale-Specific Data

All test data uses:
- Bangladeshi phone numbers (01xxxxxxxxx)
- BDT currency (৳)
- Bangladeshi names
- Dhaka addresses
- BD date format (DD/MM/YYYY)
