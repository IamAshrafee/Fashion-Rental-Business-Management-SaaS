# Feature Spec: Rental Pricing

## Overview

The pricing system must be flexible because different fashion rental businesses use different pricing models. A product uses **one primary pricing mode**, and optionally has an internal minimum price visible only to staff.

---

## Pricing Modes

### Mode 1: One-Time Rental Price

A fixed price for a fixed duration.

**Configuration (Owner)**:

| Field | Type | Required | Example |
|---|---|---|---|
| Rental Price | Number (৳) | Yes | 7,500৳ |
| Included Days | Number | Yes | 3 days |

**How it works**:
- Customer pays 7,500৳ for a 3-day rental period
- If customer wants more days → extended rental fees apply (see [timing-logistics.md](./timing-logistics.md))
- If customer returns late → late fees apply

**How it displays to guests**:
```
৳7,500 / 3 days
```

**Calculation**:
- Base booking cost = Rental Price (fixed)
- Extended days = Extra per-day charge (from timing-logistics)
- Total = Base + Extended + Deposit + Cleaning Fee + Shipping

---

### Mode 2: Per Day Price

A daily rate. Total calculated based on rental duration.

**Configuration (Owner)**:

| Field | Type | Required | Example |
|---|---|---|---|
| Price Per Day | Number (৳) | Yes | 2,500৳ |
| Minimum Days | Number | No (default: 1) | 2 days |

**How it works**:
- Customer selects rental dates
- System calculates: Price Per Day × Number of Days
- Minimum days enforced (if set)

**How it displays to guests**:
```
৳2,500 / day (min. 2 days)
```

**Calculation Example**:
- Guest selects 4 days
- Rental cost = 2,500 × 4 = ৳10,000
- Total = ৳10,000 + Deposit + Cleaning Fee + Shipping

---

### Mode 3: Retail Percentage Pricing

Rental price is calculated as a percentage of the product's retail/purchase price. Used by high-end boutiques.

**Configuration (Owner)**:

| Field | Type | Required | Example |
|---|---|---|---|
| Retail Price | Number (৳) | Yes | 45,000৳ |
| Rental Percentage | Number (%) | Yes | 20% |
| Included Days | Number | Yes | 3 days |

**How it works**:
- System calculates: Retail Price × Percentage = Rental Price
- 45,000 × 20% = ৳9,000 for 3 days
- Owner can manually override the calculated price

**How it displays to guests**:
```
৳9,000 / 3 days
(Retail value: ৳45,000)    ← only if owner has made purchase price public
```

**Note**: The retail price shown publicly IS the purchase price field from [stock-inventory.md](./stock-inventory.md). If the owner has set purchase price to private, only the calculated rental price is shown without the retail reference.

**Percentage Range**: System allows 5%–50% selection in 5% increments. Owner can also type a custom percentage.

---

## Internal Minimum Price (All Modes)

Regardless of pricing mode, the owner can set an internal price floor.

**Configuration**:

| Field | Type | Required | Visibility |
|---|---|---|---|
| Minimum Price | Number (৳) | No | Staff + Owner only |
| Maximum Discount Price | Number (৳) | No | Staff + Owner only |

**Purpose**: When a staff member (salesperson) is negotiating with a customer over phone/WhatsApp, they can see the minimum acceptable price. They know they cannot go below this amount.

**How it displays**:
- **Guests**: Not visible at all
- **Staff**: Shown as a subtle indicator on the product detail view in the owner portal
- **Example**: "Price range: ৳5,000 – ৳7,500" (meaning: listed at 7,500 but can go as low as 5,000)

---

## Price Display Rules (Guest Side)

### Product Card
Show the primary rental price clearly:

| Mode | Card Display |
|---|---|
| One-Time | `৳7,500 / 3 days` |
| Per Day | `৳2,500 / day` |
| Retail % | `৳9,000 / 3 days` |

Always show price in **bold**, with the duration in regular weight.

### Product Detail Page
Show full pricing breakdown:

```
Rental: ৳7,500 (3 days)
Security Deposit: ৳5,000 (refundable)
Cleaning Fee: ৳500
────────────────────
Subtotal: ৳13,000
```

Deposit is clearly marked as **refundable**.

### Cart & Checkout
Show itemized breakdown per product:

```
Royal Banarasi Saree
  Variant: White
  Size: M
  Dates: March 15 – March 17 (3 days)
  Rental: ৳7,500
  Deposit: ৳5,000
  Cleaning: ৳500
  ──────────
  Item Total: ৳13,000
```

---

## Price Calculation Engine

### Input Variables

| Variable | Source |
|---|---|
| Pricing Mode | Product pricing config |
| Rental Price / Per Day Price / Percentage | Product pricing config |
| Rental Duration (days) | Guest's selected date range |
| Extended Rental Rate | Product logistics config |
| Security Deposit | Product service config |
| Cleaning Fee | Product service config |
| Backup Size Fee | Product service config (if selected) |
| Try-On Fee | Product try-before-rent config (if selected) |
| Shipping Fee | Product logistics config or area-based |

### Calculation Logic

```
baseRentalCost = 
  if mode === "one-time": rentalPrice
  if mode === "per-day": pricePerDay × rentalDays
  if mode === "percentage": retailPrice × (percentage / 100)

includedDays = 
  if mode === "one-time": includedDays
  if mode === "per-day": rentalDays (all days are paid)
  if mode === "percentage": includedDays

extraDays = max(0, rentalDays - includedDays)
extendedCost = extraDays × extendedRentalRate

subtotal = baseRentalCost + extendedCost
fees = cleaningFee + backupSizeFee + tryOnFee (if applicable)
shipping = shippingFee (if applicable)

totalPayable = subtotal + fees + shipping + securityDeposit
totalNonRefundable = subtotal + fees + shipping
totalRefundable = securityDeposit
```

---

## Currency Formatting

All prices displayed in Bangladeshi Taka:

| Format | Example |
|---|---|
| Standard | ৳7,500 |
| With decimals (if needed) | ৳7,500.00 |
| Thousands separator | ৳12,500 (comma at thousands) |
| No paisa for round numbers | ৳7,500 not ৳7,500.00 |

The ৳ symbol appears **before** the number.

---

## Business Rules Summary

1. Every product must have exactly one pricing mode
2. Pricing mode can be changed during editing (old values replaced)
3. Per-day mode enforces minimum days if set
4. Retail percentage mode auto-calculates but allows manual override
5. Internal minimum price is never visible to guests
6. Security deposit is always shown separately and marked "refundable"
7. All prices are in BDT (৳)
8. Price displayed on cards must be immediately understandable
9. Extended rental charges come from timing-logistics, not from pricing config
