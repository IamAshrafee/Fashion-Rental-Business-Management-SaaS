# Feature Spec: Category Management

## Overview

The classification system for organizing products. Covers three types of classification:

1. **Categories** — Top-level product types
2. **Subcategories** — Second-level types dependent on a category
3. **Events** — Occasion tags applicable to any product

All three are managed per tenant — each business can customize their own categories, subcategories, and events.

---

## Categories

### Purpose
Top-level classification that defines what type of product it is.

### Default Categories (Seeded per Tenant)

When a new tenant signs up, these categories are pre-created:

| Category |
|---|
| Saree |
| Lehenga |
| Sherwani |
| Gown |
| Vacation Dress |
| Two-Piece |
| Shoes |
| Bags |
| Accessories |
| Jewelry |

### Owner Management

Owners can:
- **Add** custom categories
- **Edit** category name
- **Delete** category (only if no products are assigned)
- **Reorder** categories (display order)
- **Hide** category (keeps it in system but hides from guest filters)

### Fields

| Field | Type | Required | Max Length |
|---|---|---|---|
| Category Name | Text | Yes | 100 characters |
| Slug | Auto-generated | — | kebab-case from name |
| Icon | Select from icons or upload | No | — |
| Display Order | Number | Auto | — |
| Is Active | Boolean | Default: true | — |

### Rules
- Category name must be unique within the tenant
- Cannot delete a category that has products assigned
- Can deactivate (hide) — products remain but category doesn't appear in filters
- Slug used in URLs for filtering: `/products?category=saree`

---

## Subcategories

### Purpose
Second-level classification under a category. Provides more specific filtering.

### Dependency
Each subcategory belongs to exactly one category. When a category is selected in the product form, only its subcategories appear in the dropdown.

### Default Subcategories (Examples)

| Category | Subcategories |
|---|---|
| Saree | Banarasi, Jamdani, Silk, Cotton, Georgette, Chiffon |
| Lehenga | Bridal Lehenga, Reception Lehenga, Festive Lehenga |
| Sherwani | Wedding Sherwani, Reception Sherwani, Ethnic Sherwani |
| Gown | Ball Gown, A-Line, Mermaid, Empire |
| Shoes | Heels, Flats, Sneakers, Sandals, Formal |
| Bags | Clutch, Tote, Crossbody, Backpack |

### Owner Management

Owners can:
- **Add** subcategories under any category
- **Edit** subcategory name
- **Delete** subcategory (only if no products assigned)
- **Move** subcategory to a different category
- **Reorder** subcategories within a category

### Fields

| Field | Type | Required |
|---|---|---|
| Subcategory Name | Text | Yes |
| Parent Category | Dropdown | Yes |
| Slug | Auto-generated | — |
| Display Order | Number | Auto |
| Is Active | Boolean | Default: true |

### Rules
- Subcategory name must be unique within the same parent category
- Different categories can have subcategories with the same name
- Subcategory is optional when adding a product (not required)

---

## Events

### Purpose
Occasion tags that describe what events a product is suitable for. Unlike categories (which describe WHAT the product IS), events describe WHEN/WHERE to wear it.

A product can have **multiple events** (multi-select).

### Default Events (Seeded per Tenant)

| Event |
|---|
| Wedding |
| Holud |
| Reception |
| Engagement |
| Birthday |
| Anniversary |
| Club Party |
| Office Party |
| Vacation |
| Photoshoot |
| Eid |
| Puja |
| Formal Event |
| Casual Outing |

### Owner Management

Owners can:
- **Add** custom events
- **Edit** event name
- **Delete** event (removes tag from all products, doesn't delete products)
- **Reorder** events (display order in filters)

### Fields

| Field | Type | Required |
|---|---|---|
| Event Name | Text | Yes |
| Slug | Auto-generated | — |
| Display Order | Number | Auto |
| Is Active | Boolean | Default: true |

### Rules
- Event name must be unique within the tenant
- Events are tags — a product can have many events
- Events appear as filter pills on the shopping page
- Deleting an event removes the tag from products but doesn't affect the products themselves

---

## Guest-Side Usage

### Filter Pills (Shopping Page)

Events appear as horizontal scroll pills for quick filtering:

```
[All] [Wedding] [Holud] [Reception] [Birthday] [Vacation] ...
```

Tapping a pill filters products to those with that event tag.

### Advanced Filter (Drawer)

Full filter with:
- Category dropdown
- Subcategory dropdown (dependent on category)
- Event multi-select
- Size, Color, Price range, etc.

### URL-Based Filtering

Filters should be reflected in the URL for:
- Shareability (share a link to "Wedding Sarees")
- SEO (searchable product listing pages)
- Back button behavior

Examples:
```
/products?category=saree
/products?category=saree&subcategory=banarasi
/products?event=wedding
/products?category=saree&event=wedding&color=red
```

---

## Management UI (Owner Portal)

### Category & Subcategory Management

Located in `Store Settings > Categories`

**Layout**: Expandable tree view

```
Categories
├── Saree (12 products)
│   ├── Banarasi (5)
│   ├── Jamdani (3)
│   ├── Silk (4)
│   └── [+ Add Subcategory]
├── Lehenga (8 products)
│   ├── Bridal (4)
│   └── Reception (4)
├── Sherwani (5 products)
│   └── ...
└── [+ Add Category]
```

Each row shows:
- Name
- Product count
- Actions: Edit, Delete (disabled if products exist), Toggle active

### Event Management

Located in `Store Settings > Events`

**Layout**: Simple reorderable list

```
Events
├── Wedding (25 products)
├── Holud (18 products)
├── Reception (20 products)
├── Birthday (8 products)
└── [+ Add Event]
```

---

## Business Rules Summary

1. Categories, subcategories, and events are per-tenant
2. Default values are seeded on tenant creation but fully customizable
3. Categories are single-select on products
4. Subcategories depend on selected category
5. Events are multi-select on products
6. Cannot delete category/subcategory with assigned products
7. Deleting an event removes the tag from products (non-destructive)
8. All three support reordering, editing, activation/deactivation
9. Filters work via URL params for shareability and SEO
