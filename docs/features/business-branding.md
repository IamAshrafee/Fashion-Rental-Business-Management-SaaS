# Feature Spec: Business Branding

## Overview

Each tenant can customize their storefront's appearance and business information. The same codebase renders a different look for each store based on branding settings.

---

## Branding Settings

### Visual Branding

| Setting | Type | Required | Description |
|---|---|---|---|
| Logo | Image upload | Yes | Store logo. Shown in header, emails, and SMS signatures. |
| Favicon | Image upload | No | Browser tab icon. Defaults to platform favicon. |
| Primary Color | Color picker + hex input | Yes | Main brand color (buttons, links, active states) |
| Secondary Color | Color picker + hex input | No | Accent color (badges, highlights) |
| Banner Images | Image upload (multi) | No | Hero banners for storefront homepage |

### Business Information

| Setting | Type | Required | Description |
|---|---|---|---|
| Business Name | Text | Yes | Store name displayed everywhere |
| Tagline | Text | No | Short description under logo (e.g., "Premium Wedding Dress Rentals") |
| About | Rich text | No | About the business (shown on storefront) |
| Phone Number | Text | Yes | Primary contact number |
| WhatsApp Number | Text | No | WhatsApp for customer chat |
| Email | Text | No | Business email |
| Address | Text | No | Physical store address (if any) |

### Social Links

| Setting | Type | Required |
|---|---|---|
| Facebook Page URL | URL | No |
| Instagram URL | URL | No |
| TikTok URL | URL | No |
| YouTube URL | URL | No |

---

## How Branding Is Applied

### Storefront (Guest Portal)

**Header**:
- Logo on the left
- Business name (if no logo, or alongside logo)
- Brand-colored search bar and cart icon

**Homepage**:
- Banner carousel (if banners uploaded)
- Brand-colored buttons and highlights

**Product Cards**:
- Brand-colored price text
- Brand-colored "Book Now" / "Add to Cart" button

**Footer**:
- Business name
- Contact info (phone, WhatsApp, email, address)
- Social media links with icons
- Copyright: "© 2026 {BusinessName}. Powered by ClosetRent"

**Buttons & Interactive Elements**:
- Primary color applied to: main buttons, active tabs, progress bars, links
- Secondary color applied to: badges, tags, subtle highlights

### Technical Implementation

Branding colors are applied via CSS custom properties:

```css
:root {
  --brand-primary: #E91E63;    /* From tenant settings */
  --brand-secondary: #9C27B0;  /* From tenant settings */
}
```

All components reference these variables instead of hardcoded colors.

Tenant branding data is fetched on page load via `/api/tenant/info` and cached.

---

## Store Settings Page (Owner Portal)

### Layout

Organized in tabs or sections:

```
Store Settings

📐 Branding
   Logo: [Upload] [Preview]
   Favicon: [Upload] [Preview]
   Primary Color: [Color Picker] #E91E63
   Secondary Color: [Color Picker] #9C27B0
   Banners: [Upload] [Drag to reorder]

📋 Business Info
   Business Name: [Hana's Boutique]
   Tagline: [Premium Wedding Dress Rentals]
   Phone: [01712345678]
   WhatsApp: [01712345678]
   Email: [hana@boutique.com]
   Address: [Dhanmondi, Dhaka]
   About: [Rich text editor]

🔗 Social Links
   Facebook: [https://facebook.com/hanasboutique]
   Instagram: [https://instagram.com/hanasboutique]
   TikTok: [https://tiktok.com/@hanasboutique]

[Save Changes] [Preview Store →]
```

### Live Preview

"Preview Store" button opens the storefront in a new tab with the current branding applied, even before saving (using preview mode). This lets the owner see how changes look before committing.

---

## Default Branding

When a tenant is created and hasn't set up branding yet:

| Setting | Default Value |
|---|---|
| Logo | Platform default logo placeholder |
| Primary Color | Platform default (e.g., #6366F1) |
| Secondary Color | Platform default (e.g., #EC4899) |
| Business Name | From sign-up form |
| Banners | None (show category grid or featured products instead) |

---

## WhatsApp Integration

If WhatsApp number is configured:

**Guest Portal shows**:
- Floating WhatsApp button (bottom-right corner)
- Click opens WhatsApp with pre-filled message:
  ```
  https://wa.me/8801712345678?text=Hi, I'm interested in your products at {StoreName}
  ```
- On product detail page, the pre-filled message includes the product name:
  ```
  ?text=Hi, I'm interested in renting "Royal Banarasi Saree" from {StoreName}
  ```

This is critical for Bangladesh where many customers prefer WhatsApp/phone before committing to a booking online.

---

## Business Rules Summary

1. Every tenant can customize logo, colors, business info, and social links
2. Branding applied via CSS custom properties for consistent theming
3. Default branding provided for new tenants before setup
4. WhatsApp floating button with pre-filled messages
5. Social links shown in footer with icons
6. "Powered by ClosetRent" in footer (mandatory for free plan, optional for paid)
7. Live preview available before saving changes
8. Branding data cached for performance
