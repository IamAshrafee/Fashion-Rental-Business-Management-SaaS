# Product Vision — ClosetRent SaaS

## What We Are Building

A SaaS platform that enables fashion rental businesses to manage their entire operation online — replacing manual inbox/WhatsApp/Excel workflows with a structured, fast, and beautiful digital system.

This is not a generic e-commerce platform. This is purpose-built for the **fashion rental** business model, where items are rented for a fixed duration, returned, and rented again.

---

## The Problem We Are Solving

A typical fashion rental business in Bangladesh today operates like this:

1. Customer DMs on Facebook or Instagram asking about a dress
2. Owner manually replies with photos and pricing
3. Customer asks for availability — owner checks notebook or Excel
4. Booking confirmed via WhatsApp, payment via bKash manually
5. Owner manually tracks return dates
6. No system for deposits, late fees, or damage tracking

**This is slow, error-prone, and limits how many customers the business can serve.**

The bigger the business gets, the worse this workflow breaks. Missed messages = lost sales. Forgotten returns = lost inventory. No visibility = no growth.

Our platform replaces this entire flow with a system that is faster, more reliable, and scales with the business.

---

## Core Principles

Every decision in this product — design, architecture, feature prioritization — must align with these principles:

### 1. Simplicity
Every screen must feel obvious. No training required. A business owner should be able to add a product in under 3 minutes. A customer should be able to place a booking in under 60 seconds.

### 2. Speed
Pages load fast. Actions complete fast. No unnecessary spinners, no waiting. Performance is a feature.

### 3. High Conversion
Every UI decision on the guest side pushes toward a completed booking. Remove friction. Reduce steps. Show trust signals. Make the "Book Now" button impossible to miss.

### 4. Mobile-First
The primary device for both business owners and customers is a smartphone. Every screen is designed for phone first, then adapted up to tablet and desktop.

### 5. Zero Unnecessary Friction
Every field, every step, every screen must justify its existence. If removing it does not hurt the business, remove it. No forced account creation. No mandatory fields that are not essential for the booking.

### 6. Bangladesh-Ready
- Currency: ৳ (BDT)
- Language: Bengali support
- Payment: bKash, Nagad, SSLCommerz
- Courier: Pathao, Steadfast
- Trust: Local trust signals (phone number, WhatsApp, store rating)
- Address: Bangladesh address format (area, thana, district)

---

## Three-Portal Architecture

The system has three distinct user interfaces:

| Portal | Who Uses It | Purpose |
|---|---|---|
| **Guest Portal** | End customers (shoppers) | Browse products, check availability, book, checkout |
| **Business Owner Portal** | Business owners and their staff | Manage inventory, orders, customers, analytics, settings |
| **SaaS Admin Portal** | Platform operators (us) | Manage tenants, billing, support, platform-level settings |

Each portal has completely different UX goals:
- Guest Portal = **conversion-optimized shopping experience**
- Owner Portal = **efficient business management dashboard**
- Admin Portal = **platform operations and oversight**

---

## Multi-Tenant Model

Each business owner gets their own isolated store:

- **Subdomain**: `hanasboutique.closetrent.com.bd`
- **Custom domain** (future): `hanasboutique.com`

All businesses share the same codebase and database, but their data is completely isolated by `tenant_id`. Customers shop within one business's store. Business owners never see each other's data.

---

## Target Market

### Primary Customers (Business Owners)
- Wedding saree rental businesses
- Sherwani and men's ethnic wear rental businesses
- Vacation and casual dress rental shops
- Multi-category fashion rental boutiques (dresses, shoes, bags, accessories)
- Individual entrepreneurs renting from home inventory

**Profile**: Not deeply technical, but comfortable with smartphones. Currently managing via Facebook Page + WhatsApp + manual Excel. Willing to pay for a system that saves them time and helps them serve more customers.

### End Customers (Guests / Shoppers)
- Women aged 18–40 looking for wedding/event outfits
- Budget-conscious customers who prefer renting over buying
- Customers arriving from Facebook/Instagram ads, WhatsApp forwards, or TikTok

**Profile**: Often first-time users of the platform. Must be able to place a booking without onboarding or tutorial. Primarily mobile users.

### Traffic Sources
- **Facebook** (primary — organic posts and paid ads)
- **Instagram** (product photos and reels)
- **WhatsApp** (sharing product links directly with customers)
- **TikTok** (video content showing dresses)

**Implication**: The platform must work perfectly when a user lands directly on a product page from a social media link. Deep links to specific products are critical.

---

## What This Product Is NOT

- This is **not** a general e-commerce platform. It is built specifically for rental businesses.
- This is **not** a marketplace. Each store is independent. We do not aggregate products across businesses.
- This is **not** an MVP. We are building a complete, production-grade product from day one.
- This is **not** limited to dresses. It supports any fashion item: sarees, sherwanis, shoes, bags, accessories.

---

## Success Metrics

For business owners:
- Time to add a product: < 3 minutes
- Time to process a booking: < 30 seconds
- Reduction in missed/lost bookings vs manual workflow

For end customers:
- Time from landing to completed booking: < 2 minutes
- Bounce rate on product pages: < 40%
- Cart abandonment rate: < 50%

For the platform:
- Business owner onboarding time: < 15 minutes (sign up → store setup → first product listed)
- Monthly active tenants
- Revenue per tenant
