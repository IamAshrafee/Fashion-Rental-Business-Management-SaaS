# Localization Strategy

## Overview

ClosetRent is a **global SaaS** platform. All localization settings are **tenant-configurable** — nothing is hardcoded to a specific country.

---

## Tenant Locale Configuration

Each tenant stores their locale settings in `store_settings`:

```typescript
interface TenantLocale {
  country: string;            // ISO 3166 country code (BD, TH, US)
  timezone: string;           // IANA timezone (Asia/Dhaka, Asia/Bangkok)
  currency: {
    code: string;             // ISO 4217 (BDT, THB, USD)
    symbol: string;           // ৳, ฿, $
    symbolPosition: 'before' | 'after';  // $100 vs 100৳
  };
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  numberFormat: 'south_asian' | 'international';
  // south_asian: 12,34,567 (lakhs/crores)
  // international: 1,234,567 (millions/billions)
  phoneFormat: {
    countryCode: string;      // +880, +66, +1
    pattern: string;          // Regex for local validation
    placeholder: string;      // Example: "01XXXXXXXXX"
  };
}
```

---

## Timezone Handling

### Storage Rules

| Data | Database Type | Timezone |
|---|---|---|
| `created_at`, `updated_at` | `TIMESTAMPTZ` | UTC always |
| `booking.start_date` | `DATE` | No timezone (calendar date) |
| `booking.end_date` | `DATE` | No timezone (calendar date) |
| `payment.paid_at` | `TIMESTAMPTZ` | UTC |
| CRON scheduling | Calculated | UTC → tenant local for display |

### Display Rules

```typescript
// Server → Client: always send UTC timestamps
// Client: convert to tenant timezone for display

import { formatInTimeZone } from 'date-fns-tz';

function displayDate(utcDate: string, tenantTimezone: string): string {
  return formatInTimeZone(utcDate, tenantTimezone, 'dd/MM/yyyy HH:mm');
}
```

### CRON Jobs and Timezones

CRON jobs run in UTC. For tenant-specific timing (e.g., "send return reminder at 9 AM tenant time"):

```typescript
// Find tenants where local time is 9:00 AM
const now = new Date(); // UTC
const tenants = await findTenantsWhereLocalTimeIs(now, '09:00');
// Process reminders for those tenants
```

---

## Currency Handling

### Storage

- All amounts stored as **integers** (no decimals)
- Currency code stored at tenant level
- Price snapshots in bookings include the currency code at time of booking

### Formatting

```typescript
function formatPrice(amount: number, locale: TenantLocale): string {
  const formatted = locale.numberFormat === 'south_asian'
    ? formatSouthAsian(amount)   // 12,34,567
    : formatInternational(amount); // 1,234,567

  return locale.currency.symbolPosition === 'before'
    ? `${locale.currency.symbol}${formatted}`
    : `${formatted}${locale.currency.symbol}`;
}
```

### Rounding

All calculations that produce decimals: **always round UP** (ceiling).

```typescript
Math.ceil(7500 * 0.035) // 262.5 → 263
```

---

## Address Format

Tenants configure their address form fields:

```typescript
interface AddressConfig {
  fields: AddressField[];
}

interface AddressField {
  key: string;           // 'address_line_1', 'city', 'district', etc.
  label: string;         // Display label
  required: boolean;
  type: 'text' | 'select' | 'textarea';
  options?: string[];    // For select type (e.g., list of districts)
}
```

### Default Address Templates (Admin-managed)

| Country | Fields |
|---|---|
| Bangladesh | Address, Area, Thana, District, Division |
| Thailand | Address, Sub-district, District, Province, Postal Code |
| International | Address Line 1, Address Line 2, City, State, Postal Code, Country |

SaaS admin creates address templates per country. Tenant can customize.

---

## Phone Validation

Per-tenant, based on country:

```typescript
const PHONE_PATTERNS: Record<string, RegExp> = {
  BD: /^01[3-9]\d{8}$/,           // 11 digits
  TH: /^0[689]\d{7,8}$/,          // 9-10 digits
  US: /^\d{10}$/,                  // 10 digits
  DEFAULT: /^\+?\d{7,15}$/,        // International fallback
};
```

---

## Multi-Language (Future-Ready)

### Current: English Only

All UI strings in English. No i18n framework yet.

### Future Architecture

```
src/
├── locales/
│   ├── en.json        # English
│   ├── bn.json        # Bengali
│   └── th.json        # Thai
├── lib/
│   └── i18n.ts        # Translation utility
```

**Preparation for v1:**
- Use translation keys in components: `t('booking.confirmed')` instead of hardcoded strings
- Or store strings as constants that can be swapped later
- Don't embed user-facing strings directly in JSX
