# UI Spec: Add Product (Multi-Step Form)

## Overview

Multi-step wizard for creating a new product. Guides the owner through all required information in logical order.

**Route**: `/dashboard/products/new`

---

## Steps

### Step Indicator

```
[1 Basic] → [2 Variants] → [3 Images] → [4 Pricing] → [5 Size] → [6 Services] → [7 Details] → [8 Review]
```

Steps are clickable (can jump back). Progress bar shows completion.

---

### Step 1: Basic Information

```
Product Name *           [Royal Banarasi Saree              ]
Description              [Rich text editor                   ]
Category *               [Saree                            ▾]
Subcategory              [Banarasi                         ▾] ← Depends on category
Events                   [☑ Wedding] [☑ Reception] [☐ Holud]
Status                   ○ Draft  ● Published

Purchase Info (Internal)
Purchase Date            [2026-01-15                        ]
Purchase Price           [৳ 15,000                          ]
  ☐ Show purchase price to guests
Item Country             [India                              ]
  ☐ Show country to guests
Target Rentals           [5                                  ]

[Next: Variants →]
```

---

### Step 2: Color Variants

```
Color Variants

Variant 1 (Default)
  Variant Name:    [Ivory Gold                  ]
  Main Color:      [White                      ▾] ← Color swatch dropdown
  Identical Colors: [Ivory ✕] [Cream ✕] [+ Add]
  [Remove Variant]

[+ Add Another Variant]

[← Back]                              [Next: Images →]
```

---

### Step 3: Images

```
Upload Images

Variant: Ivory Gold (White)    [Switch Variant ▾]

┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐
│ ⭐     │ │        │ │        │ │            │
│ [img1] │ │ [img2] │ │ [img3] │ │ + Upload   │
│        │ │        │ │        │ │ Drag here  │
└────────┘ └────────┘ └────────┘ └────────────┘
  Featured    Drag to reorder      or click

• Max 10 images per variant
• Accepted: JPEG, PNG, WebP (max 10 MB each)
• First image is automatically featured (⭐)
• Drag to reorder

[← Back]                             [Next: Pricing →]
```

---

### Step 4: Pricing & Logistics

```
Pricing Mode
◉ One-time rental    ○ Per day    ○ Percentage of retail

── One-Time Rental ──
Rental Price *        [৳ 7,500                   ]
Included Days *       [3                          ]

Internal Pricing
Min Price (staff)     [৳ 5,000                   ]
Max Discount          [৳ 6,000                   ]

Extended Rental
Rate per extra day    [৳ 500                     ]

Late Return
Late fee type         ◉ Fixed   ○ Percentage
Late fee per day      [৳ 300                     ]
Max late fee cap      [৳ 2,000                   ]

Shipping
Shipping mode         ◉ Free   ○ Flat fee   ○ Area-based
Flat shipping fee     [৳ 150                     ]

[← Back]                              [Next: Size →]
```

---

### Step 5: Size

```
Size Mode
○ Standard Sizes    ◉ Measurements    ○ Multi-Part    ○ Free Size

── Measurement Mode ──
┌──────────────────────────────────────────────┐
│ Label *         Value *       Unit           │
│ [Chest      ]   [38       ]   [inch ▾]       │
│ [Waist      ]   [32       ]   [inch ▾]       │
│ [Length     ]   [42       ]   [inch ▾]       │
│                                              │
│ [+ Add Measurement]                          │
└──────────────────────────────────────────────┘

Size Chart Image (optional)
[Upload size chart image]

[← Back]                           [Next: Services →]
```

---

### Step 6: Services & Protection

```
Deposit & Fees
Security deposit      [৳ 5,000                   ]
Cleaning fee          [৳ 500                     ]

Backup Size
☑ Enable backup size option
Backup size fee       [৳ 300                     ]

Try Before Rent
☑ Enable try-before-rent
Try-on fee            [৳ 1,000                   ]
Try-on duration       [24 hours                  ]
☐ Credit try-on fee to rental price

[← Back]                           [Next: Details →]
```

---

### Step 7: Product Details & FAQ

```
Product Details (Key-Value Sections)

Section: [Fabric Details              ]
┌──────────────────────────────────────────────┐
│ Key              Value                       │
│ [Material    ]   [Banarasi Silk          ]   │
│ [Weight      ]   [Heavy                  ]   │
│ [+ Add Entry]                                │
└──────────────────────────────────────────────┘
[+ Add Another Section]

──────────────────────────────

FAQ
┌──────────────────────────────────────────────┐
│ Q: [Is alteration possible?              ]   │
│ A: [No, this is a rental item...         ]   │
│                                              │
│ Q: [What if I return late?               ]   │
│ A: [Late fee of ৳300/day applies...      ]   │
│                                              │
│ [+ Add FAQ]                                  │
└──────────────────────────────────────────────┘

[← Back]                            [Next: Review →]
```

---

### Step 8: Review & Publish

Shows a preview of the entire product with all entered data. Owner can review and go back to any step to make changes.

```
Review Your Product
──────────────────

[Product Preview Card]

Basic: Royal Banarasi Saree · Saree › Banarasi · Wedding, Reception
Pricing: ৳7,500 / 3 days · Extended: ৳500/day
Deposit: ৳5,000 · Cleaning: ৳500
Size: Measurement (Chest 38", Waist 32", Length 42")
Variants: 3 (White, Blue, Red)
Images: 12 total
FAQ: 2 entries

[← Back]         [Save as Draft]    [Publish Product]
```

---

## Auto-Save

Each step auto-saves to localStorage so the owner doesn't lose progress if the page is accidentally closed.
