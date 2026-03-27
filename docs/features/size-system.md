# Feature Spec: Size System

## Overview

The size system must be flexible enough to support different product types — from standard dress sizes (S, M, L) to custom-tailored measurements to multi-part outfits to accessories that need no sizing at all.

One product uses **exactly one** size mode. The mode determines how sizes are configured and displayed.

---

## Size Modes

### Mode 1: Standard Label Size

For products with conventional clothing sizes.

**Configuration (Owner)**:
- Select available sizes from a predefined list
- Multiple sizes can be selected
- Optionally upload a size chart image

**Predefined Size Labels**:

| Category | Available Labels |
|---|---|
| General | XS, S, M, L, XL, XXL, XXXL |
| Numeric | 28, 30, 32, 34, 36, 38, 40, 42, 44, 46 |
| Free-form | Owner can add custom labels (e.g., "Petite M", "Tall L") |

**How it displays to guests**:
- Size buttons/chips showing available sizes (e.g., `S` `M` `L` `XL`)
- Size chart link/popup if uploaded
- Guest selects one size when booking

**Data**:
```
sizeMode: "standard"
availableSizes: ["S", "M", "L", "XL"]
sizeChartImage: "url-to-chart" (optional)
```

---

### Mode 2: Numeric / Measurement Based

For custom-tailored or body-measurement products.

**Configuration (Owner)**:
- Define measurement fields with labels and units
- Each measurement has a value or range

**Common Measurement Fields**:
- Chest / Bust (inches or cm)
- Waist (inches or cm)
- Hip (inches or cm)
- Length (inches or cm)
- Shoulder (inches or cm)
- Sleeve Length (inches or cm)

Owner can:
- Add custom measurement labels
- Set exact value OR a range (e.g., "Waist: 30-32 inches")
- Choose unit (inches / cm)

**How it displays to guests**:
- Measurement table showing all dimensions
- Guest reviews measurements to determine fit
- No "select size" needed — the product IS a specific size

**Data**:
```
sizeMode: "measurement"
measurements: [
  { label: "Chest", value: "38", unit: "inch" },
  { label: "Waist", value: "32", unit: "inch" },
  { label: "Length", value: "55", unit: "inch" }
]
```

---

### Mode 3: Multi-Part Size

For outfits with multiple pieces (e.g., Sherwani + Pajama, Top + Skirt, Lehenga + Blouse).

**Configuration (Owner)**:
- Set a main display size (e.g., "M") — this is what shows on product cards
- Define parts (e.g., "Top", "Bottom")
- Each part has its own measurements

**How it displays to guests**:
- Product card shows: "Size: M"
- Product detail page shows expandable section:

```
Size: M
  ├── Top
  │   ├── Chest: 38"
  │   ├── Shoulder: 16"
  │   └── Length: 28"
  └── Bottom / Skirt
      ├── Waist: 30"
      └── Length: 40"
```

- Guest sees the main size label for quick understanding
- Detailed breakdown available for fit verification

**Data**:
```
sizeMode: "multi-part"
mainDisplaySize: "M"
parts: [
  {
    partName: "Top",
    measurements: [
      { label: "Chest", value: "38", unit: "inch" },
      { label: "Shoulder", value: "16", unit: "inch" },
      { label: "Length", value: "28", unit: "inch" }
    ]
  },
  {
    partName: "Skirt",
    measurements: [
      { label: "Waist", value: "30", unit: "inch" },
      { label: "Length", value: "40", unit: "inch" }
    ]
  }
]
```

---

### Mode 4: Free Size / No Size

For products where size doesn't apply or is universally fitting.

**Configuration (Owner)**:
- Select one option:
  - **Free Size**: One size fits most
  - **Adjustable**: Has adjustable elements (drawstrings, elastic, etc.)
  - **No Size Needed**: Size is irrelevant (bags, accessories, jewelry)

**How it displays to guests**:
- Product card: Shows "Free Size" or "One Size" or nothing (for accessories)
- Product detail: No size selection needed
- Guest proceeds directly to date selection

**Data**:
```
sizeMode: "free"
freeSizeType: "free_size" | "adjustable" | "no_size"
```

---

## Size Selection in Booking Flow

### Standard Labels
Guest must select one size. If only one size available, it's pre-selected.

### Measurement / Multi-Part
No size selection needed — the product IS a specific size. Guest reviews measurements and decides if it fits.

### Free Size / No Size
No size selection needed. Skipped in the booking flow.

---

## Size Inventory (v1 Limitation)

In v1, availability is tracked at the **product level**, not per-size.

This means:
- If the product is booked for certain dates, ALL sizes of that product are unavailable
- This is appropriate because most fashion rental businesses own one piece of each product

**Future Enhancement**: Per-size inventory tracking, where a business could own multiple sizes of the same product, each with independent availability.

---

## Frontend Display Rules

### Product Card
| Size Mode | What to Show |
|---|---|
| Standard | Show available sizes as small labels (e.g., "S M L XL") |
| Measurement | Show "Custom Size" or the key measurement (e.g., "Chest: 38") |
| Multi-Part | Show the main display size (e.g., "Size: M") |
| Free Size | Show "Free Size" or "One Size" |
| No Size | Show nothing |

### Product Detail Page
| Size Mode | What to Show |
|---|---|
| Standard | Clickable size buttons, size chart link |
| Measurement | Full measurement table |
| Multi-Part | Main size + expandable parts breakdown |
| Free Size | "Free Size" / "Adjustable" label |
| No Size | Nothing (skip size section) |

---

## Business Rules Summary

1. Every product must have exactly one size mode
2. Size mode is set during product creation and can be changed during editing
3. Changing size mode clears all previous size data for that product
4. Standard sizes use a global label set + tenant custom labels
5. Measurement mode allows custom field definitions
6. Multi-part mode requires at least 2 parts
7. V1: Availability is product-level, not per-size
8. Guest must select a size when booking (standard mode only)
