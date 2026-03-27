# P13 — Owner Portal: Product Management UI

| | |
|---|---|
| **Phase** | 5 — Owner Portal Frontend |
| **Estimated Time** | 4–5 hours |
| **Requires** | P12 (owner layout), P04 (product APIs) |
| **Unlocks** | None directly (can be used independently) |

---

## REFERENCE DOCS

- `docs/ui/owner/product-list.md` — Product list page spec
- `docs/ui/owner/add-product.md` — Add product form spec
- `docs/ui/owner/edit-product.md` — Edit product form spec
- `docs/flows/owner-add-product-flow.md` — Full add-product workflow
- `docs/features/product-details-builder.md` — Custom details UI
- `docs/features/color-variant-system.md` — Variant image management
- `docs/features/rental-pricing.md` — Pricing form fields

---

## SCOPE

### 1. Product List Page (`/products`)

- DataTable with columns: Image thumbnail, Name, Category, Price, Status, Stock, Actions
- Filter bar: Category dropdown, Status dropdown, Search input
- Sort: Name, Price, Date Added, Bookings
- Bulk actions: Publish, Archive, Delete selected
- Status badges: Draft (gray), Published (green), Archived (yellow), Deleted (red)
- Empty state when no products
- "Add Product" primary action button

### 2. Add Product Page (`/products/new`)

**Multi-step form** (stepper UI):

**Step 1 — Basic Info:**
- Name, Description (rich text or textarea)
- Category + Subcategory selects
- Event tags (multi-select)
- Status (draft or publish)

**Step 2 — Variants & Images:**
- Add variant (color selector + optional custom name)
- Per variant: drag-and-drop image upload (multiple images, reorder)
- Image preview with delete
- Upload progress indicator

**Step 3 — Pricing:**
- Pricing mode radio (One-time, Per-day, Percentage)
- Dynamic fields based on mode
- Extended rental rate, late fee settings
- Min/max price fields (internal)

**Step 4 — Services & Protection:**
- Deposit amount
- Cleaning fee toggle + amount
- Backup size toggle + sizes + fee
- Try-on toggle + fee + credit option

**Step 5 — Sizes:**
- Size system selector (Standard, Custom, Garment)
- Size chart builder based on selection

**Step 6 — Details & FAQs:**
- Product details builder (custom headers + items)
- FAQ builder (question + answer pairs)
- Purchase info (price, date, country — all optional)

**Step 7 — Review & Publish:**
- Summary of all entered data
- Save as Draft or Publish

### 3. Edit Product Page (`/products/:id/edit`)

- Same form as Add, pre-populated with existing data
- Changes saved per-section (partial update)
- Image management (add new, delete existing, reorder)
- Variant management (add new, edit, delete, reorder)

### 4. Product Detail View (`/products/:id`)

- Full product view as owner sees it
- Quick actions: Edit, Archive, Delete, View on Storefront
- Booking history for this product
- Performance: total bookings, revenue, target tracking

### 5. Category Management (`/products/categories`)

- Category list with subcategories (tree view or collapsible)
- Add/edit/delete categories
- Reorder via drag-and-drop
- Event management (separate tab or section)
- Color management (separate tab)

### 6. Trash View (`/products/trash`)

- Soft-deleted products list
- Restore and permanent delete actions

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | Product list with filters | Loads products, filters, sorts, paginates |
| 2 | Multi-step add product form | All 7 steps functional |
| 3 | Image upload with drag-and-drop | Upload, preview, reorder, delete |
| 4 | Edit product form | Pre-populated, partial updates |
| 5 | Category management | CRUD tree with reorder |
| 6 | Trash management | Restore and delete |
| 7 | Product detail view | Full product info + stats |
