# Clean Inventory Baseline and Owner Workflow Design

**Date:** 2026-08-03

**Status:** Approved direction; implementation specification

**Scope:** Replace transitional inventory compatibility with one authoritative rental domain and reorganize the owner dashboard around real operational workflows.

**Builds on:**

- `2026-08-03-complete-rental-inventory-domain-design.md`
- `2026-08-03-hybrid-inventory-design.md`

## 1. Decision

The application is still in active development, so its development database and accumulated migration history are disposable. The final implementation will not retain old columns, fallback calculations, duplicate APIs, compatibility projections, or data backfills merely to preserve the current development model.

The schema will be completed first, then replaced by one clean baseline migration and deterministic seed. The local development database will be reset only after the clean schema, migration, seed, backend, and frontend have been verified together.

“No legacy” does not mean deleting historical business records from the final domain. Booking snapshots, requirement versions, substitutions, movements, inspections, service events, price snapshots, and financial records remain immutable because they are operational history, not compatibility baggage.

## 2. Reality check

The design was compared with current rental and multi-location inventory workflows:

- Booqable distinguishes bulk inventory from individually trackable stock items and calculates availability for the rental period. Variations have separate inventory and trackable items have unique identifiers.
- Booqable reserves the complete cart only when every item is available and uses independent before/after buffer time without adding the buffer to customer-visible rental dates or pricing.
- OnRent/Current RMS distinguishes provisional allocation from reserved stock, permits exact serialized-asset allocation, and supports post-rental unavailability for cleaning or maintenance.
- Shopify’s location inventory model separates on-hand, committed, unavailable, available, and incoming quantities. Transfers move inventory through draft, ready, in-progress, received, and cancelled states.
- Store pickup workflows normally require the full order at one location, with an explicit transfer plan when stock must be consolidated.

These references validate the underlying principles, but this system keeps the stronger rental-specific lifecycle, inspection, bundle, and return controls already designed.

Reference material:

- https://help.booqable.com/en/articles/3461344-glossary-of-booqable-terms
- https://help.booqable.com/en/articles/5485891-how-to-display-and-hide-product-availability
- https://help.booqable.com/en/articles/90053-how-to-adjust-product-settings
- https://help.booqable.com/en/articles/13258663-how-to-manage-bundles-on-orders
- https://help.current-rms.com/en/articles/660518-how-is-availability-calculated
- https://help.current-rms.com/en/articles/660540-prevent-overbooking-of-products
- https://help.shopify.com/en/manual/products/inventory/fundamentals/inventory-states
- https://help.shopify.com/en/manual/products/inventory/inventory-transfers/creating-and-managing-transfers
- https://help.shopify.com/en/manual/locations/assigning-inventory-to-locations

## 3. Current problems to remove

The current code contains transitional duplication that would make the completed system unreliable:

- `VariantSize.stockLevel` and `VariantSize.pooledQuantity` duplicate the future location pool quantity.
- `StockUnit.status` duplicates disposition and operational state.
- `StockUnit.locationLabel` and service-order location text duplicate structured locations.
- `DateBlock` overlaps `InventoryBlock` and availability checks query both.
- `ProductPricing` and `ProductServices` coexist with the versioned pricing engine and cause fallback calculations.
- booking code synchronizes old booking blocks in addition to fulfilment reservations.
- booking and frontend API types still expose old booking-item assignment routes alongside requirement-level fulfilment.
- product-level counters mix source data with derived analytics.
- inventory screens are subordinate to individual product pages, leaving no location, transfer, return, service, or stock-control workspace.
- the flat sidebar combines catalog, rentals, delivery, and analytics without reflecting staff workflows.

Every item above will be removed or replaced. A field will not be retained simply because an existing page currently reads it; the reader must move to the authoritative model.

## 4. Authoritative domain model

### 4.1 Catalog

`Product -> ProductVariant -> VariantSize` remains the customer-facing catalog hierarchy.

- `Product` owns merchandising, publication, category, description, and package definition.
- `ProductVariant` owns a visual/color edition.
- `VariantSize` is the rentable SKU and owns `trackingMode`, SKU identity, and configuration references.
- `VariantSize` stores no inventory quantity.
- product availability is derived from policy, inventory, dates, and fulfilment—not a manually synchronized boolean.

### 4.2 Locations

`InventoryLocation` is mandatory for all inventory. Each tenant has exactly one default active location after seeding.

A location stores:

- tenant-unique code and name;
- type: warehouse, showroom, pickup point, cleaning facility, repair facility, or external;
- timezone and contact/address data;
- capabilities for storage, fulfilment, pickup, return, cleaning, repair, and transfers;
- active and default state.

A location cannot be deactivated while it owns on-hand inventory, active assignments, open fulfilment requirements, or unfinished transfers. The default location cannot be deactivated.

### 4.3 Pooled inventory

`InventoryPool` is the sole quantity source for a pooled SKU at a location.

It stores:

- `variantSizeId` and `locationId` as a unique pair;
- `onHandQuantity`;
- an optimistic concurrency version;
- optional reorder threshold.

Available quantity is calculated, never stored:

`available = on hand - active reservation demand - quantity blocks - outgoing transfer quantity`

Incoming transfers are reported separately and do not become available until received. Quantity changes happen only through append-only `InventoryMovement` commands. Direct updates to pool quantity are forbidden outside the inventory transaction service.

### 4.4 Serialized inventory

`StockUnit` is the sole physical identity for serialized inventory.

It has:

- required `locationId`;
- tenant-unique asset code and optional barcode;
- asset disposition;
- operational state;
- condition grade;
- acquisition and operational valuation data;
- component completeness projection;
- immutable movement and lifecycle history.

The old status and free-text location fields are removed. A future reservation does not change present operational state. A unit in transfer has a transfer line and `IN_TRANSFER` state until receipt or reconciliation.

### 4.5 Fulfilment and reservations

`BookingItem` is the commercial line and immutable customer snapshot. `FulfillmentRequirement` is the operational obligation. Every simple item, bundle component, and selected add-on becomes a requirement.

Each active requirement owns:

- exactly one resolved product and SKU;
- required source location;
- quantity and tracking mode snapshot;
- rental and effective blocked ranges;
- availability-policy snapshot;
- pricing/revenue allocation snapshot;
- exactly one reservation;
- assignment, handout, return, loss, and substitution history.

Pooled reservations point to an `InventoryPool`. Serialized reservations point to a source location and later receive exact `StockUnitAssignment` records. Requirement-level routes are the only assignment API; booking-item compatibility routes are removed.

### 4.6 Blocks

There is one inventory block model with explicit scope and database checks:

- pooled SKU/location quantity block;
- serialized stock-unit block;
- location blackout;
- catalog SKU blackout.

Exactly one target scope is required. Quantity is required only for pooled blocks. Service and inspection workflows own their generated blocks. The old product date-block model is removed.

### 4.7 Pricing and services

The versioned pricing engine becomes authoritative. `ProductPricing`, `ProductServices`, and fallback pricing calculations are removed.

Pricing profiles and policy versions cover:

- duration calculation and rental rates;
- minimum charge and extension rate;
- cleaning, try-on, backup-size, delivery, and other service charges;
- refundable deposit policy;
- late fees and caps;
- bundle and component adjustments;
- condition/item adjustments in the later pricing phase.

Every quote and booking stores a complete immutable calculation snapshot. Frontends never calculate an authoritative price.

## 5. Availability policy and calculation

Availability policy uses versioned field-level inheritance:

`tenant default -> location override -> product override -> SKU override`

Independently inheritable fields include:

- preparation buffer;
- delivery/pickup buffer;
- return buffer;
- inspection buffer;
- cleaning buffer;
- minimum booking notice;
- maximum advance window;
- shortage policy;
- single-location bundle requirement;
- cross-location transfer allowance and lead time;
- pending-hold duration;
- eligible condition grades and operational states.

The resolved policy is snapshotted on every fulfilment requirement. Later policy edits affect new quotes only.

Availability is calculated for a requested SKU, location, quantity, and date range:

1. validate tenant, product publication, SKU, location capability, and policy window;
2. calculate the effective blocked range from the resolved policy;
3. acquire deterministic pool/SKU locks inside the booking transaction;
4. derive pooled or serialized capacity from the authoritative location source;
5. subtract overlapping reservations, blocks, assignments, and dispatched transfers;
6. evaluate every bundle component and source plan;
7. return a safe result with availability, shortage reason, and optional next-available guidance;
8. create all requirements and reservations atomically or create none.

No shared mutable “available quantity” or cache is authoritative. Cache may accelerate public calendar projections, but every booking is revalidated transactionally.

## 6. Transfers

`InventoryTransfer` moves pooled or serialized inventory between locations. Its state machine is:

`DRAFT -> READY -> DISPATCHED -> PARTIALLY_RECEIVED -> RECEIVED`

with guarded `CANCELLED` and `RECONCILIATION_REQUIRED` outcomes.

Rules:

- drafts do not reserve stock;
- ready transfers reserve origin capacity;
- dispatched pooled quantity becomes outgoing at origin and incoming at destination;
- dispatched serialized units become `IN_TRANSFER` and cannot fulfil bookings;
- receipt increments the destination pool or changes a unit’s location;
- partial receipt records exact accepted, damaged, lost, and pending quantities;
- damage on receipt creates an inspection/issue and prevents availability;
- cancellation after dispatch requires reconciliation, never silent rollback;
- every transition and quantity effect is an immutable movement.

Bundle fulfilment plans use one location by default. When policy permits consolidation, the quote records the proposed source and required transfers, including lead time. A transfer-dependent booking cannot be confirmed unless the plan can finish before preparation begins.

## 7. Owner dashboard information architecture

The sidebar becomes grouped navigation rather than a flat list.

### Overview

- business snapshot;
- today’s pickups/deliveries/returns;
- preparation, inspection, service, shortage, transfer, and overdue alerts;
- shortcuts to the staff queues that require action.

### Catalog

- Products;
- Categories and subcategories;
- Product types;
- Size systems;
- Events/collections;
- product composition, variants, pricing, services, and storefront presentation.

Catalog answers: “What do we offer?”

### Inventory

- Inventory overview;
- Stock by SKU and location;
- Physical items;
- Locations and capabilities;
- Transfers;
- Inspections and issues;
- Cleaning, repair, and maintenance;
- Availability policies and blackouts;
- Stock counts and movement history.

Inventory answers: “What do we physically have, where is it, and can it be used?”

### Rentals

- All rentals;
- Calendar;
- Requests/pending confirmation;
- Fulfilment and preparation queue;
- Handout/pickup;
- Returns and inspection intake;
- Overdue and loss resolution.

Rentals answer: “What have customers requested and what must staff do next?”

### Customers

- Customers;
- history, notes, tags, deposits, damage responsibility, and communication context.

### Operations

- Delivery and pickup dispatch;
- courier exceptions;
- cross-department work queue;
- notifications and escalations.

Operations answers: “What must move or be resolved across the business?”

### Reports

- Sales and rental performance;
- inventory utilization and profitability;
- maintenance and damage cost;
- location performance;
- storefront traffic and funnel.

### Settings

- Store and branding;
- staff, roles, and sessions;
- locale and currency;
- payment and delivery integrations;
- operational defaults;
- subscription and domain;
- audit log.

## 8. Page and workflow rules

- Global inventory work is never hidden only beneath a product detail page.
- Product detail links into filtered inventory views for that product/SKU.
- A booking detail shows the commercial summary first and a complete fulfilment workspace second.
- Preparation, handout, return, inspection, cleaning, and repair are explicit queues with bulk-safe actions.
- Staff should reach the next required action in at most two navigation steps from Overview.
- Every list supports server pagination, search, meaningful filters, stable sorting, and saved URL state.
- Every detail page shows current state, blocking reason, next valid actions, and immutable history.
- Destructive or irreversible actions require an explicit reason and confirmation.
- Mobile layouts prioritize scanning, assignment, handout, return, and inspection actions.
- Empty, loading, error, permission, conflict, and stale-state experiences are mandatory, not optional polish.

## 9. Backend-to-frontend completeness contract

A domain capability is incomplete until all of the following exist:

1. schema constraints and indexes;
2. tenant-scoped domain service;
3. authorized controller route and validated DTO;
4. typed frontend API contract;
5. discoverable owner or storefront entry point;
6. loading, empty, success, validation, permission, conflict, and retry states;
7. audit/history visibility;
8. focused service tests and contract-level integration tests.

An implementation checklist will track this matrix for catalog, stock, locations, transfers, availability, composition, fulfilment, lifecycle, inspections, service work, pricing, reporting, and storefront booking. Backend-only tables and frontend-only buttons are release blockers.

## 10. Performance and correctness

- Booking, substitution, date modification, transfer dispatch/receipt, pool adjustment, and assignment use serializable transactions where competing capacity is possible.
- Locks are acquired in stable location/SKU/unit order.
- PostgreSQL constraints prevent negative quantities, invalid date ranges, invalid scope combinations, duplicate active identities, and overlapping active serialized assignments.
- Availability indexes follow tenant, location, SKU/unit, status, and date overlap query paths.
- Large histories are paginated; owner lists never fetch unbounded nested relations.
- Summary dashboards use rebuildable projections, not live N+1 aggregation.
- Public projections expose no asset codes, internal condition notes, acquisition cost, service cost, or location details unless an explicit visibility policy permits a sanitized field.
- API mutations use idempotency keys where staff devices, courier callbacks, or retries may repeat a command.
- Optimistic version checks reject stale pool and transfer edits.
- Timezone conversion occurs at API boundaries; stored timestamps are UTC and business-date rules use the tenant/location timezone.

## 11. Clean reset and migration strategy

1. Complete the final Prisma schema and database constraints.
2. Remove legacy services, DTO fields, controller routes, frontend API methods, UI fields, and fallback branches.
3. Update seed data to create pricing profiles, a default inventory location, availability policy, pools, and serialized units directly in the new model.
4. Generate one clean baseline migration from an empty database.
5. Verify the baseline on a temporary empty PostgreSQL database.
6. Run all backend tests, frontend type checks, focused lint, and production compilation.
7. Stop the local development environment.
8. reset the local development database;
9. apply the baseline and seed;
10. run read-only invariants and API smoke tests;
11. restart the development environment.

No production-data migration or compatibility backfill will be written at this stage. If production data exists in the future, migration requirements will be designed from the actual deployed version rather than from removed development history.

## 12. Delivery order

The clean architecture is delivered in deployable internal checkpoints, but the development baseline is regenerated only after the model is complete:

1. schema cleanup and authoritative location/pool/policy model;
2. location-aware availability and reservations;
3. transfers, reconciliation, and movement history;
4. owner dashboard shell and grouped navigation;
5. inventory and rental operational workspaces;
6. pricing authority cleanup;
7. visibility, assignment strategies, and condition-sensitive quoting;
8. analytics, valuation, reminders, and reports;
9. storefront and owner contract-gap audit;
10. baseline migration, reset, seed, and full verification.

## 13. Acceptance criteria

- No legacy or compatibility identifier remains in schema, service, API, or UI code for the replaced domains.
- Every pooled quantity belongs to one SKU/location pool.
- Every active serialized item belongs to one active location or dispatched transfer.
- Every booking reserves all required components atomically by source location.
- No returned or operationally blocked item is offered as available.
- Every transfer quantity and unit reconciles exactly.
- Pricing has one authoritative engine and every booking has an immutable quote snapshot.
- Owner navigation exposes catalog, inventory, rental, and operational work as distinct workflows.
- Every backend capability has a typed, discoverable frontend workflow.
- Concurrency tests prove that inventory cannot be over-reserved or double-assigned.
- The repository builds and tests from a fresh database using the single clean baseline migration and deterministic seed.
