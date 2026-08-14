# UI Specification: Create and Edit a Rental Product

## Purpose

Catalog setup describes what customers can rent. Inventory registration records the exact physical pieces the business owns. These are connected workflows, but they are not the same form.

- Create route: `/dashboard/products/new`
- Edit route: `/dashboard/products/:id/edit`
- Setup completion: `/dashboard/products/:id/setup-complete`
- Canonical item registration: `/dashboard/inventory/items/register`

A catalog product may be published with zero physical items. In that case it can appear on the storefront but is unavailable for booking until eligible physical pieces are registered.

## Five-stage create workflow

### 1. Basics and sizing

Collect:

- product name, description, category, subcategory, and suitable events;
- size mode, sizes, measurements, multipart definitions, or free-size details;
- optional country of origin and its public-display setting;
- optional product-level reference retail value and its public-display setting.

Country of origin describes the catalog style or manufacture. Reference retail value is customer-facing comparison/replacement context. Neither field represents what the business paid for a physical piece.

Product status is not edited here. A new product begins as a draft and publication is handled only after readiness review.

### 2. Variants, SKUs, and images

Configure each visual variant, color mapping, rentable size/SKU, and the images associated with that variant. Product and variant images belong here so staff can verify that media is attached to the correct visual edition before moving on.

Each SKU is implicitly backed by physical-item identities, and its stock count is always derived from registered pieces.

### 3. Details and FAQ

Add structured product details and customer questions. Content changes presentation only; it does not mutate physical inventory.

### 4. Pricing and services

Configure authoritative rental rates, deposits, fees, late-return rules, shipping, and optional services. Money is entered in major currency units and stored as integer minor units.

Percentage-based pricing or deposits may use the product reference retail value. They never use a physical item's private acquisition cost.

### 5. Review and publish

The review stage shows readiness blockers and links back to the responsible stage. Staff may:

- save the product as a draft;
- publish when catalog readiness passes;
- return to any stage to correct data.

Publication does not create inventory and does not require opening stock.

## Setup completion

After publication, the completion screen provides three explicit next actions:

1. register physical items for this product using the canonical registration route;
2. open the product-scoped inventory workspace;
3. return to the product catalog.

Every global, product-scoped, and SKU-scoped “add item” action opens the same registration workflow with validated URL context. No embedded registration dialog or onboarding-only inventory endpoint exists.

## Draft persistence and concurrency

- Server-side onboarding sections are authoritative and use idempotency keys and revisions.
- Local draft persistence protects unsent form work and supports resuming the wizard.
- A stale section revision is rejected rather than overwriting a newer edit.
- Keyboard save shortcuts invoke the same server-backed draft command.

## Product editing

Editing uses focused tabs for basics, variants/media, pricing, size/details, and publication.

- Published catalog structure must be unpublished to draft before structural edits.
- Saving validates all tabs and points staff to the first invalid section.
- Publication controls are separate from editable catalog fields.
- Archiving requires confirmation and retains bookings, physical items, finance, and operational history.
- Existing booking, price, policy, product, SKU, and composition snapshots are never rewritten by later edits.
- Variant or SKU identity restructuring is rejected when protected inventory or rental history would be damaged.

## Contextual help

High-risk fields use focusable, clickable/touch-friendly contextual help. Help explains meaning, why it matters, a fashion-rental example where useful, and downstream effect. The trigger is keyboard accessible, exposes a permanent accessible description, closes with Escape/outside interaction, and returns focus correctly.

## Validation summary

Draft creation requires only the minimum identity needed to resume. Publication readiness requires valid catalog structure, media coverage, and pricing configuration. Inventory count is deliberately excluded from catalog readiness because booking availability is derived separately from eligible physical items.
