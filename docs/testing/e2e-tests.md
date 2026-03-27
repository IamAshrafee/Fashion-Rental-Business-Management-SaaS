# Testing: E2E (End-to-End) Tests

## Scope

Browser-based tests simulating real user workflows. Uses Playwright to automate the guest and owner portals.

---

## Critical Flows

| Flow | Priority | Description |
|---|---|---|
| Guest Booking | P0 | Browse → product → cart → checkout → confirm |
| Owner Login | P0 | Login → dashboard visible |
| Add Product | P0 | Create product with images → visible on storefront |
| Confirm Booking | P0 | New booking → confirm → status update |
| Ship Order | P1 | Confirmed → ship → tracking visible |
| Payment Recording | P1 | Record manual payment → status updates |
| Store Settings | P2 | Update branding → storefront reflects changes |

---

## Test Examples

### Guest Booking Flow

```typescript
test('Guest can book a product', async ({ page }) => {
  // Navigate to storefront
  await page.goto('https://testboutique.closetrent.com.bd');

  // Browse products
  await page.click('[data-testid="product-card"]:first-child');

  // Select dates
  await page.click('[data-testid="start-date"]');
  await page.fill('[data-testid="start-date"]', '2026-04-15');
  await page.fill('[data-testid="end-date"]', '2026-04-17');

  // Add to cart
  await page.click('[data-testid="add-to-cart"]');
  expect(await page.locator('[data-testid="cart-count"]').textContent()).toBe('1');

  // Checkout
  await page.goto('/cart');
  await page.click('[data-testid="proceed-checkout"]');

  // Fill checkout form
  await page.fill('[data-testid="customer-name"]', 'E2E Test User');
  await page.fill('[data-testid="customer-phone"]', '01799999999');
  await page.fill('[data-testid="address"]', 'Test Address, Dhaka');
  await page.selectOption('[data-testid="district"]', 'Dhaka');

  // Confirm
  await page.click('[data-testid="confirm-booking"]');

  // Verify confirmation page
  await expect(page.locator('[data-testid="booking-number"]')).toBeVisible();
  await expect(page.locator('text=Booking Confirmed')).toBeVisible();
});
```

### Owner Dashboard

```typescript
test('Owner sees new booking on dashboard', async ({ page }) => {
  await loginAsOwner(page);

  await expect(page.locator('[data-testid="pending-count"]')).toContainText('1');
  await page.click('text=Bookings');
  await expect(page.locator('[data-testid="booking-card"]')).toBeVisible();
});
```

---

## Test Environment

- Dedicated test subdomain: `e2etest.closetrent.com.bd`
- Seeded with test data before each suite
- Database reset between suites

---

## Running

```bash
# Run all E2E tests
npx playwright test

# Run with UI mode
npx playwright test --ui

# Run specific flow
npx playwright test booking-flow.spec.ts

# Generate report
npx playwright show-report
```
