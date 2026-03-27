# Flow: Tenant Onboarding

## Overview

The journey of a new business owner — from discovering ClosetRent to having their first product listed and storefront live.

---

## Flow Diagram

```
[Business Owner Finds ClosetRent]
       │
       ├── Marketing website (closetrent.com.bd)
       ├── Social media, word of mouth
       │
       ▼
[Registration Page]
       │
       ├── Full Name
       ├── Phone Number (BD format)
       ├── Email (optional)
       ├── Password
       ├── Business Name
       ├── Subdomain (live availability check)
       │
       ├── POST /auth/register
       │   ├── Create User (role: owner)
       │   ├── Create Tenant
       │   ├── Create TenantUser (user ↔ tenant, role: owner)
       │   ├── Create StoreSettings (defaults)
       │   ├── Create Subscription (free plan or trial)
       │   ├── Seed default categories (Saree, Lehenga, Sherwani, etc.)
       │   ├── Seed default events (Wedding, Holud, Eid, etc.)
       │   └── Return JWT tokens
       │
       ▼
[Welcome / Setup Wizard]
       │
       ├── Step 1: Upload Logo
       │   └── (optional, can skip)
       │
       ├── Step 2: Brand Colors
       │   └── Pick primary + secondary color
       │
       ├── Step 3: Business Info
       │   └── Phone, WhatsApp, address, social links
       │
       ├── Step 4: Payment Setup
       │   └── Enable bKash/Nagad, enter numbers
       │
       ├── [Skip Setup — do it later]
       │
       ▼
[Dashboard — First Time Experience]
       │
       ├── "Welcome, Hana! Let's set up your store."
       ├── Checklist:
       │   ☐ Upload your logo
       │   ☐ Add your first product
       │   ☐ Set up payment methods
       │   ☐ Preview your storefront
       │
       ├── [+ Add Your First Product] → prominent CTA
       │
       ▼
[Add First Product]
       │
       ├── See: owner-add-product-flow.md
       │
       ▼
[Store is Live!]
       │
       ├── Storefront accessible at: hanasboutique.closetrent.com.bd
       ├── First product visible to guests
       ├── Owner can share store link on social media
       │
       ▼
[Ongoing Operations]
       │
       ├── Add more products
       ├── Receive and manage bookings
       ├── Configure advanced settings
       └── Upgrade plan as business grows
```

---

## Default Seeding

When a new tenant is created, the following data is auto-seeded:

| Entity | Default Data |
|---|---|
| Categories | Saree, Lehenga, Sherwani, Gown, Jewelry, Others |
| Events | Wedding, Holud, Reception, Eid, Birthday, Anniversary, Party |
| Store Settings | Default colors (#E91E63, #9C27B0), BDT currency, Bangla date format |
| Subscription | Free plan (or 14-day trial for Pro) |

---

## Setup Completion Tracking

The dashboard shows a completion checklist until all items are done:

| Item | Detection |
|---|---|
| Logo uploaded | `store_settings.logo_url IS NOT NULL` |
| First product added | `products.count > 0` |
| Payment configured | At least one payment method enabled |
| Store previewed | Tracked via localStorage flag |

Checklist disappears after all items completed (or owner dismisses it).

---

## Time to First Value

Target: Owner should have their **first product live within 15 minutes** of signing up.

| Step | Target Time |
|---|---|
| Registration | 2 minutes |
| Setup wizard | 3 minutes (can skip) |
| Add first product | 8-10 minutes |
| **Total** | **~15 minutes** |
