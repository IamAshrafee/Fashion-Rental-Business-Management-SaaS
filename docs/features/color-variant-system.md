# Feature Spec: Color Variant System

## Overview

The color variant system is a core differentiating feature. It allows a single product to have multiple color versions, each with its own images and color attributes. This system powers:

- Variant-specific image galleries
- Smart thumbnail switching when users filter by color
- Accurate search results (finding a "red dress" even when the dress is primarily white but has red embroidery)
- Clear communication of what the customer is actually renting

---

## Variant Structure

Each product has **one or more** color variants.

Each variant contains:

| Field | Type | Required | Description |
|---|---|---|---|
| Variant Name | Text | No | Optional label (e.g., "Ivory Gold", "Ocean Blue"). If empty, uses main color name. |
| Main Color | Single select (from color palette) | Yes | The dominant color of this variant. Exactly one per variant. |
| Identical Colors | Multi-select (from color palette) | Yes (minimum 1, auto-includes main color) | All colors present in this variant, used for search matching. |
| Featured Image | Image upload | Yes | The primary image shown on product cards and as the first gallery image. |
| Additional Images | Multiple image uploads | No | Gallery images for this variant. Ordered by sequence. |

### Rules
- Every product must have **at least one variant**
- Each variant must have **exactly one main color**
- Each variant must have **at least the main color** in its identical colors list (auto-added)
- Each variant must have **a featured image**
- There is no upper limit on variants per product, but practically 2-5 is typical
- The **first variant** is the default variant shown when the product is loaded

---

## Color Types Explained

### Main Color
The single, dominant color that defines this variant.

**Example**: A dress that is predominantly white with gold embroidery.
- Main Color: **White**

**Purpose**:
- Identifies the variant in the UI (color swatch)
- When user clicks this color swatch → frontend switches to this variant's images
- During booking, the selected variant's main color is what the customer is ordering

### Identical Colors
All colors visibly present in this variant, including the main color.

**Example**: Same white dress with gold embroidery also has red thread work.
- Main Color: **White**
- Identical Colors: **White**, **Gold**, **Red**

**Purpose**:
- **Search matching**: If a user searches or filters by "Red", this product appears in results even though it's primarily white
- **Improves discoverability**: Customers often search by accent colors, not just the dominant color
- **Reduces missed sales**: A dress with red embroidery is still relevant to someone looking for something red to wear

**Important**: The main color is ALWAYS included in the identical colors list (auto-enforced).

---

## Color Palette

The system needs a predefined color palette that tenants can use.

### System Colors (Global)

A default palette available to all tenants:

| Color Name | Hex Code | Color Name | Hex Code |
|---|---|---|---|
| White | #FFFFFF | Black | #000000 |
| Red | #E53935 | Dark Red | #8B0000 |
| Pink | #EC407A | Hot Pink | #FF69B4 |
| Orange | #FF7043 | Peach | #FFCCBC |
| Yellow | #FDD835 | Gold | #FFD700 |
| Green | #43A047 | Olive | #808000 |
| Blue | #1E88E5 | Navy | #000080 |
| Sky Blue | #03A9F4 | Teal | #008080 |
| Purple | #8E24AA | Lavender | #E6E6FA |
| Brown | #6D4C41 | Beige | #F5F5DC |
| Gray | #9E9E9E | Silver | #C0C0C0 |
| Ivory | #FFFFF0 | Cream | #FFFDD0 |
| Maroon | #800000 | Coral | #FF6F61 |
| Magenta | #FF00FF | Turquoise | #40E0D0 |

### Custom Colors (Per Tenant — Future)
In future, tenants can add custom colors with name and hex code. For v1, the system palette is sufficient.

---

## Image Management Per Variant

### Upload Rules
- **Accepted formats**: JPEG, PNG, WebP
- **Max file size**: 5 MB per image (before compression)
- **Processing on upload**:
  1. Validate file type and size
  2. Compress and convert to WebP
  3. Generate thumbnail (400×400)
  4. Store both original-quality WebP and thumbnail in MinIO
- **Max images per variant**: 10 (1 featured + 9 additional)

### Featured Image
- The first/main image of the variant
- Shown as the product thumbnail on cards
- Shown as the first image in the product detail gallery
- Must be uploaded before the variant can be saved
- Can be changed by the owner at any time

### Image Sequencing
- Additional images can be reordered via drag-and-drop
- Sequence number determines display order in the gallery
- Featured image is always first (sequence 0)

### Image Deletion
- Owner can delete any additional image
- Featured image can only be replaced, not deleted (every variant needs a featured image)
- Deleting an image removes it from MinIO storage

---

## Frontend Behavior: Variant Switching

### On Product Detail Page

When the product detail page loads:
1. Show the **first variant's** images (featured + gallery)
2. Display color swatches below the images — one swatch per variant, colored by main color
3. Active variant swatch is highlighted

**When user clicks a different color swatch:**
1. Smoothly transition the image gallery to the clicked variant's images
2. Update the featured image
3. Update the gallery thumbnails
4. Update the selected variant indicator
5. If size options differ per variant (future), update size buttons
6. Price remains the same (pricing is product-level, not variant-level in v1)

### On Product Card (Shopping Page)

Default state:
- Show the **first variant's featured image** as the card thumbnail
- Show main color name or color dots below the title

**When user filters by color (critical feature):**

If user filters by "Red":
1. Find all products where any variant has "Red" in its identical colors
2. For each matching product, determine which variant matched:
   - If variant 2 has "Red" as an identical color → show variant 2's featured image as the card thumbnail
3. This means **the card thumbnail dynamically changes** based on the active color filter

**Example**:
- Product "Royal Saree" has:
  - Variant 1: Main=White, Identical=[White, Gold]
  - Variant 2: Main=Blue, Identical=[Blue, Red]
- Normal view: Card shows Variant 1 (White) featured image
- User filters "Red": Card shows Variant 2 (Blue) featured image — because Blue variant has Red as identical color
- User filters "Gold": Card shows Variant 1 (White) featured image — because White variant has Gold as identical color

This is a **high-conversion feature**. The customer sees relevant images matching their search/filter, increasing the chance they click and book.

---

## Search & Filter Integration

### How Colors Interact with Search

When a user searches or filters by a specific color:

1. Query all products where **any variant** has the searched color in its `identicalColors` array
2. For the product card display, use the **matching variant's featured image** as the thumbnail
3. If multiple variants match (e.g., both have "Red" as identical), use the first matching variant

### Search Result Clarity

Even though a product appears in "Red" search results:
- The product detail page still shows the variant is "White" (main color)
- The booking process clearly states which variant is being rented
- No ambiguity — search matches by visual presence, but booking is by specific variant

---

## Data Model (Conceptual)

```
Product
  └── Variant[]
        ├── id
        ├── variantName (optional)
        ├── mainColorId (reference to Color)
        ├── identicalColorIds[] (references to Colors)
        ├── featuredImageUrl
        ├── sequence (display order)
        └── Image[]
              ├── id
              ├── url
              ├── thumbnailUrl
              ├── sequence (display order)
              └── isFeatured (boolean)
```

---

## Business Rules Summary

1. Every product must have at least one variant
2. Every variant must have exactly one main color
3. Identical colors always include the main color (auto-enforced)
4. Every variant must have a featured image
5. First variant is the default displayed variant
6. Color filter changes card thumbnails to matching variant's image
7. Booking is always for a specific variant (main color identifies it)
8. Pricing is product-level, not variant-level (in v1)
9. All variants of a product share the same size options (in v1)
