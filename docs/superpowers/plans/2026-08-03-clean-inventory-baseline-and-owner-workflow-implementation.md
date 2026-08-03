# Clean Inventory Baseline and Owner Workflow Implementation Plan

**Date:** 2026-08-03

**Source:** `docs/superpowers/specs/2026-08-03-clean-inventory-baseline-and-owner-workflow-design.md`

**Existing completed work:**

- hybrid SKU, pooled, serialized, reservation, and assignment foundation;
- physical-item lifecycle, inspections, issues, services, media, and set checklists;
- product composition, bundle expansion, add-ons, fulfilment requirements, substitutions, assignment, and partial returns.

**Execution rule:** Preserve the completed domain behavior, replace its transitional storage and APIs, and keep each implementation checkpoint compilable. Do not reset the local development database until the final clean baseline is generated and verified against a separate empty database.

## Checkpoint 1: Establish the final source-of-truth schema

### 1.1 Inventory identity and locations

- Add `InventoryLocationType` and structured capability fields.
- Add `InventoryLocation` with tenant-unique code, one default location, active state, address/contact/timezone, and capability indexes.
- Add required `locationId` to `StockUnit` and remove `status` and `locationLabel`.
- Update lifecycle queries to use disposition and operational state only.
- Replace service-order location text with `serviceLocationId`.
- Add constraints preventing invalid default/inactive location combinations.

### 1.2 Location pools and movements

- Add `InventoryPool` as the unique pooled SKU/location quantity record.
- Remove `VariantSize.stockLevel` and `VariantSize.pooledQuantity`.
- Extend `InventoryMovement` with location, pool, transfer, reservation, and reason-code context.
- Make every pool mutation movement-backed and optimistic-versioned.
- Add nonnegative quantity and identity constraints.

### 1.3 Policies and blocks

- Add versioned `AvailabilityPolicy` with tenant/location/product/SKU scope.
- Add nullable field-level overrides and active-version uniqueness.
- Add policy snapshot fields to fulfilment requirements.
- Replace product `DateBlock` and broad transitional blocks with one checked location-aware block model.
- Add quantity-aware pooled blocks and exact serialized-unit blocks.

### 1.4 Reservations and fulfilment

- Add mandatory `sourceLocationId` to fulfilment requirements and reservations.
- Add `inventoryPoolId` for pooled reservations.
- Add tracking-mode and availability-policy snapshots.
- Remove nullable product/SKU identity from active requirements; unresolved staff selection becomes an explicit proposal state before reservation, never an invalid reservation.
- Remove booking-item assignment compatibility routes and singular reservation API types.

### 1.5 Transfers

- Add transfer status, line kind, and receipt outcome enums.
- Add `InventoryTransfer`, `InventoryTransferLine`, `InventoryTransferUnit`, and immutable transfer events.
- Add origin/destination, approval, dispatch, receipt, cancellation, reconciliation, idempotency, and optimistic-version fields.
- Add database constraints for distinct locations, positive quantities, and valid line identity.

### 1.6 Pricing authority

- Extend versioned pricing policies to cover every field still sourced from `ProductPricing` and `ProductServices`.
- Add immutable quote/booking calculation snapshots.
- Remove `ProductPricing`, `ProductServices`, and related product relations.
- Remove product-level manually maintained availability and inventory-derived counters where they duplicate projections.

### 1.7 Schema verification

- Format and validate Prisma.
- Generate the client.
- Generate SQL diff from empty into a temporary review artifact.
- Review every foreign key, delete rule, unique constraint, check constraint, partial index, and availability query index.
- Do not modify the active database yet.

## Checkpoint 2: Implement location and pool domain services

### 2.1 Location service

- Create, update, list, read, and deactivate locations.
- Enforce one default and at least one active location.
- Reject deactivation with inventory, requirements, assignments, or transfers.
- Add tenant seed/default-location command.

### 2.2 Pool service

- Create pools when a pooled SKU is stocked at a location.
- Implement movement-backed receive, add, subtract, count-correction, and write-off commands.
- Lock the pool row before checking or changing capacity.
- Reject negative on-hand or reductions below committed demand.
- Return on-hand, committed, blocked, outgoing, incoming, and available separately.

### 2.3 Serialized location service

- Require a location when registering a unit.
- Move units only through receipt, transfer, or authorized correction commands.
- Enforce location capability and current operational state.
- Remove all legacy status writes and free-text location updates.

### 2.4 Tests

- Unit-test default-location invariants and deactivation guards.
- Transaction-test pool concurrency and nonnegative constraints.
- Test movement totals reconstruct current pool quantity.
- Test serialized location corrections and authorization.

## Checkpoint 3: Replace availability with location-aware planning

### 3.1 Policy resolver

- Resolve each policy field independently by tenant, location, product, and SKU precedence.
- Return the active policy-version identities and final normalized snapshot.
- Test partial overrides, timezone dates, and historical snapshot stability.

### 3.2 Capacity calculation

- Accept location or source-planning intent in every availability request.
- For pooled SKUs, derive capacity from the pool minus overlapping reservations, quantity blocks, and outgoing transfers.
- For serialized SKUs, derive capacity from eligible units at the location minus blocks and overlapping assignments.
- Expose incoming separately and never count it as available before receipt.
- Remove all `DateBlock`, `pooledQuantity`, `status`, and legacy fallback reads.

### 3.3 Bundle source planner

- Prefer a single capable location that can fulfil the full flat requirement list.
- When policy allows consolidation, calculate explicit transfers and lead time.
- Return explanations for selected location, shortages, or transfer dependency.
- Lock locations, pools, SKUs, and units deterministically.

### 3.4 Reservation integration

- Persist source location, pool identity, policy snapshot, and effective blocked dates on every requirement/reservation.
- Replan substitutions and date modifications atomically across locations.
- Make overdue extension conflicts produce operational exceptions without changing later bookings.

### 3.5 Tests

- Test pooled and serialized availability by location.
- Test simultaneous bundle bookings cannot over-reserve.
- Test single-location preference, transfer lead time, policy inheritance, and rollback.

## Checkpoint 4: Implement transfers and reconciliation

### 4.1 Transfer service and API

- Implement draft, edit, ready, dispatch, partial receipt, receipt, cancellation, and reconciliation commands.
- Support pooled lines and exact serialized-unit lines.
- Reserve origin capacity only at ready state.
- Update incoming/outgoing projections at dispatch.
- Apply destination inventory only at receipt.
- Create issues/inspections for damaged received serialized units.
- Require reasons for cancellation and reconciliation.

### 4.2 Transfer owner UI

- Add transfer list with status/location/date filters.
- Add transfer builder with origin availability.
- Add approval and dispatch workflow.
- Add scan-friendly partial receipt and discrepancy resolution.
- Show immutable timeline and movements.

### 4.3 Tests

- Test state transition matrix and idempotency.
- Test partial receipt totals and damaged/lost units.
- Test cancellation before and after dispatch.
- Test concurrent transfer versus booking capacity.

## Checkpoint 5: Reorganize the owner dashboard

### 5.1 Navigation shell

- Replace flat `NAV_ITEMS` with grouped, role-aware navigation.
- Add Overview, Catalog, Inventory, Rentals, Customers, Operations, Reports, and Settings groups.
- Add nested active-state handling, mobile sheet behavior, and human-readable breadcrumb labels.
- Preserve URLs where they remain semantically correct and add redirects only for user navigation, not compatibility APIs.

### 5.2 Inventory workspace

- Add `/dashboard/inventory` overview.
- Add stock-by-SKU/location list and physical-item list.
- Add locations, pools, transfers, inspections/issues, service work, policies/blackouts, counts, and movement-history routes.
- Link product and SKU details into filtered inventory routes.
- Keep unit detail as the exact-item operational record.

### 5.3 Rental workspace

- Organize requests, calendar, fulfilment, preparation, handout, returns, inspection intake, overdue, and loss queues.
- Reuse booking detail as the commercial record plus requirement-level fulfilment workspace.
- Add next-action and blocking-reason summaries.

### 5.4 Operations and reports

- Move deliveries and courier exceptions under Operations.
- Add a cross-domain task queue for shortages, transfer delays, inspection, service, and overdue exceptions.
- Group sales analytics, inventory analytics, location performance, and traffic under Reports.

### 5.5 UX and performance checks

- Use server pagination and URL-backed filters.
- Add loading, empty, error, permission, stale-version, and conflict states.
- Ensure operational actions are reachable within two navigation steps.
- Run TypeScript and focused lint without browser-based verification.

## Checkpoint 6: Remove pricing and API compatibility

### 6.1 Pricing service

- Move remaining booking validation and creation to the versioned pricing engine.
- Remove compatibility calculation methods and nullable-profile fallback.
- Make pricing profile creation part of product creation.
- Store quote snapshots and deterministic bundle allocations.

### 6.2 Backend cleanup

- Delete `DateBlock` reads/writes and booking synchronization.
- Delete old booking-item assignment endpoints.
- Delete old product inventory quantity fields from DTOs and services.
- Delete old stock-unit status logic.
- Remove legacy pricing/service controllers and frontend clients.
- Rename misleading compatibility variables and comments.

### 6.3 Frontend cleanup

- Update product create/edit to configure pricing policy and initial pools/units by location.
- Remove old quantity, status, location-label, and pricing/service inputs.
- Remove unused API contracts and duplicate booking assignment UI.
- Confirm storefront, cart, checkout, manual booking, booking detail, catalog, and inventory all use current contracts.

## Checkpoint 7: Visibility, assignment, and condition pricing

- Add versioned public visibility policies.
- Add assignment policies and deterministic candidate scoring.
- Persist candidate and override explanations.
- Add per-unit rental and deposit adjustments with quote snapshots.
- Add sanitized storefront tier/unit selection when enabled.
- Add preferred-price requests with expiry, approval, rejection, and optional holds.
- Test privacy, scoring determinism, stale quotes, and customer disclosures.

## Checkpoint 8: Analytics, valuation, and reminders

- Add immutable revenue-allocation facts.
- Add rebuildable serialized-unit and pooled SKU/location metrics.
- Add service cost, damage recovery, downtime, utilization, and profitability projections.
- Add versioned valuation/depreciation and maintenance-reminder policies.
- Add reports by location, category, product, SKU, bundle, and physical unit.
- Ensure recommendations never retire or reprice inventory automatically.
- Test reconstruction, rounding, formulas, and historical stability.

## Checkpoint 9: Backend-to-frontend gap audit

For every domain capability, verify:

- schema and constraints;
- service and transaction boundary;
- authorized controller and validated DTO;
- typed frontend API;
- discoverable UI entry point;
- complete UI states;
- audit/history view;
- unit and integration coverage.

Record and close gaps for catalog, pricing, locations, pools, units, availability, composition, reservations, fulfilment, transfers, inspections, issues, services, returns, visibility, assignment, analytics, and storefront booking.

## Checkpoint 10: Create and apply the clean baseline

### 10.1 Baseline generation

- Stop local services.
- Preserve recoverability through Git history and export any explicitly requested test fixtures.
- Remove accumulated migration directories from the working tree.
- Generate one baseline migration from the final schema.
- Add PostgreSQL constraints and partial indexes not expressible in Prisma.

### 10.2 Empty-database proof

- Create an isolated empty local PostgreSQL database.
- Deploy the baseline.
- Run deterministic seed.
- Run schema invariants and focused integration tests.
- Run backend build, frontend TypeScript, focused lint, and repository verification.

### 10.3 Local reset

- Resolve the exact local development database from configuration.
- Reset only that database.
- Deploy the verified baseline and seed.
- Run read-only counts and invariant queries.
- Restart services and run API-level smoke checks without opening a browser.

## Commit strategy

1. `feat: add authoritative locations pools and policies`
2. `feat: make rental availability location aware`
3. `feat: add inventory transfers and reconciliation`
4. `feat: reorganize owner inventory workflows`
5. `refactor: remove inventory and pricing compatibility`
6. `feat: add assignment visibility and condition pricing`
7. `feat: add inventory analytics and valuation`
8. `refactor: establish clean database baseline`

Each commit must pass its focused tests and compile checks. No commit may include unrelated user work.
