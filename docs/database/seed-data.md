# Database Seed Data

## Overview

Data that must exist when the platform starts. Includes system-level seeds (run once on initial deployment) and tenant-level seeds (run when a new tenant signs up).

---

## System-Level Seed (Initial Deployment)

### 1. SaaS Admin User

```json
{
  "fullName": "Platform Admin",
  "phone": "admin-phone",
  "email": "admin@closetrent.com",
  "password": "hashed-secure-password",
  "role": "saas_admin"
}
```

### 2. Subscription Plans

Plans are stored in DB (SaaS admin configurable), seeded with defaults:

```json
[
  {
    "name": "Free",
    "slug": "free",
    "price": 0,
    "billingCycle": "monthly",
    "limits": {
      "maxProducts": 20,
      "maxImagesPerProduct": 3,
      "maxStorageMB": 1024,
      "maxStaffAccounts": 0,
      "maxBannerImages": 1,
      "features": {
        "customDomain": false,
        "sslcommerzPayments": false,
        "courierApi": false,
        "smsNotifications": false,
        "advancedAnalytics": false,
        "prioritySupport": false
      }
    }
  },
  {
    "name": "Pro",
    "slug": "pro",
    "price": 2500,
    "billingCycle": "monthly",
    "limits": {
      "maxProducts": -1,
      "maxImagesPerProduct": 10,
      "maxStorageMB": 10240,
      "maxStaffAccounts": 3,
      "maxBannerImages": 5,
      "features": {
        "customDomain": true,
        "sslcommerzPayments": true,
        "courierApi": true,
        "smsNotifications": true,
        "advancedAnalytics": true,
        "prioritySupport": false
      }
    }
  },
  {
    "name": "Enterprise",
    "slug": "enterprise",
    "price": 7500,
    "billingCycle": "monthly",
    "limits": {
      "maxProducts": -1,
      "maxImagesPerProduct": 20,
      "maxStorageMB": 51200,
      "maxStaffAccounts": 10,
      "maxBannerImages": 10,
      "features": {
        "customDomain": true,
        "sslcommerzPayments": true,
        "courierApi": true,
        "smsNotifications": true,
        "advancedAnalytics": true,
        "prioritySupport": true
      }
    }
  }
]
```

`-1` = unlimited.

### 3. System Colors

Master color list with hex values. Shared across all tenants.

```json
[
  { "name": "Red", "hex": "#EF4444", "group": "primary" },
  { "name": "Maroon", "hex": "#7F1D1D", "group": "primary" },
  { "name": "Pink", "hex": "#EC4899", "group": "primary" },
  { "name": "Rose", "hex": "#F43F5E", "group": "primary" },
  { "name": "Orange", "hex": "#F97316", "group": "primary" },
  { "name": "Gold", "hex": "#EAB308", "group": "primary" },
  { "name": "Yellow", "hex": "#FACC15", "group": "primary" },
  { "name": "Green", "hex": "#22C55E", "group": "primary" },
  { "name": "Teal", "hex": "#14B8A6", "group": "primary" },
  { "name": "Cyan", "hex": "#06B6D4", "group": "primary" },
  { "name": "Blue", "hex": "#3B82F6", "group": "primary" },
  { "name": "Navy", "hex": "#1E3A5F", "group": "primary" },
  { "name": "Indigo", "hex": "#6366F1", "group": "primary" },
  { "name": "Purple", "hex": "#A855F7", "group": "primary" },
  { "name": "Violet", "hex": "#8B5CF6", "group": "primary" },
  { "name": "Magenta", "hex": "#D946EF", "group": "primary" },
  { "name": "Brown", "hex": "#92400E", "group": "neutral" },
  { "name": "Beige", "hex": "#D4A574", "group": "neutral" },
  { "name": "Cream", "hex": "#FFFDD0", "group": "neutral" },
  { "name": "Ivory", "hex": "#FFFFF0", "group": "neutral" },
  { "name": "White", "hex": "#FFFFFF", "group": "neutral" },
  { "name": "Off-White", "hex": "#FAF9F6", "group": "neutral" },
  { "name": "Silver", "hex": "#C0C0C0", "group": "metallic" },
  { "name": "Grey", "hex": "#6B7280", "group": "neutral" },
  { "name": "Charcoal", "hex": "#374151", "group": "neutral" },
  { "name": "Black", "hex": "#000000", "group": "neutral" },
  { "name": "Peach", "hex": "#FFDAB9", "group": "pastel" },
  { "name": "Coral", "hex": "#FF7F50", "group": "primary" },
  { "name": "Salmon", "hex": "#FA8072", "group": "primary" },
  { "name": "Burgundy", "hex": "#800020", "group": "primary" },
  { "name": "Wine", "hex": "#722F37", "group": "primary" },
  { "name": "Rust", "hex": "#B7410E", "group": "primary" },
  { "name": "Copper", "hex": "#B87333", "group": "metallic" },
  { "name": "Bronze", "hex": "#CD7F32", "group": "metallic" },
  { "name": "Olive", "hex": "#808000", "group": "primary" },
  { "name": "Mint", "hex": "#98FF98", "group": "pastel" },
  { "name": "Lavender", "hex": "#E6E6FA", "group": "pastel" },
  { "name": "Lilac", "hex": "#C8A2C8", "group": "pastel" },
  { "name": "Sky Blue", "hex": "#87CEEB", "group": "pastel" },
  { "name": "Baby Pink", "hex": "#F4C2C2", "group": "pastel" },
  { "name": "Multi-Color", "hex": "#GRADIENT", "group": "special" }
]
```

---

## Tenant-Level Seed (New Signup)

Managed by SaaS admin as **Starter Templates**.

### Default Starter Template (Fashion Rental)

```json
{
  "templateName": "Fashion Rental",
  "categories": [
    { "name": "Saree", "subcategories": ["Banarasi", "Silk", "Cotton", "Designer"] },
    { "name": "Lehenga", "subcategories": ["Bridal", "Party", "Designer"] },
    { "name": "Gown", "subcategories": ["Evening", "Ball", "Cocktail"] },
    { "name": "Sherwani", "subcategories": ["Wedding", "Party"] },
    { "name": "Jewelry", "subcategories": ["Necklace", "Earrings", "Bangles", "Set"] },
    { "name": "Accessories", "subcategories": ["Clutch", "Shoes", "Dupatta"] }
  ],
  "events": [
    "Wedding", "Holud", "Reception", "Engagement",
    "Eid", "Birthday", "Anniversary", "Party",
    "Corporate Event", "Photoshoot", "Prom"
  ],
  "storeSettings": {
    "defaultBufferDays": 1,
    "bookingExpiryHours": 48,
    "cancellationPolicy": "free_before_shipped"
  }
}
```

SaaS admin can create multiple templates for different markets/industries.

---

## Seed Script

```typescript
// backend/prisma/seed.ts
async function main() {
  // 1. Create admin user
  await prisma.user.upsert({ where: { phone: 'admin' }, ... });

  // 2. Create subscription plans
  for (const plan of PLANS) {
    await prisma.subscriptionPlan.upsert({ where: { slug: plan.slug }, ... });
  }

  // 3. Create system colors
  for (const color of COLORS) {
    await prisma.color.upsert({ where: { name: color.name }, ... });
  }

  // 4. Create starter templates
  for (const template of TEMPLATES) {
    await prisma.starterTemplate.upsert({ ... });
  }
}
```

Run: `npx prisma db seed`
