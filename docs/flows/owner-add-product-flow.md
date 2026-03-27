# Flow: Owner Add Product

## Overview

Step-by-step process for an owner creating a new product listing — from initial setup to publishing on the storefront.

---

## Flow Diagram

```
[Owner clicks "+ Add Product"]
       │
       ▼
[Step 1: Basic Info]
       │
       ├── Enter product name, description (rich text)
       ├── Select category → subcategory populates
       ├── Select event(s) (multi-select)
       ├── Set status: Draft or Published
       ├── Purchase details (date, price, country)
       ├── Target rental count
       │
       ▼
[Step 2: Color Variants]
       │
       ├── Add variant 1 (required)
       │   ├── Variant name (optional, auto-generated from color)
       │   ├── Select main color (color swatch picker)
       │   └── Select identical colors (similar shades)
       ├── [+ Add more variants]
       │   Each variant → own color + images + identical colors
       │
       ▼
[Step 3: Images]
       │
       ├── Select variant tab
       ├── Upload images (drag-drop or file picker)
       │   ├── POST /upload/product-image per file
       │   ├── Server: validate → convert WebP → generate thumbnail → MinIO
       │   └── Return image URLs
       ├── First image = featured (⭐)
       ├── Drag to reorder
       ├── Repeat for each variant
       │
       ▼
[Step 4: Pricing & Logistics]
       │
       ├── Select pricing mode (one_time / per_day / percentage)
       │   └── Mode-specific fields appear
       ├── Internal pricing (min price, max discount)
       ├── Extended rental rate
       ├── Late fee configuration
       ├── Shipping mode + fee
       │
       ▼
[Step 5: Size]
       │
       ├── Select size mode (standard / measurement / multi_part / free)
       │   └── Mode-specific UI appears
       ├── Enter measurements or select standard sizes
       ├── Upload size chart (optional)
       │
       ▼
[Step 6: Services & Protection]
       │
       ├── Deposit amount
       ├── Cleaning fee
       ├── Backup size toggle + fee
       ├── Try-on toggle + fee + duration
       │
       ▼
[Step 7: Details & FAQ]
       │
       ├── Add detail sections (header → key-value entries)
       ├── Add FAQ entries (question → answer)
       │
       ▼
[Step 8: Review & Publish]
       │
       ├── Preview all entered data
       ├── [Save as Draft] → POST /owner/products (status: draft)
       │   └── Product saved but NOT visible on storefront
       ├── [Publish] → POST /owner/products (status: published)
       │   └── Product immediately visible on storefront
       │
       ▼
[Redirect to product list with success toast]
```

---

## Auto-Save Behavior

| Trigger | Action |
|---|---|
| Step completion | Save form state to localStorage |
| Browser close/refresh | Form state preserved in localStorage |
| Successful API save | Clear localStorage draft |

---

## Validation Per Step

| Step | Required Fields |
|---|---|
| 1. Basic | name, category |
| 2. Variants | At least 1 variant with main color |
| 3. Images | At least 1 image for the first variant |
| 4. Pricing | pricing mode + mode-specific required fields |
| 5. Size | size mode + mode-specific fields |
| 6. Services | None required (all optional) |
| 7. Details | None required (all optional) |
| 8. Review | All previous steps valid |

---

## API Calls Sequence

```
1. POST /owner/products                        → Create product (returns productId)
2. POST /owner/products/:id/variants           → Create each variant (returns variantId)
3. POST /upload/product-image (per image)      → Upload images
4. Server auto-creates: ProductPricing, ProductSize, ProductServices, FAQs, Details
```

All created in a single transaction where possible. If any step fails, show error and allow retry.
