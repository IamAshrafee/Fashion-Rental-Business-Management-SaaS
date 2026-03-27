# UI Spec: Storefront Layout

## Overview

The shared layout wrapper for all guest-facing pages. Provides consistent header, footer, and navigation. Fully branded per tenant via CSS custom properties.

---

## Header (Sticky)

### Mobile Layout (< 768px)

```
┌────────────────────────────────────────────┐
│ ☰  [Logo / Business Name]    🔍  🛒(2)    │
└────────────────────────────────────────────┘
```

- **☰ Hamburger**: Opens side drawer with category list
- **Logo**: Links to homepage. Falls back to business name text if no logo.
- **🔍 Search icon**: Taps to expand full-width search bar
- **🛒 Cart icon**: Badge showing item count. Links to `/cart`

### Desktop Layout (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────┐
│ [Logo]   [Search Bar _________________________ 🔍]    🛒(2)     │
│          [All] [Saree] [Lehenga] [Wedding] [Holud] [Under ৳5K]  │
└──────────────────────────────────────────────────────────────────┘
```

- Logo left-aligned
- Search bar center, expandable
- Cart icon right-aligned
- Quick filter pills in a second row (horizontally scrollable)

### Search Bar (Expanded)

```
┌────────────────────────────────────────────┐
│ ← [Search products...____________] 🔍      │
│                                            │
│  Recent: Royal Saree, Wedding Lehenga      │
│  Popular: Banarasi, Sherwani, Bridal       │
└────────────────────────────────────────────┘
```

Auto-suggest dropdown appears after 3+ characters (debounced 300ms).

---

## Mobile Navigation Drawer

Slides in from left on hamburger tap.

```
┌──────────────────────────┐
│  [Logo]              ✕   │
│ ─────────────────────── │
│  🏠 Home                 │
│  📂 Categories           │
│    ├─ Saree (24)         │
│    ├─ Lehenga (18)       │
│    ├─ Sherwani (12)      │
│    └─ Gown (8)           │
│  🎉 Events               │
│    ├─ Wedding (35)       │
│    ├─ Holud (20)         │
│    └─ Reception (15)     │
│ ─────────────────────── │
│  📞 Contact: 01712345678 │
│  💬 WhatsApp             │
│ ─────────────────────── │
│  📱 FB  📸 IG  🎵 TikTok │
└──────────────────────────┘
```

---

## Footer

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  [Logo]                                                         │
│  Premium Wedding Dress Rentals (tagline)                        │
│                                                                  │
│  Contact                    Quick Links                          │
│  📞 01712345678             Home                                 │
│  💬 WhatsApp                Categories                           │
│  ✉️ hana@boutique.com       About Us                             │
│  📍 Dhanmondi, Dhaka                                            │
│                                                                  │
│  Follow Us                                                       │
│  [FB] [IG] [TikTok] [YouTube]                                   │
│                                                                  │
│  ─────────────────────────────────────────────                  │
│  © 2026 Hana's Boutique. Powered by ClosetRent                  │
└──────────────────────────────────────────────────────────────────┘
```

"Powered by ClosetRent" — mandatory for free plan, optional for paid plans.

---

## WhatsApp Floating Button

Fixed position, bottom-right corner, 56px circular button.

```
                                       ┌─────┐
                                       │ 💬  │ ← Green WhatsApp icon
                                       └─────┘
```

- Only shows if `whatsapp` number is configured
- Click opens: `wa.me/{number}?text=Hi, I'm interested in your products`
- On product detail page: includes product name in pre-filled message
- Slightly above the bottom nav on mobile

---

## States

### Loading State
- Skeleton loading: gray pulse rectangles matching content layout
- Header always visible during load

### Store Not Found (404)
```
Store not found.
Check the URL or visit closetrent.com.bd to find your store.
```

### Store Suspended
```
This store is temporarily unavailable.
Please check back later.
```

---

## Responsive Behavior

| Element | Mobile | Desktop |
|---|---|---|
| Header | Hamburger + icons | Full nav + search |
| Filter pills | Scrollable row | Scrollable row |
| Product grid | 2 columns | 3-4 columns |
| Footer | Stacked single column | Multi-column grid |
| WhatsApp button | Always visible | Always visible |
