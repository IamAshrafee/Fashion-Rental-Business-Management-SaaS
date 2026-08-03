# Hybrid Inventory Implementation Plan

**Design:** `docs/superpowers/specs/2026-08-03-hybrid-inventory-design.md`  
**Status:** In progress  
**Strategy:** Additive schema first, then one authoritative availability path, booking reservations, and UI adoption.

## Phase 1 — Database foundation

1. Add inventory enums to Prisma.
2. Extend `VariantSize` with tracking mode and pooled quantity while retaining `stockLevel` for compatibility.
3. Add `StockUnit`, `InventoryReservation`, `StockUnitAssignment`, `InventoryMovement`, and `InventoryBlock`.
4. Add tenant and domain relations to `Tenant`, `User`, `Product`, `ProductVariant`, `Booking`, and `BookingItem`.
5. Generate an additive Prisma migration.
6. Add SQL check constraints and access-path indexes not expressible cleanly in Prisma.
7. Backfill `pooled_quantity` from `stock_level` without modifying existing booking records.

## Phase 2 — Inventory feature module

1. Create `modules/inventory` as a focused NestJS feature module.
2. Implement validated DTOs for SKU configuration, public availability, stock units, blocks, and assignments.
3. Implement a single availability service for product/SKU validation, buffers, legacy blocks, scoped blocks, reservations, and capacity.
4. Implement owner inventory management and immutable movement recording.
5. Implement serialized-unit assignment and conflict validation.
6. Move inventory routes out of `ProductModule` and remove the duplicate guest availability route from `BookingModule`.
7. Export only availability and reservation services needed by booking.

## Phase 3 — Product and variant integration

1. Extend variant create/update payloads to accept inventory configuration per selected size.
2. Validate that sizes, variants, colors, and products are tenant-owned.
3. Return canonical `sizes[]` entries containing `variantSizeId`, size-instance data, tracking mode, and capacity.
4. Update owner product list/detail contracts to use canonical inventory summaries.
5. Add publish-readiness validation requiring positive rentable capacity.

## Phase 4 — Booking integration

1. Replace `selectedSize` identity with required `variantSizeId`; retain the label only as a snapshot.
2. Add booking-item quantity and variant-size relation.
3. Lock affected SKU rows in deterministic order within booking creation.
4. Recheck availability and create inventory reservations in the same transaction as booking/items.
5. Stop creating product-level booking blocks for new bookings while continuing to read legacy blocks.
6. Synchronize reservation status with booking confirmation, cancellation, completion, and expiration.
7. Add serialized-unit assignment endpoints to booking preparation.

## Phase 5 — Frontend adoption

1. Add shared inventory types and owner API methods.
2. Change guest product variants from singular `sizeInstance` to canonical `sizes[]` SKU options.
3. Store `variantSizeId`, quantity, and size label in cart records.
4. Send canonical inventory identity through validation and checkout.
5. Update manual owner booking selection in the same way.
6. Add product-form inventory controls for pooled quantities and serialized mode.
7. Add an owner inventory workspace for overview, physical units, condition/status, blocks, and movement history.
8. Add serialized assignment controls on booking detail/preparation.

## Phase 6 — Migration and verification

1. Add a dry-run-capable legacy booking identity report/backfill script.
2. Add unit tests for capacity/date overlap and service guards.
3. Add PostgreSQL integration coverage for simultaneous reservations and assignment conflicts.
4. Validate Prisma schema and migrations.
5. Run backend/frontend TypeScript checks, targeted tests, full tests, and production builds.
6. Document intentional legacy compatibility and any unresolved historical data requiring owner review.

## Safety rules

- Do not alter or overwrite the user’s current size-schema changes.
- Keep migrations additive until all active readers use the new fields.
- Never infer a legacy SKU when the match is ambiguous.
- Scope every inventory query by tenant.
- Never trust cached/public availability during booking creation.
- Do not hard-delete records that have booking or movement history.

