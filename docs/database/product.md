# Database Schema: Catalog Products and Physical Inventory

## `products`

`products` stores customer-facing catalog identity and merchandising data. It deliberately does not store acquisition cost/date or an arbitrary rental-count target.

| Column                          | Type      | Nullable | Default         | Meaning                                                      |
| ------------------------------- | --------- | -------: | --------------- | ------------------------------------------------------------ |
| `id`                            | UUID      |       No | generated       | Product identity                                             |
| `tenant_id`                     | UUID      |       No | —               | Tenant ownership                                             |
| `creation_key`                  | TEXT      |      Yes | `NULL`          | Idempotent draft creation key                                |
| `name`                          | TEXT      |       No | —               | Catalog display name                                         |
| `slug`                          | TEXT      |       No | —               | Tenant-unique storefront slug                                |
| `description`                   | TEXT      |      Yes | `NULL`          | Catalog description                                          |
| `category_id`                   | UUID      |       No | —               | Category identity                                            |
| `subcategory_id`                | UUID      |      Yes | `NULL`          | Optional subcategory                                         |
| `product_type_id`               | UUID      |      Yes | `NULL`          | Optional product type                                        |
| `size_schema_override_id`       | UUID      |      Yes | `NULL`          | Optional sizing override                                     |
| `status`                        | enum      |       No | `draft`         | `draft`, `published`, or `archived`                          |
| `is_available`                  | BOOLEAN   |       No | `true`          | Catalog availability control                                 |
| `available_from`                | DATE      |      Yes | `NULL`          | Future catalog availability                                  |
| `unavailable_reason`            | TEXT      |      Yes | `NULL`          | Internal explanation                                         |
| `country_of_origin`             | TEXT      |      Yes | `NULL`          | Catalog manufacture/design origin                            |
| `country_of_origin_public`      | BOOLEAN   |       No | `false`         | Guest visibility                                             |
| `reference_retail_value`        | INTEGER   |      Yes | `NULL`          | Optional product comparison/replacement value in minor units |
| `reference_retail_value_public` | BOOLEAN   |       No | `false`         | Guest visibility                                             |
| `storefront_item_mode`          | enum      |       No | `INTERNAL_ONLY` | Public condition presentation policy                         |
| `total_bookings`                | INTEGER   |       No | `0`             | Cached catalog metric                                        |
| `total_revenue`                 | INTEGER   |       No | `0`             | Cached catalog metric                                        |
| `search_vector`                 | TSVECTOR  |      Yes | —               | PostgreSQL search projection                                 |
| `created_at`, `updated_at`      | TIMESTAMP |       No | current/update  | Audit times                                                  |
| `deleted_at`                    | TIMESTAMP |      Yes | `NULL`          | Soft deletion                                                |
| `deleted_by_user_id`            | UUID      |      Yes | `NULL`          | Deletion actor                                               |

Important constraints/indexes include tenant-unique slug and creation key, tenant/status lookup, category/product-type/sizing references, full-text/trigram indexes, and a partial storefront index for published, available, nondeleted products.

## Catalog hierarchy

- `product_variants` represents a visual edition and color mapping.
- `variant_sizes` represents a rentable SKU/size and keeps an inventory concurrency revision.
- `product_images`, size/detail/FAQ tables, and versioned pricing tables describe the customer offer.
- Product onboarding stores server revisions and idempotent section commands.

Every SKU is physical-item backed.

## `stock_units`

`stock_units` stores one row for every owned rental piece.

| Column                      | Meaning                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `asset_code`                | Permanent tenant-unique item identity                             |
| `barcode`                   | Optional tenant-unique scanning identity                          |
| `variant_size_id`           | Exact catalog SKU                                                 |
| `location_id`               | Structured current custody location                               |
| `disposition`               | Active, quarantined, lost, or retired                             |
| `operational_state`         | Availability/preparation/rental/inspection/service/transfer state |
| `condition`                 | Last verified condition grade                                     |
| `acquisition_date`          | Date this exact piece was obtained                                |
| `acquisition_cost`          | Private item investment in minor units                            |
| `acquisition_source`        | Supplier, owner contribution, consignment source, etc.            |
| `acquisition_reference`     | Invoice, PO, or agreement reference                               |
| `estimated_current_value`   | Separate approved current valuation                               |
| `version`                   | Optimistic correction version                                     |
| `registration_key/hash/row` | Atomic batch idempotency evidence                                 |

SKU/product stock is derived from these rows; no inventory quantity table exists.

## Inventory evidence

- `inventory_movements` requires a physical item and retains source workflow, location, actor, reason, and before/after state.
- `inventory_count_sessions`, observations, and items preserve identity-based location reconciliation.
- reservations retain quantity demand by SKU/location; assignments bind exact items without subtracting capacity twice.
- transfers group exact transfer units by SKU and derive all summary counts from unit outcomes.
- inspections, issues, service orders, lifecycle events, and component states always reference exact items.
- `stock_unit_revenue_allocations` appends deterministic item-level rental revenue and signed corrections.

## Publication and history

A product may be published with zero stock. Availability is computed from eligible items and reservations. Catalog edits do not rewrite booking, pricing, policy, composition, fulfilment, assignment, movement, or financial snapshots. Hard deletion is limited to records with no protected history; otherwise the catalog identity is archived or soft-deleted.
