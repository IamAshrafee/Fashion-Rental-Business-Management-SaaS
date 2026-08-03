# Hybrid Product Inventory Design

**Status:** Approved  
**Date:** 2026-08-03  
**Scope:** Product stock, availability, reservation, and physical-unit tracking

## 1. Purpose

The product catalog currently has a `stockLevel` on each variant-size, but booking availability is enforced by product-level date blocks. As a result, one booking blocks every color and size of a product, stock quantity is not operational, and the system cannot track the condition or history of valuable physical pieces.

This design establishes one inventory model that supports both common rental-business workflows:

- interchangeable stock managed as a quantity; and
- valuable physical pieces managed individually.

The design makes variant-size the rentable SKU, prevents overbooking under concurrency, preserves existing booking history, and supports later condition, maintenance, and profitability workflows.

## 2. Goals

- Treat `ProductVariant + SizeInstance` (`VariantSize`) as the reservable SKU.
- Support pooled quantities and serialized physical units in the same tenant.
- Calculate availability by SKU, date range, quantity, buffers, and maintenance.
- Reserve inventory atomically with booking creation.
- Assign serialized physical units during operational preparation rather than checkout.
- Preserve an immutable history of stock changes and unit assignments.
- Keep existing product-wide blocks meaningful during migration.
- Enforce tenant ownership at every inventory boundary.
- Provide owner workflows for quantity, unit, condition, maintenance, calendar, and assignment management.

## 3. Non-goals

- Barcode-scanner hardware integration.
- Warehouse bin optimization or multi-warehouse transfer logistics.
- Automated depreciation/accounting.
- Supplier purchase-order management.
- Replacing the pricing engine.
- Rebuilding unrelated product merchandising fields.

The schema will leave room for future barcode and location integrations without implementing them now.

## 4. Domain terminology

| Term | Meaning |
|---|---|
| Product | Public catalog style or listing, such as “Royal Banarasi Saree.” |
| Variant | A visual/color edition of a product. |
| Variant-size / SKU | A variant paired with one size instance; the smallest customer-selectable inventory pool. |
| Pooled inventory | Interchangeable pieces represented by a quantity on the SKU. |
| Serialized inventory | Individually registered physical pieces represented by `StockUnit` records. |
| Reservation | A date-bound quantity claim created for a booking item. |
| Assignment | Selection of a particular serialized stock unit for a reservation. |
| Inventory block | A manual, maintenance, or legacy restriction on a product, variant, SKU, or stock unit. |

## 5. Core invariants

1. Every reservable selection has a valid tenant-owned `VariantSize` ID.
2. Each `VariantSize` uses exactly one tracking mode: `POOLED` or `SERIALIZED`.
3. A SKU never combines pooled quantity and serialized units when calculating capacity.
4. Pooled capacity is `pooledQuantity`.
5. Serialized capacity is the number of rentable stock units for the requested range.
6. Overlapping active reservations can never exceed capacity.
7. Product, variant, and SKU blocks make the affected SKU unavailable for the blocked period.
8. Stock-unit blocks reduce serialized capacity only by the affected units.
9. Physical-unit assignments never increase or create capacity; they fulfill existing reservations.
10. Historical movements, reservations, and assignments are never hard-deleted as part of normal operations.
11. Product status and public availability remain additional gates: unpublished, archived, deleted, or manually unavailable products cannot be newly reserved.

## 6. Data model

### 6.1 VariantSize changes

`VariantSize` becomes the authoritative rentable SKU and gains:

- `trackingMode`: `POOLED | SERIALIZED`, default `POOLED`.
- `pooledQuantity`: non-negative integer, initially copied from `stockLevel`.
- `inventoryVersion`: integer available for optimistic metadata updates; booking concurrency still uses a database row lock.
- relations to stock units, reservations, assignments through reservations, movements, and scoped blocks.

The existing `stockLevel` field is deprecated after backfill and removed only after all readers use the new capacity service.

### 6.2 StockUnit

A `StockUnit` represents one identifiable physical piece. It contains:

- `id`, `tenantId`, and `variantSizeId`;
- tenant-unique `assetCode`;
- optional barcode value for future scanner support;
- lifecycle status: `ACTIVE`, `MAINTENANCE`, `RETIRED`, or `LOST`;
- condition grade: `EXCELLENT`, `GOOD`, `FAIR`, or `DAMAGED`;
- optional location label, purchase date, purchase cost, and notes;
- created, updated, retired, and deleted metadata.

Reservation state is not stored as a stock-unit lifecycle status because a unit may have many non-overlapping future assignments. Date-bound availability is derived from reservations, assignments, and blocks.

### 6.3 InventoryReservation

An `InventoryReservation` represents the inventory claim for one booking item. It contains:

- tenant, booking, booking-item, product, variant-size, and quantity references;
- customer rental start/end dates;
- effective blocked start/end dates after preparation and return buffers;
- status: `PENDING`, `CONFIRMED`, `RELEASED`, `CANCELLED`, or `EXPIRED`;
- optional expiration timestamp for temporary pending holds;
- timestamps and release/cancellation reason.

Booking-item snapshots continue to preserve product, color, size, image, and pricing labels. New logic uses `variantSizeId` for identity and snapshots only for historical display.

### 6.4 StockUnitAssignment

A `StockUnitAssignment` links one serialized unit to an inventory reservation. It contains assignment and release timestamps plus the acting staff member where available.

The number of active assignments may not exceed the reservation quantity. A unit cannot have assignments whose effective blocked ranges overlap. Assignment is normally performed while preparing or confirming fulfillment, not during guest checkout.

### 6.5 InventoryMovement

`InventoryMovement` is an append-only audit ledger for:

- initial stock;
- pooled additions and reductions;
- unit registration;
- condition changes;
- maintenance entry and exit;
- retirement, loss, and recovery;
- administrative corrections.

Each entry records tenant, SKU, optional stock unit, movement type, quantity delta where applicable, before/after metadata, reason, actor, and timestamp. Current state remains on `VariantSize` or `StockUnit`; the ledger explains how it changed.

### 6.6 InventoryBlock

New inventory blocks use one model with exactly one scope:

- product;
- variant;
- variant-size; or
- stock unit.

A database check constraint enforces exactly one target. Blocks contain start/end dates, type (`MANUAL`, `MAINTENANCE`, or `LEGACY_BOOKING`), reason, tenant, creator, and timestamps.

Booking reservations are not represented as blocks. Reservations and operational blocks remain separate concepts. Existing `DateBlock` records are retained as legacy product-wide restrictions during migration and then converted to `InventoryBlock` where appropriate.

## 7. Capacity and availability

All callers use one `InventoryAvailabilityService`; controllers and booking logic do not implement their own overlap rules.

For a requested variant-size, date range, and quantity:

1. Validate product, variant, size, tenant, publication, deletion, and manual availability state.
2. Normalize customer dates and derive effective blocked dates using tenant preparation and return buffers.
3. Reject the range if an overlapping product, variant, or variant-size block exists.
4. Resolve capacity:
   - `POOLED`: use `pooledQuantity`.
   - `SERIALIZED`: count active, non-retired/lost stock units without overlapping unit blocks.
5. Sum quantities from overlapping `PENDING` and `CONFIRMED` reservations. Ignore expired pending holds and released/cancelled reservations.
6. Calculate `remaining = capacity - reserved`.
7. Return availability, total capacity, reserved quantity, remaining quantity, and non-sensitive conflict information.

The storefront may display availability, but only the transactional booking recheck is authoritative.

### 7.1 Date semantics

- Customer rental start and end dates are inclusive.
- Effective blocked dates are stored explicitly on each reservation for auditability.
- Buffer-setting changes do not silently rewrite existing reservations.
- All persistence and overlap comparisons use normalized UTC date boundaries under the project’s existing date policy.

## 8. Booking and reservation flow

### 8.1 Guest or staff booking request

Every requested item sends:

- `variantSizeId`;
- `quantity`, defaulting to one;
- selected variant/color and size labels only as display data;
- requested rental dates.

Display labels are never accepted as inventory identity.

### 8.2 Atomic booking transaction

For all booking items, the backend:

1. Sorts unique variant-size IDs to guarantee stable lock order.
2. Starts a serializable database transaction.
3. Locks each affected `VariantSize` row with `SELECT ... FOR UPDATE` in sorted order.
4. Recalculates price and availability inside the transaction.
5. Creates the booking and booking-item snapshots.
6. Creates one inventory reservation per booking item.
7. Commits all records together.

If capacity changed after the customer viewed availability, the transaction returns a structured `INVENTORY_CAPACITY_CONFLICT` and creates no partial booking.

### 8.3 Reservation lifecycle

- Pending bookings create `PENDING` reservations with an expiration time.
- Confirmation converts reservations to `CONFIRMED` without changing their dates or quantities.
- Cancellation converts them to `CANCELLED`.
- Booking completion or an explicit operational release converts them to `RELEASED` after the inventory is returned and processed.
- A background job expires abandoned pending reservations idempotently.

Repeated lifecycle commands must be idempotent and must not create duplicate reservations or movements.

## 9. Serialized-unit assignment

For a serialized SKU, staff assign the required number of physical units during preparation. The assignment service:

1. Locks the reservation and candidate stock-unit rows.
2. Verifies tenant, SKU, active status, condition, and date-range eligibility.
3. Rejects maintenance blocks and overlapping active assignments.
4. Ensures the active assignment count remains within reservation quantity.
5. Creates assignment history atomically.

Reassignment releases the previous active assignment and creates a new one; history remains intact. Return and inspection can update condition and place a unit into maintenance without altering past bookings.

## 10. Owner workflows and APIs

### 10.1 Inventory overview

`GET /api/v1/owner/products/:productId/inventory`

Returns variants and sizes with tracking mode, total capacity, currently reserved, currently available, maintenance count, and stock-unit summaries.

### 10.2 SKU configuration

`PATCH /api/v1/owner/variant-sizes/:variantSizeId/inventory`

Supports pooled quantity changes and tracking-mode selection. Reductions are rejected when the new quantity is below the maximum concurrent active/future reservation demand. Tracking mode changes are rejected while active or future reservations exist.

### 10.3 Physical units

- `POST /api/v1/owner/variant-sizes/:variantSizeId/stock-units`
- `GET /api/v1/owner/variant-sizes/:variantSizeId/stock-units`
- `PATCH /api/v1/owner/stock-units/:stockUnitId`
- `POST /api/v1/owner/stock-units/:stockUnitId/maintenance`
- `POST /api/v1/owner/stock-units/:stockUnitId/restore`
- `POST /api/v1/owner/stock-units/:stockUnitId/retire`

Normal deletion is replaced by retirement. Hard deletion is limited to units with no history and remains an owner-only administrative action.

### 10.4 Availability and calendar

The duplicate existing availability routes are consolidated:

- `GET /api/v1/products/:productId/availability?variantSizeId=...&startDate=...&endDate=...&quantity=...`
- `GET /api/v1/owner/products/:productId/inventory/calendar?from=...&to=...`

The public response never exposes internal reasons, customer data, asset codes, or booking identifiers.

### 10.5 Blocks and assignments

- `POST /api/v1/owner/inventory/blocks`
- `DELETE /api/v1/owner/inventory/blocks/:blockId`
- `POST /api/v1/owner/bookings/:bookingId/items/:bookingItemId/assignments`
- `DELETE /api/v1/owner/bookings/:bookingId/items/:bookingItemId/assignments/:assignmentId`

All owner mutations write audit events and relevant inventory movements.

## 11. Owner interface

The product form exposes inventory configuration on every variant-size:

- tracking mode;
- pooled quantity, or registered physical-unit count;
- clear capacity and availability summaries;
- publish-readiness validation requiring at least one rentable SKU with positive capacity.

The owner product detail adds an Inventory workspace containing:

- a variant/size matrix;
- available, reserved, maintenance, and total counts;
- stock-unit registration and editing;
- inventory calendar and scoped blocks;
- movement and condition history.

The booking preparation workflow shows unassigned serialized quantities and allows staff to select eligible units. Pooled items require no physical assignment.

Destructive actions display the exact affected reservations. The frontend does not rely on stale cached counts when saving quantity or assignments.

## 12. Tenant isolation and authorization

- Every inventory model stores `tenantId`, even where tenancy is derivable through relations.
- Every service query includes tenant scope and verifies the complete relationship chain.
- Variant-size IDs, product IDs, stock-unit IDs, booking IDs, and block targets must all belong to the authenticated tenant.
- Guest access resolves tenant from the request host and only reads published products.
- Owner inventory mutations require owner or manager permissions; limited staff assignment/inspection rights can use explicit permissions.
- Asset-code uniqueness is `(tenantId, assetCode)`, not global.
- Database constraints supplement service checks for tenant-local uniqueness and valid block scopes.

The existing warning-only Prisma tenant middleware is not treated as an authorization boundary.

## 13. Errors and operational safety

Stable error codes include:

- `INVENTORY_CAPACITY_CONFLICT`
- `INVENTORY_BLOCKED`
- `VARIANT_SIZE_NOT_FOUND`
- `INVALID_TRACKING_MODE_CHANGE`
- `QUANTITY_BELOW_RESERVED_CAPACITY`
- `STOCK_UNIT_NOT_ELIGIBLE`
- `STOCK_UNIT_ASSIGNMENT_CONFLICT`
- `RESERVATION_STATE_CONFLICT`

All failed multi-record operations roll back. Retriable serialization failures receive a bounded server-side retry; exhausted retries return a conflict instead of a generic 500. Logs include tenant, SKU, booking, and correlation IDs without customer-sensitive content.

## 14. Migration and rollout

### Phase 1: additive schema

- Add enums, new models, constraints, and indexes.
- Add `trackingMode` and `pooledQuantity` while retaining `stockLevel`.
- Backfill all existing variant-sizes as `POOLED` with `pooledQuantity = max(stockLevel, 0)`.

### Phase 2: identity backfill

- Resolve historical and active booking items to `variantSizeId` using existing variant and size identifiers where reliable.
- Produce a review report for ambiguous label-only records.
- Keep ambiguous active/future bookings as product-wide legacy blocks.
- Never infer an identity when more than one SKU matches.

### Phase 3: switch booking writes

- Require `variantSizeId` in guest and owner booking DTOs.
- Use the unified availability service and inventory reservations.
- Stop creating booking-specific product-wide `DateBlock` rows for new bookings.
- Continue reading legacy product-wide blocks.

### Phase 4: owner inventory UI

- Enable quantity management, serialization, unit lifecycle, calendars, and assignments.
- Add publish-readiness inventory validation.

### Phase 5: cleanup

- Verify that no active code reads `stockLevel` or writes booking date blocks.
- Convert remaining manual legacy blocks to scoped inventory blocks.
- Remove obsolete duplicate routes and fields in a separate cleanup migration.

Every migration script is resumable, tenant-scoped, reports counts, and supports a dry-run mode. Deployment remains backward compatible until Phase 5.

## 15. Indexing and constraints

At minimum, PostgreSQL indexes cover:

- reservations by `(tenantId, variantSizeId, status, blockedStartDate, blockedEndDate)`;
- stock units by `(tenantId, variantSizeId, status)`;
- assignments by stock unit and active/released state;
- inventory blocks by each scope and date range;
- movements by `(tenantId, variantSizeId, createdAt)`.

Check constraints enforce non-negative quantities, valid date ranges, positive reservation quantities, and exactly one inventory-block scope. Service-level row locking enforces aggregate capacity because a simple unique or exclusion constraint cannot enforce variable quantity sums.

## 16. Testing strategy

### Unit tests

- pooled and serialized capacity calculation;
- inclusive overlap and buffer handling;
- lifecycle state transitions;
- quantity-reduction and tracking-mode guards;
- eligible serialized-unit selection.

### Integration tests with PostgreSQL

- two simultaneous bookings competing for the last unit;
- multi-item booking lock ordering without deadlock;
- pending-hold expiration and cancellation release;
- product, variant, SKU, and unit block behavior;
- serialized assignment and reassignment conflicts;
- tenant-isolation attempts with foreign IDs;
- transaction rollback when any booking item is unavailable.

### API and frontend tests

- guest selection sends `variantSizeId` rather than a size label;
- variant/color/size availability remains independent;
- owner quantity and unit management validation;
- owner booking preparation assignment flow;
- sanitized public availability responses.

### Migration tests

- `stockLevel` backfill;
- deterministic booking identity matching;
- ambiguous booking reporting;
- repeated migration execution without duplication;
- legacy product block compatibility.

## 17. Acceptance criteria

The hybrid inventory implementation is complete when:

1. Booking one color/size no longer blocks unrelated SKUs.
2. A pooled SKU with quantity three accepts at most three overlapping reserved units.
3. A serialized SKU derives capacity from eligible physical units.
4. Unit maintenance lowers capacity only for affected dates.
5. Concurrent checkout cannot overbook.
6. Cancellation and expiration release capacity idempotently.
7. Staff can assign, replace, return, inspect, maintain, and retire serialized units with full history.
8. Owners can see accurate capacity and availability by product, variant, and size.
9. Cross-tenant inventory references are rejected.
10. Existing bookings and legacy blocks remain valid throughout rollout.
11. Automated tests cover capacity, concurrency, lifecycle, tenant isolation, and migration.

