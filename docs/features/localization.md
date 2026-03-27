# Feature Spec: Localization

## Overview

The platform must feel native to Bangladeshi users. This covers language, currency, date/time formatting, and culturally appropriate UX.

---

## Language Support

### Phase 1: English Default

The system launches in English. Product names, descriptions, and all owner-generated content are in whatever language the owner writes (typically Bengali or English).

System UI elements (buttons, labels, navigation) are in English.

### Phase 2: Bengali (Bangla) UI

Full Bengali translation of all system UI elements:

| English | Bengali |
|---|---|
| Book Now | এখনই বুক করুন |
| Add to Cart | কার্টে যোগ করুন |
| Search | অনুসন্ধান |
| Filter | ফিল্টার |
| Price | মূল্য |
| Available | পাওয়া যাচ্ছে |
| Booked | বুক হয়ে গেছে |
| Size | সাইজ |
| Color | রঙ |
| Checkout | চেকআউট |
| Confirm Booking | বুকিং নিশ্চিত করুন |

### Language Switch

- Toggle in the storefront header or footer
- Guest preference stored in localStorage
- Default language configurable per tenant (owner sets default)

### Implementation

Use `next-intl` or `next-i18n` for internationalization:
- Translation files: `locales/en.json`, `locales/bn.json`
- Dynamic loading based on user preference
- Owner portal: English only (v1) — Bengali option in future.

---

## Currency

### Format

| Rule | Example |
|---|---|
| Symbol | ৳ (Bengali Taka sign) |
| Position | Before the number: ৳7,500 |
| Thousands separator | Comma: ৳12,500 |
| Decimal | Only if needed: ৳7,500.50 (avoid for round numbers) |
| No paisa for round | ৳7,500 not ৳7,500.00 |

### Formatting Function

```typescript
function formatPrice(amount: number): string {
  return `৳${amount.toLocaleString('en-IN')}`;
}
// "en-IN" locale uses the South Asian numbering system
// 100000 → "1,00,000" (lakh system — familiar to BD users)
```

**Note**: Bangladesh uses the South Asian numbering system:
- 1,000 (one thousand)
- 10,000 (ten thousand)
- 1,00,000 (one lakh)
- 10,00,000 (ten lakh)

---

## Date & Time

### Date Format

Primary format: `DD MMMM, YYYY` (e.g., "27 March, 2026")

Alternative (compact): `DD/MM/YYYY` (e.g., "27/03/2026")

**Never use MM/DD/YYYY** — this is American format and will confuse Bangladeshi users.

### Time Format

12-hour format with AM/PM: `10:30 AM`

### Timezone

All timestamps stored in UTC. Displayed in **BST (Bangladesh Standard Time, UTC+6)**.

### Calendar

Week starts on **Saturday** (Bangladeshi convention) or **Sunday** — configurable.

---

## Phone Number Format

| Rule | Detail |
|---|---|
| Country code | +880 (stored) |
| Display format | 01X-XXXX-XXXX |
| Validation | Must be 11 digits starting with 01 |
| Input mask | Auto-format as user types |
| Click-to-call | `tel:+8801712345678` |

---

## Address Format

Bangladesh-specific address structure:

```
[Detailed Address]     → House 12, Road 5, Block C
[Area]                 → Dhanmondi
[Thana]                → Dhanmondi (optional)
[District]             → Dhaka
```

Districts dropdown: All 64 districts of Bangladesh.

---

## Cultural UX Considerations

| Consideration | Implementation |
|---|---|
| Trust signals | Show phone number prominently, WhatsApp button, real photos |
| Payment trust | bKash/Nagad logos at checkout, COD prominently available |
| Social proof | "Booked X times this month" badges |
| Family context | Event categories include: Wedding, Holud, Walima, Eid, Puja |
| Conservative display | Product images should be tasteful, no inappropriate content |
| Seasonal awareness | Highlight relevant categories during wedding season, Eid |

---

## Business Rules Summary

1. English is the default system language (v1)
2. Bengali UI translations planned for Phase 2
3. Currency always displayed as ৳ with South Asian number formatting
4. Date format: DD MMMM, YYYY (never MM/DD/YYYY)
5. Phone numbers: 11-digit BD format with +880 stored
6. Timezone: BST (UTC+6) for all user-facing times
7. Address uses BD format (area, thana, district)
8. Cultural UX adapted for Bangladeshi market
