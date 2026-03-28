# P17 — Guest Portal: Storefront & Browse

| | |
|---|---|
| **Phase** | 6 — Guest Portal Frontend |
| **Estimated Time** | 4–5 hours |
| **Requires** | P11 (frontend foundation), P04 (product APIs) |
| **Unlocks** | P18 |
| **Agent Skills** | `nextjs-best-practices`, `nextjs-app-router-patterns`, `vercel-react-best-practices`, `tailwindcss-mobile-first` · Optional: `tailwind-css-patterns`, `tailwindcss-advanced-layouts` |

---

## REFERENCE DOCS

- `docs/ui/guest/storefront-layout.md` — Storefront layout spec
- `docs/ui/guest/shopping-page.md` — Product listing page spec
- `docs/ui/guest/product-details.md` — Product detail page spec
- `docs/features/search-system.md` — Search integration
- `docs/features/filter-system.md` — Filter system
- `docs/architecture-decisions.md` — ADR-01 (custom Tailwind for storefront, NOT ShadCN)

---

## SCOPE

> ⚠️ **IMPORTANT**: The guest storefront uses **custom Tailwind CSS only** — NOT ShadCN/ui. This is per ADR-01. The storefront must feel like a boutique fashion website, not a dashboard.

### 1. Storefront Layout

**Tenant-branded design:**
- CSS custom properties from tenant's store_settings (primary color, secondary, fonts)
- Logo in header
- Navigation: Home, Categories (dropdown), Search, Cart icon (with count badge)
- Footer: About text, contact info, social links, WhatsApp link
- Fully responsive (mobile-first design)
- Modern, premium aesthetics — not a generic template

### 2. Home Page (`/`)

- Hero section with store tagline + featured image/banner
- Featured products carousel (latest published, or manually featured)
- Categories section (grid of category cards with images)
- "Browse All Products" CTA
- Event sections (if tenant has events like "Wedding Collection")

### 3. Product Listing Page (`/shop` or `/products`)

- Product grid (responsive: 2 cols mobile, 3 tablet, 4 desktop)
- Each product card: featured image, name, category, base price, availability badge
- Hover effect: show second image or quick-view button
- **Filter sidebar** (mobile: bottom sheet or drawer):
  - Category filter (dropdown or tree)
  - Event filter (multi-select)
  - Color filter (color swatches)
  - Price range (min/max inputs or slider)
  - Availability filter (available now, show all)
- **Sort**: Newest, Price ↑, Price ↓, Most Popular
- Infinite scroll or "Load More" pagination
- Search results page (same layout, triggered by search bar)

### 4. Category Page (`/category/:slug`)

- Same as product listing but pre-filtered by category
- Category name + description header
- Subcategory tabs if applicable

### 5. Product Detail Page (`/product/:slug`)

- **Image gallery**: Main image + thumbnail strip, click to zoom, swipe on mobile
- **Product info**: Name, category, price display (formatted per locale), availability status
- **Variant selector**: Color swatches (clickable, changes image gallery)
- **Size info**: Size chart display (standard or custom)
- **Rental date picker**: Calendar to pick start date + end date
  - Shows blocked dates (from availability API)
  - Shows price calculation as dates change
- **Service options**: Checkbox for cleaning fee, backup size, try-on (with prices)
- **"Add to Cart" button** (adds to localStorage cart)
- **Price breakdown**: Base rental + extended days + fees + deposit = total
- **Product details**: Custom detail sections (from product_details)
- **FAQs**: Accordion-style FAQ section
- **Related products**: Products from same category

### 6. Search

- Search bar in header (visible on all pages)
- Typeahead/autocomplete suggestions (optional for v1)
- Search results use same product grid layout
- "No results" state with suggestions

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | Tenant-branded storefront layout | Loads tenant colors, logo, footer info |
| 2 | Home page | Hero, featured products, categories |
| 3 | Product listing with filters | Grid, filter sidebar, sort, pagination |
| 4 | Category pages | Pre-filtered listing |
| 5 | Product detail page | Gallery, variants, date picker, add-to-cart |
| 6 | Availability calendar | Blocked dates shown, price updates |
| 7 | Search | Search bar → results page |
| 8 | Mobile responsive | All pages work on mobile |
| 9 | Premium aesthetics | Modern, branded, not generic |

---

## OUTPUT CONTRACTS

| Contract | Used By |
|---|---|
| Add-to-cart (localStorage) | P18 (Guest Checkout — reads cart) |
| Product detail page route | P18 (Guest Checkout — "continue shopping" link) |
| Storefront layout | P18 (Checkout pages use same layout) |
