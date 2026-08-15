# Flow: Owner Add Product

## Purpose

Create a complete rental catalog listing without inventing stock. Catalog setup and physical-item registration are separate workflows: the listing defines what the business rents; stock-unit records identify the exact pieces it owns.

## Five-stage flow

### 1. Basics and sizing

- Enter the product name and choose an active category and product type.
- Choose the active size schema when the product-type default is not appropriate.
- Optionally record storefront-safe catalog facts: country of origin and reference retail value, each with a separate public-visibility choice.
- Do not enter acquisition date, acquisition cost, supplier reference, inventory quantity, or publication status here.

Saving the first stage creates an idempotent server draft and a resumable onboarding record.

### 2. Variants, SKUs, and images

- Add each color/style variant.
- Add its rentable sizes from the selected size schema.
- Upload, order, and feature images for each variant.
- Every SKU describes a rentable catalog choice. It does not imply that a physical item exists.

### 3. Details and FAQ

- Add the storefront description.
- Add structured detail sections and key/value entries.
- Add customer-facing questions and answers.

### 4. Pricing and services

- Configure and activate the rental rate plan.
- Configure price components, deposits, delivery, late fees, protection, or other supported services.
- Monetary API values use integer minor units.

### 5. Review and publish

- Review catalog readiness and follow section-specific blockers.
- Save and leave the listing as a draft, or publish it with an explicit publication action.
- A complete listing may publish with zero stock. The storefront then shows it as unavailable until physical items are registered.

## Completion handoff

After publishing or finishing setup, the completion page offers:

- register physical items now;
- view the product;
- return to the product catalog.

“Register physical items” opens the canonical registration route with product/SKU context prefilled. Each row creates one physical item and requires a unique asset code. Shared acquisition defaults can be overridden per row. The command is atomic and idempotent.

## Resume and editing behavior

- Each section save uses the onboarding revision and an idempotency key.
- A stale revision is rejected instead of overwriting another edit.
- The product list and new-product route expose resumable drafts.
- Editing reuses the same section contracts and keeps publication in a separate tab.
- Published structural changes are guarded when referenced by inventory, rental, pricing, composition, or history records.
- Archive is an explicit confirmed lifecycle action; it removes the listing from the storefront while retaining history.

## Validation summary

| Stage                      | Required readiness                                                             |
| -------------------------- | ------------------------------------------------------------------------------ |
| Basics and sizing          | Name, active category, product type, and active size schema                    |
| Variants, SKUs, and images | At least one variant; every variant has a rentable size and featured image     |
| Details and FAQ            | Description/details/FAQ are optional but validated when present                |
| Pricing and services       | At least one active rate plan                                                  |
| Review and publish         | All preceding required sections complete and catalog readiness has no blockers |

## Main API sequence

1. `POST /owner/product-onboardings` — create or replay the server draft.
2. `PUT /owner/product-onboardings/:productId/basics`
3. `PUT /owner/product-onboardings/:productId/skus`
4. Upload new variant files, then `PUT /owner/upload/product-images/:variantId` with the
   authoritative order and featured image.
5. `PUT /owner/product-onboardings/:productId/content`
6. `PUT /owner/product-onboardings/:productId/pricing`
7. `POST /owner/product-onboardings/:productId/publish`
8. Optional handoff: `POST /owner/variant-sizes/:variantSizeId/stock-units/batch`

Every onboarding mutation is tenant-scoped, revision-checked, and idempotent. Physical-item registration remains a separate audited command.
