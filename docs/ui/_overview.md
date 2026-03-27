# UI Specs — Overview

## Design System

### Typography

| Level | Font | Weight | Size (Mobile) | Size (Desktop) |
|---|---|---|---|---|
| H1 | Inter | 700 | 24px | 32px |
| H2 | Inter | 600 | 20px | 24px |
| H3 | Inter | 600 | 18px | 20px |
| Body | Inter | 400 | 14px | 16px |
| Small | Inter | 400 | 12px | 14px |
| Caption | Inter | 400 | 11px | 12px |

Load via Google Fonts: `Inter` (400, 500, 600, 700).

### Color Palette (Static / System)

| Token | Value | Usage |
|---|---|---|
| `--bg-primary` | `#FFFFFF` | Page backgrounds |
| `--bg-secondary` | `#F9FAFB` | Card/section backgrounds |
| `--bg-dark` | `#111827` | Dark sections, owner sidebar |
| `--text-primary` | `#111827` | Headlines, primary text |
| `--text-secondary` | `#6B7280` | Subtitles, labels |
| `--text-muted` | `#9CA3AF` | Placeholder, hint text |
| `--border` | `#E5E7EB` | Borders, dividers |
| `--success` | `#10B981` | Available, completed, success |
| `--warning` | `#F59E0B` | Pending, caution |
| `--danger` | `#EF4444` | Errors, overdue, unavailable |
| `--info` | `#3B82F6` | Info badges |

### Brand Colors (Dynamic / Per-Tenant)

| Token | Source | Usage |
|---|---|---|
| `--brand-primary` | Tenant `primaryColor` | Buttons, links, active states |
| `--brand-secondary` | Tenant `secondaryColor` | Badges, subtle highlights |

### Spacing Scale

Base unit: 4px. Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96.

### Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 4px | Small elements, tags |
| `--radius-md` | 8px | Cards, inputs |
| `--radius-lg` | 12px | Modals, larger cards |
| `--radius-xl` | 16px | Banners, hero sections |
| `--radius-full` | 9999px | Avatars, pills, circular buttons |

### Shadows

| Token | Value | Usage |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Cards, subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Dropdowns, popovers |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, drawers |

---

## Breakpoints

| Name | Min Width | Target |
|---|---|---|
| Mobile | 0px | Phones (default) |
| Tablet | 768px | Tablets, small laptops |
| Desktop | 1024px | Laptops |
| Wide | 1280px | Large monitors |

**Mobile-first**: All styles default to mobile, then scale up via media queries.

---

## Component Library

### Buttons

| Variant | Style | Usage |
|---|---|---|
| Primary | Solid `--brand-primary`, white text | Main CTAs |
| Secondary | Outlined `--brand-primary`, transparent fill | Secondary actions |
| Ghost | No border, text only | Tertiary actions |
| Danger | Solid `--danger` | Delete, cancel |
| Disabled | Gray, no pointer | Inactive state |

Sizes: `sm` (32px height), `md` (40px), `lg` (48px).

### Inputs

- Border: `--border`, radius `--radius-md`
- Focus: `--brand-primary` ring (2px)
- Error: `--danger` border + red helper text
- Label above input, placeholder inside

### Cards

- Background: `--bg-primary`
- Border: 1px `--border`
- Radius: `--radius-md`
- Hover: shadow-sm → shadow-md transition
- Padding: 16px

### Badges / Tags

- Small pill shapes with `--radius-full`
- Status colors: green (available), red (unavailable), yellow (pending), gray (draft)

### Modals / Bottom Sheets

- Mobile: bottom sheet sliding up
- Desktop: centered modal with backdrop
- Close via X button or backdrop click

---

## Page Index

### Guest Portal (Storefront)

| Page | File | Route |
|---|---|---|
| Storefront Layout | [storefront-layout.md](./guest/storefront-layout.md) | (wrapper) |
| Shopping / Browse | [shopping-page.md](./guest/shopping-page.md) | `/` or `/products` |
| Product Detail | [product-details.md](./guest/product-details.md) | `/products/:slug` |
| Cart | [cart-page.md](./guest/cart-page.md) | `/cart` |
| Checkout | [checkout-page.md](./guest/checkout-page.md) | `/checkout` |
| Confirmation | [booking-confirmation.md](./guest/booking-confirmation.md) | `/booking/confirmation` |

### Owner Portal (Dashboard)

| Page | File | Route |
|---|---|---|
| Dashboard Home | [dashboard.md](./owner/dashboard.md) | `/dashboard` |
| Add Product | [add-product.md](./owner/add-product.md) | `/dashboard/products/new` |
| Edit Product | [edit-product.md](./owner/edit-product.md) | `/dashboard/products/:id/edit` |
| Product List | [product-list.md](./owner/product-list.md) | `/dashboard/products` |
| Booking Mgmt | [booking-management.md](./owner/booking-management.md) | `/dashboard/bookings` |
| Order Detail | [order-management.md](./owner/order-management.md) | `/dashboard/bookings/:id` |
| Customers | [customer-list.md](./owner/customer-list.md) | `/dashboard/customers` |
| Analytics | [analytics.md](./owner/analytics.md) | `/dashboard/analytics` |
| Store Settings | [store-settings.md](./owner/store-settings.md) | `/dashboard/settings` |
| Staff | [staff-management.md](./owner/staff-management.md) | `/dashboard/staff` |
