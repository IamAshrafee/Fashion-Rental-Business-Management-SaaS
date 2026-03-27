# Testing: Unit Tests

## Scope

Test individual functions, services, and utilities in isolation. No database, no HTTP, no external services.

---

## What to Unit Test

| Module | Test Cases |
|---|---|
| **Pricing Calculator** | One-time, per-day, percentage calculations; extended rental fees; late fee with caps |
| **Availability Checker** | Date overlap logic, buffer day handling, manual block detection |
| **Cart Validator** | Price recalculation, item conflict detection, stale price detection |
| **Phone Validator** | BD format (01x), 11 digits, edge cases |
| **Booking Number Generator** | Format (ORD-YYYY-XXXX), uniqueness, sequential increment |
| **Slug Generator** | Unicode to ASCII, duplicate handling, max length |
| **Date Utilities** | BD date formatting, rental day calculation, overdue detection |
| **Currency Formatter** | BDT formatting, South Asian numbering (lakhs, crores) |
| **Security Helpers** | Password hashing, JWT token generation, refresh token rotation |
| **Tenant Resolver** | Subdomain extraction, custom domain matching |

---

## Patterns

### Test Structure

```typescript
describe('PricingService', () => {
  describe('calculateRentalPrice', () => {
    it('should calculate one-time rental price', () => {
      const result = pricingService.calculate({
        mode: 'one_time',
        rentalPrice: 7500,
        includedDays: 3,
        requestedDays: 3,
      });
      expect(result.total).toBe(7500);
    });

    it('should add extended day charges', () => {
      const result = pricingService.calculate({
        mode: 'one_time',
        rentalPrice: 7500,
        includedDays: 3,
        requestedDays: 5,
        extendedDayRate: 500,
      });
      expect(result.total).toBe(8500); // 7500 + (2 × 500)
    });

    it('should cap late fee at maximum', () => {
      const result = pricingService.calculateLateFee({
        type: 'fixed',
        amount: 300,
        maxFee: 2000,
        lateDays: 10,
      });
      expect(result).toBe(2000); // 10 × 300 = 3000, capped at 2000
    });
  });
});
```

### Mocking

```typescript
// Mock Prisma
const mockPrisma = {
  product: { findFirst: jest.fn(), findMany: jest.fn() },
  booking: { create: jest.fn() },
};

// Mock SMS Provider
const mockSMS = { sendSMS: jest.fn().mockResolvedValue({ status: 'sent' }) };
```

---

## Running

```bash
# All unit tests
npm run test

# With coverage
npm run test:cov

# Watch mode
npm run test:watch

# Specific module
npm run test -- --testPathPattern=pricing
```
