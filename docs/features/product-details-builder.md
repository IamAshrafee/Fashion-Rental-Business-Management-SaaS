# Feature Spec: Product Details Builder

## Overview

A flexible, structured section where owners can add custom key-value detail information to a product. This replaces a rigid schema with a fully customizable structure that works for any product type.

The details are organized into **headers** (groups) and **key-value pairs** under each header.

---

## Structure

```
Header (category/group label)
  └── Key: Value
  └── Key: Value
  └── Key: Value

Header
  └── Key: Value
  └── Key: Value
```

### Example: Wedding Saree

```
Fabric Details
  Material:        Banarasi Silk
  Weave Type:      Handloom
  Embroidery:      Zari and Resham
  Weight:          1.2 kg

Fit & Styling
  Draping Style:   Nivi / Bengali
  Body Type:       Hourglass, Pear
  Length:          6.3 meters
  Blouse Included: Yes (unstitched)

Care Instructions
  Wash:            Dry clean only
  Storage:         Hang, avoid folding
  Iron:            Steam iron on low
```

### Example: Sherwani

```
Fabric
  Material:       Jacquard Silk
  Lining:         Full lined
  Work:           Machine embroidery

Includes
  Sherwani:       Yes
  Pajama:         Yes
  Dupatta:        Yes
  Stole:          No
  Buttons:        Decorative (attached)

Care
  Wash:           Dry clean only
  Iron:           Steam press
```

### Example: Shoes

```
Specifications
  Material:       Genuine Leather
  Sole:           Rubber sole
  Closure:        Lace-up
  Heel Height:    Flat

Care
  Cleaning:       Wipe with damp cloth
  Storage:        Shoe bag included
```

---

## Configuration (Owner)

### Adding Details

1. **Add Header**: Owner types a header name (e.g., "Fabric Details")
2. **Add Key-Value** under header: Owner types Key (e.g., "Material") and Value (e.g., "Banarasi Silk")
3. Owner can add multiple key-value pairs under one header
4. Owner can add multiple headers
5. All entries can be reordered via drag-and-drop

### Fields

| Field | Type | Required | Max Length |
|---|---|---|---|
| Header Name | Text | Yes | 100 characters |
| Key | Text | Yes | 100 characters |
| Value | Text | Yes | 500 characters |

### Management Actions

| Action | Description |
|---|---|
| Add Header | Creates a new detail group |
| Add Key-Value | Adds a pair under a specific header |
| Edit | Modify any header name, key, or value |
| Delete Key-Value | Remove a single detail entry |
| Delete Header | Remove a header AND all its key-value pairs |
| Reorder | Drag-and-drop headers and key-value pairs |

---

## Display Rules (Guest Side)

### Product Detail Page

Details appear in a structured section after description, before FAQ.

**Layout Option A — Simple List**:

```
📋 Product Details

Fabric Details
  Material          Banarasi Silk
  Weave Type        Handloom
  Embroidery        Zari and Resham

Fit & Styling
  Draping Style     Nivi / Bengali
  Body Type         Hourglass, Pear
```

Keys are left-aligned, values are right-aligned or tab-separated. Clean, scannable layout.

**Layout Option B — Table Format** (alternative):

| Key | Value |
|---|---|
| Material | Banarasi Silk |
| Weave Type | Handloom |

Each header creates a sub-table.

**Recommended**: Layout Option A (list) for mobile — tables can be hard to read on small screens.

---

## Product Without Details

If no detail entries exist, the details section is not shown. No placeholder.

---

## Business Rules Summary

1. Product details are optional
2. Details are organized as: Header → Key-Value pairs
3. No limit on headers or key-value pairs (practically 2-5 headers with 3-8 pairs each)
4. All entries are plain text
5. Display order matches the owner's configured order
6. Section not shown if empty
7. This replaces the need for a rigid product specification schema
