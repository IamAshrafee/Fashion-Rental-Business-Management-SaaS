# Feature Spec: Stock / Inventory Management

## Overview

Stock/Inventory is the foundation of the entire system. This is where business owners add, configure, and manage their rental products. Everything in the guest experience, booking system, and order management depends on the data structured here.

This spec covers the **product entity** as a whole — the container that holds variants, pricing, sizing, images, and all metadata. Individual sub-systems (color variants, pricing, sizes, etc.) have their own detailed specs.

---

## Product Entity — Core Fields

### Product Name
- **Type**: Text input
- **Required**: Yes
- **Max length**: 200 characters
- **Validation**: Cannot be empty, trimmed whitespace
- **Visibility**: Public (shown to guests)
- **Purpose**: The display name shown on product cards and detail pages

### Product Slug
- **Type**: Auto-generated from product name
- **Format**: kebab-case (e.g., `royal-banarasi-wedding-saree`)
- **Uniqueness**: Must be unique within the tenant
- **Used for**: URL routing (`/product/royal-banarasi-wedding-saree`)
- **Editable**: No (auto-generated, but owner can override)

### Category
- **Type**: Dropdown, single select
- **Required**: Yes
- **Source**: Tenant's category list (see [category-management.md](./category-management.md))
- **Visibility**: Public
- **Purpose**: Top-level product classification, used for filtering and organization

### Subcategory
- **Type**: Dropdown, single select, dependent on selected category
- **Required**: No (optional)
- **Source**: Subcategories under the selected category
- **Visibility**: Public
- **Purpose**: Second-level classification for more specific filtering

### Events
- **Type**: Multi-select tags
- **Required**: No (but recommended)
- **Source**: Tenant's event list (see [category-management.md](./category-management.md))
- **Examples**: Wedding, Holud, Reception, Birthday, Club Party, Vacation
- **Visibility**: Public
- **Purpose**: Helps guests find products suitable for their occasion. Improves filtering and discoverability.

### Product Description
- **Type**: Rich text editor
- **Required**: No
- **Max length**: 5000 characters
- **Visibility**: Public
- **Supports**: Bold, italic, bullet lists, numbered lists, headings
- **Does NOT support**: Images within description (images are handled by the variant system)
- **Purpose**: Detailed product information — fabric, styling notes, occasion recommendations, care instructions

---

## Product Status System

A product can be in one of the following states:

### Status: Draft
- Product is created but not visible to guests
- Owner can take time to fill in all details
- Cannot be booked
- Only visible in owner portal

### Status: Published
- Product is visible to guests in the storefront
- Can be booked (if availability allows)
- Appears in search and filter results

### Status: Archived
- Product is hidden from guests
- Cannot be booked
- Owner can un-archive to re-publish
- Keeps all data intact (unlike delete)

### Availability Toggle
Independent of status, a published product has availability control:

| Setting | Meaning |
|---|---|
| **Available** | Product can be booked for dates that are not already reserved |
| **Not Available** | Product cannot be booked, even if dates are free |

If "Not Available", owner can optionally set:
- **Available From Date**: The date when this product will become available
- **Reason** (internal): Why it's unavailable (e.g., "Arriving next week", "Under repair")

**Use case**: Business announces upcoming products on social media. The product is listed but marked as "Not Available" with a future date. Guests can see it, know when it's coming, but cannot book yet.

---

## Internal Business Fields

These fields are for business owner internal use. Each has a visibility toggle.

### Purchase Date
- **Type**: Date picker
- **Required**: No
- **Visibility**: Internal only (no public toggle)
- **Purpose**: Record when the item was purchased. Useful for tracking asset age.

### Purchase Price
- **Type**: Number input (৳)
- **Required**: No
- **Visibility**: Toggle — "Show publicly" / "Keep private"
- **Default**: Private
- **Purpose**:
  - Internal: Cost tracking, profit calculation, damage compensation basis
  - If public: Transparency signal for customers ("Retail value: ৳45,000")
- **Important**: This value is used for target recovery calculation and damage/loss liability

### Item Country
- **Type**: Text input
- **Required**: No
- **Visibility**: Toggle — "Show publicly" / "Keep private"
- **Default**: Private
- **Examples**: "India", "Pakistan", "China", "Local"
- **Purpose**:
  - Internal: Sourcing information
  - If public: Quality/origin signal for customers

---

## Product Creation Flow (Owner Portal)

The product creation form should be organized into clear sections. It should NOT be a single long form — use a multi-step or tabbed approach.

### Recommended Sections

| Step/Tab | Contains |
|---|---|
| **1. Basic Info** | Name, category, subcategory, events, description |
| **2. Images & Variants** | Color variants, images per variant, main/identical colors |
| **3. Size** | Size mode selection, size values |
| **4. Pricing** | Rental pricing mode, price values, internal min price |
| **5. Services** | Deposit, cleaning fee, backup size, try-before-rent |
| **6. Logistics** | Extended rental, late fees, shipping policy |
| **7. Details & FAQ** | Product details builder, FAQ entries |
| **8. Business Info** | Purchase date/price, country, target, availability |

### Save Behavior
- Owner can save at any step as **draft**
- Only requires Product Name to save as draft
- All other fields are optional until publish
- Publish validates that minimum required fields are filled
- Required for publish: Name, Category, at least one variant with a featured image, at least one pricing mode

---

## Product Editing

- All fields editable after creation
- Changes to published products are immediately reflected in storefront
- Editing does not affect existing bookings (bookings reference product snapshot at time of booking — future consideration)
- Image reordering and replacement supported
- Variant addition/removal supported

---

## Product Deletion

- Soft delete: Product marked as deleted, not removed from database
- Deleted products are not visible to guests
- Existing bookings/orders referencing the product remain intact
- Owner can permanently delete from trash (future feature)
- Hard delete removes all data including images from MinIO

---

## Product List View (Owner Portal)

The owner needs to see all products with quick filtering and actions.

### Columns / Information Shown
- Thumbnail (featured image of first variant)
- Product name
- Category
- Status (Draft / Published / Archived)
- Availability (Available / Not Available)
- Rental price (primary pricing)
- Total bookings count
- Target progress (X / Y rentals)
- Created date

### Actions
- Edit
- Duplicate (create copy with modified name)
- Change status (Draft → Published, Published → Archived, etc.)
- Toggle availability
- Delete

### Filtering
- By status
- By category
- By availability
- Search by name

### Sorting
- Name (A-Z, Z-A)
- Price (low-high, high-low)
- Newest first
- Most booked

---

## Relationships to Other Features

| Feature | Relationship |
|---|---|
| [Color Variant System](./color-variant-system.md) | Product has many variants. Each variant has images and colors. |
| [Size System](./size-system.md) | Product has a size configuration (one of 4 modes). |
| [Rental Pricing](./rental-pricing.md) | Product has pricing rules (one or more modes). |
| [Service & Protection](./service-protection.md) | Product has optional service fees (deposit, cleaning, backup). |
| [Timing & Logistics](./timing-logistics.md) | Product has timing rules (extended rental, late fees, shipping). |
| [Try-Before-Rent](./try-before-rent.md) | Product can optionally enable try-on feature. |
| [Target Tracking](./target-tracking.md) | Product tracks cost recovery progress. |
| [FAQ System](./faq-system.md) | Product has optional FAQ entries. |
| [Product Details Builder](./product-details-builder.md) | Product has structured key-value detail sections. |
| [Category Management](./category-management.md) | Product belongs to a category/subcategory and has events. |
| [Availability Engine](./availability-engine.md) | Product availability is checked against bookings. |
| [Booking System](./booking-system.md) | Bookings reference products and specific variants/sizes. |
