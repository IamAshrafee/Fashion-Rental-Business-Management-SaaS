# Feature Spec: Localization

## Overview

ClosetRent is a **global SaaS platform**. All localization settings are **tenant-configurable** — nothing is hardcoded to a specific country or currency. The system adapts to each tenant's market.

> **See also**: [localization-strategy.md](../localization-strategy.md) for detailed technical implementation (timezone handling, currency formatting, address config).

---

## Language Support

### Phase 1: English Default

The system launches in English. Product names, descriptions, and all owner-generated content are in whatever language the owner writes.

System UI elements (buttons, labels, navigation) are in English only.

### Future: Multi-Language UI

Architecture supports adding language packs per tenant:
- Translation files: `locales/en.json`, `locales/bn.json`, `locales/th.json`, etc.
- Tenant configures their storefront's default language
- Guest can switch language (preference stored in localStorage)
- Owner portal: English only for v1

**Preparation for v1:**
- Use translation keys in components, not hardcoded strings
- Store all user-facing strings as constants

---

## Currency

### Tenant-Configurable

Each tenant sets their currency in store settings:

| Setting | Example (BD) | Example (Thailand) |
|---|---|---|
| Currency code | BDT | THB |
| Symbol | ৳ | ฿ |
| Symbol position | Before: ৳7,500 | Before: ฿7,500 |
| Number format | South Asian (1,00,000) | International (100,000) |

### Rules

- All prices stored as **integers** (no decimals)
- Rounding: **always round UP** (Math.ceil)
- Currency code stored with booking snapshot (if tenant changes currency later, historical bookings keep original)
- No currency conversion — each tenant operates in their configured currency

---

## Date & Time

### Tenant-Configurable Format

| Setting | Options |
|---|---|
| Date format | `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD` |
| Time format | 12-hour (AM/PM) or 24-hour |
| Week start | Saturday, Sunday, or Monday |

### Timezone

- All timestamps stored as **UTC** in database
- Booking dates stored as **DATE** (no timezone — calendar dates)
- Displayed in **tenant's configured timezone** (IANA format, e.g., `Asia/Dhaka`)
- Each tenant sets their timezone in store settings

---

## Phone Number

### Tenant-Configurable Validation

Each tenant's country determines phone validation:

| Country | Code | Format | Validation |
|---|---|---|---|
| Bangladesh | +880 | 01X-XXXX-XXXX | 11 digits, starts with 01 |
| Thailand | +66 | 0X-XXXX-XXXX | 9-10 digits |
| USA | +1 | (XXX) XXX-XXXX | 10 digits |
| Default | Any | International | 7-15 digits |

- Country code auto-filled from tenant's country setting
- Display format adapts to country
- Click-to-call: `tel:+{countryCode}{number}`

---

## Address Format

### Tenant-Configurable Fields

Each tenant configures their address form in store settings. SaaS admin provides country-specific templates:

| Country | Fields |
|---|---|
| Bangladesh | Address, Area, Thana, District, Division |
| Thailand | Address, Sub-district, District, Province, Postal Code |
| International | Address Line 1, Address Line 2, City, State, Postal Code, Country |

Tenants can customize field labels, required/optional status, and add dropdown options (e.g., list of districts).

---

## Cultural UX — Tenant-Driven

Instead of hardcoding cultural elements, these are tenant-configurable:

| Feature | How |
|---|---|
| Trust signals | Tenant adds phone, WhatsApp, social links in settings |
| Payment logos | Shown based on tenant's enabled payment methods |
| Event categories | Tenant creates their own event types (Wedding, Eid, Prom, etc.) |
| Social proof badges | System-generated from real data ("Booked X times") |

---

## Business Rules Summary

1. English is the system language for v1. Multi-language architecture ready.
2. Currency, date format, number format — all **per-tenant configurable**
3. Phone validation based on **tenant's country** setting
4. Address format uses **tenant-configurable fields** (templates per country)
5. Timezone: **UTC storage**, display in **tenant timezone**
6. No cultural assumptions hardcoded — tenants configure their own market
