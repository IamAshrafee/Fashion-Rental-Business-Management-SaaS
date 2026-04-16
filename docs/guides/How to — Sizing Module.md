# How To: Sizing Module — Complete Guide

> A step-by-step walkthrough for tenant owners to set up and use the schema-driven sizing system.

---

## Overview

The sizing system uses three layers:

| Concept | What it is | Example |
|---------|-----------|---------|
| **Size Schema** | A template that defines what "sizes" look like | "Apparel Alpha" → XS, S, M, L, XL |
| **Product Type** | A category linked to a default schema | "Dresses" → uses "Apparel Alpha" |
| **Product Variant** | A concrete item tied to one size instance | "Red Dress — Size M" |

**Flow:** Create Schema → Activate → Create Product Type → Add Product → Assign Sizes to Variants

---

## Step 1: Create a Size Schema

**Navigate to:** Dashboard → Products → Sizing Schemas

1. Click **"+ New Schema"**
2. Fill in the form:

| Field | Required | Example | Notes |
|-------|----------|---------|-------|
| Name | ✅ | Women's Dress Sizing | Human-readable name |
| Schema Type | ✅ | Standard | `Standard`, `Multi-Part`, or `Free Size` |
| Description | ❌ | Standard sizes for women's dresses | Optional context |
| Required Dimensions | ❌ | Chest, Waist, Length | Comma-separated measurement fields |
| Available Sizes | ✅ | XS, S, M, L, XL | Comma-separated size labels |

3. Click **"Create"**

> [!TIP]
> The `code` field is auto-generated from the name (e.g., "Women's Dress Sizing" → `WOMEN_S_DRESS_SIZING`). This code is unique per tenant and used internally for deduplication.

### Schema Types Explained

| Type | Use Case | Example |
|------|----------|---------|
| **Standard** | Simple sizes | XS, S, M, L, XL |
| **Multi-Part** | Two-piece sets (top + bottom) | Top: S, Bottom: M |
| **Free Size** | One-size-fits-all items | Free Size |

---

## Step 2: Activate the Schema

Newly created schemas start in **draft** status. They must be activated before they can be assigned to product types.

1. In the Sizing Schemas list, find your schema
2. Click the **"Activate"** button (or use the menu)
3. Status changes from `draft` → `active`

> [!IMPORTANT]
> Only **active** schemas appear in the Product Type creation dropdown. If you don't see your schema when creating a product type, make sure it's activated first.

---

## Step 3: Create a Product Type

**Navigate to:** Dashboard → Products → Product Types

1. Click **"+ Add Product Type"**
2. Fill in the form:

| Field | Required | Example |
|-------|----------|---------|
| Name | ✅ | Dresses |
| Description | ❌ | All kinds of formal and casual dresses |
| Default Size Schema | ❌ | Women's Dress Sizing |

3. Click **"Create"**

> [!NOTE]
> The "Default Size Schema" dropdown only shows **active** schemas. If it's empty, go back to Step 2 and activate your schema first.

---

## Step 4: Add a Product with Sizes

**Navigate to:** Dashboard → Products → Add Product

### Step 4a: Select Product Type (Size Step)

1. In the **Size** step of the product form, select your Product Type (e.g., "Dresses")
2. The system auto-loads the default size schema and shows **Available Sizes** as a preview
3. *(Optional)* Click **"Override Size Schema"** to use a different schema for this specific product

### Step 4b: Assign Sizes to Variants (Variants & Media Step)

1. In the **Variants & Media** step, each variant card shows a **Size** dropdown
2. Select the appropriate size for each variant (e.g., Variant 1 → "S", Variant 2 → "M")
3. The size dropdown is populated from the active schema's size instances

> [!TIP]
> You can add multiple variants with different sizes. Click **"+ Add Another Variant"** to create additional color/size combinations.

### Step 4c: Submit

1. Review all details in the **Review** step
2. Click **"Create Product"**
3. Each variant is saved with its assigned `sizeInstanceId`

---

## Step 5: Size Guide (Optional)

Size charts provide measurement tables (e.g., chest/waist cm) shown on the storefront PDP.

### Creating a Size Chart

Size charts are managed via the API or a future admin UI:

```
POST /api/v1/owner/size-schemas/charts
```

```json
{
  "sizeSchemaId": "<schema-id>",
  "title": "Women's Dress Size Guide",
  "rows": [
    { "sizeLabel": "S", "measurements": { "chest_cm": "84-88", "waist_cm": "64-68" } },
    { "sizeLabel": "M", "measurements": { "chest_cm": "88-92", "waist_cm": "68-72" } },
    { "sizeLabel": "L", "measurements": { "chest_cm": "92-96", "waist_cm": "72-76" } }
  ]
}
```

If a size chart exists for the schema, it automatically appears in the product form preview and on the storefront PDP as a "Size Guide" table.

---

## Recommended Starter Schemas

These cover most fashion rental scenarios:

| Schema Name | Type | Sizes |
|------------|------|-------|
| Apparel Alpha | Standard | XS, S, M, L, XL, XXL |
| Apparel Numeric | Standard | 0, 2, 4, 6, 8, 10, 12, 14, 16 |
| Shoe Standard | Standard | US 5, US 6, US 7, US 8, US 9, US 10 |
| Pants W×L | Standard | 28×30, 30×30, 32×32, 34×32, 36×34 |
| Jewelry Ring | Standard | 5, 6, 7, 8, 9 |
| One Size | Free Size | Free Size |
| Two-Piece Set | Multi-Part | (top + bottom sizing) |
| Bra Band×Cup | Standard | 32A, 32B, 34A, 34B, 36B, 36C |

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| No schemas in Product Type dropdown | Schema is still in `draft` | Activate the schema first |
| Size dropdown empty in variant form | No instances defined for the schema | Edit the schema and add size instances |
| Product created without size data | Size wasn't selected before submission | Select a size for each variant |
| "Schema code already exists" error | Duplicate schema name | Use a different name |

---

## Architecture Reference

```
SizeSchema (template)
  └── SizeInstance[] (XS, S, M, L, XL)

ProductType (category)
  └── defaultSizeSchema → SizeSchema

Product
  └── productType → ProductType
  └── sizeSchemaOverride → SizeSchema (optional)
  └── ProductVariant[]
       └── sizeInstance → SizeInstance
```

**Resolution order for active schema:**
1. Product's `sizeSchemaOverride` (if set)
2. ProductType's `defaultSizeSchema` (fallback)
