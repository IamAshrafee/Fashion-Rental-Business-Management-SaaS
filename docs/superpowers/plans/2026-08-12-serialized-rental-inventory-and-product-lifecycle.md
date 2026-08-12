# Serialized Rental Inventory and Product Lifecycle Implementation Plan

**Date:** 2026-08-12

**Design:** `docs/superpowers/specs/2026-08-12-serialized-rental-inventory-and-product-lifecycle-design.md`

**Strategy:** Replace the hybrid inventory domain with one serialized-only contract, then complete Catalog, Physical Items, Inventory, booking fulfilment, profitability, and contextual help as dependency-safe vertical slices. Each checkpoint ends with focused verification; expensive repository-wide verification is reserved for the final cutover. Browser and visual verification are excluded by user direction.

## Execution rules

- Preserve the existing uncommitted changes in:
  - `apps/frontend/src/app/(owner)/dashboard/customers/[id]/page.tsx`
  - `apps/frontend/src/app/(owner)/dashboard/customers/page.tsx`
- Never stage, overwrite, reformat, or otherwise absorb those customer changes into this work.
- Treat `docs/superpowers/specs/2026-08-12-serialized-rental-inventory-and-product-lifecycle-design.md` as the authoritative design.
- Do not retain pooled compatibility fields, tables, APIs, UI, seed paths, or fallback calculations in the completed checkpoints.
- Every merged checkpoint must compile and leave its owned workflows internally consistent. The schema/backend cutover is intentionally one broad checkpoint because removing generated Prisma enums and relations breaks all consumers at once.
- Use physical-item identity for every inventory mutation. Counts are projections, never editable stock values.
- Keep booking, pricing, fulfilment, movement, assignment, inspection, issue, service, and financial history immutable.
- Use integer minor units for money and explicit business-date/timezone handling at API boundaries.
- Preserve tenant scoping, authorization, idempotency, and optimistic/concurrency protections while simplifying the domain.
- Use `apply_patch` for hand-authored source changes. Generated Prisma client and formatting output may use their normal generators.
- Stage only files belonging to the active checkpoint and commit coherent slices.
- Do not reset the active development database early. First validate the clean schema and baseline against a disposable empty PostgreSQL database; reset/reseed the local development database only at the final cutover.
- Prefer focused unit/integration tests during implementation. Run the full integration suite and production builds only at the final checkpoint unless a checkpoint-wide failure requires earlier escalation.
- Do not use browser or visual testing for this program.

## Checkpoint A — Protected baseline and exact cutover map

### Task A1: Record the protected worktree and baseline

Primary files:

- `apps/frontend/src/app/(owner)/dashboard/customers/[id]/page.tsx`
- `apps/frontend/src/app/(owner)/dashboard/customers/page.tsx`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20260803200000_complete_saas_baseline/migration.sql`
- `apps/backend/prisma/seed.ts`
- `package.json`

Actions:

- Record the existing customer-page diffs and keep them outside every stage/commit.
- Confirm the baseline migration is still the only migration source.
- Record the current Prisma, backend, frontend, and integration commands.
- Record existing failures only if encountered by a necessary command; do not spend tokens running broad baseline suites before implementation.

Verification:

- `git status --short`
- `git diff --check`
- No build or full test run in this task.

### Task A2: Create a cutover checklist from live references

Create:

- `docs/serialized-inventory-cutover-checklist.md`

Populate one row per live reference group, including:

- Prisma enums, models, relations, indexes, and migration SQL;
- tenant-isolation middleware;
- product DTOs, onboarding, variants, readiness, list/detail projections, and tests;
- inventory pool, availability, reservation, assignment, blocks, movements, counts, transfers, dashboard, locations, fulfilment, lifecycle, and tests;
- booking/storefront cart contracts and tests;
- analytics/profitability queries;
- frontend product, guest-product, booking, fulfilment, and inventory API types;
- product onboarding/editing/list/detail screens;
- inventory overview, Stock by SKU, Physical Items, availability, transfers, movements, counts, and product-scoped inventory screens;
- seed data and authoritative documentation.

Each row records its removal/replacement checkpoint and final evidence. This checklist is an execution control, not a second design document.

### Task A3: Checkpoint commit

- Review the checklist for missing live references.
- Commit only the checklist.

## Checkpoint B — Serialized-only schema and backend contract cutover

This checkpoint deliberately crosses product, inventory, booking, analytics, generated types, seed, and tests. Do not commit an intermediate state in which generated Prisma types and consumers disagree.

### Task B1: Replace the database model

Primary files:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20260803200000_complete_saas_baseline/migration.sql`
- `apps/backend/prisma/seed.ts`
- `apps/backend/src/prisma/tenant-isolation.middleware.ts`

Schema actions:

- Remove `InventoryTrackingMode`.
- Remove `InventoryTransferLineKind`.
- Remove `InventoryPool` and all tenant/location/SKU relations to it.
- Remove `VariantSize.trackingMode` and its index.
- Keep `VariantSize.inventoryVersion` as the SKU capacity/concurrency lock version if it is still useful; otherwise replace it with a clearly named SKU revision used by reservation locking.
- Remove `FulfillmentRequirement.trackingModeSnapshot`.
- Remove `InventoryReservation.inventoryPoolId` and `preferredStockUnitId` plus their relations/indexes.
- Remove pool and quantity fields from `InventoryBlock`, including `inventoryPoolId` and `quantity`.
- Simplify `InventoryTransferLine` to a SKU grouping for exact `InventoryTransferUnit` identities. Remove line kind, pool identity, and stored requested/dispatched/received/damaged/lost quantities when they can be derived from unit outcomes.
- Require every `InventoryMovement` to reference one `StockUnit`; remove `inventoryPoolId` and anonymous `quantityDelta`.
- Remove `INITIAL_STOCK`, `POOLED_ADDITION`, and `POOLED_REDUCTION`; retain or rename only item-specific movement types.
- Rename `StockUnit.purchaseDate` to `acquisitionDate` and `purchasePrice` to `acquisitionCost` in the clean baseline.
- Add optional physical-item `acquisitionSource` and `acquisitionReference` fields with bounded lengths.
- Retain `estimatedCurrentValue` as a separate private valuation field.
- Remove product-level `purchaseDate`, `purchasePrice`, `purchasePricePublic`, and `targetRentals`.
- Rename product `itemCountry` to `countryOfOrigin` and replace its old purchase-oriented public semantics with an explicit catalog visibility contract.
- Add a separately named optional `referenceRetailValue` plus an explicit public-display flag if the product can store a private draft value before publication.
- Preserve database checks, unique identities, soft-delete/history restrictions, and indexes needed by item eligibility and overlap queries.

Financial attribution actions:

- Add an append-only `StockUnitRevenueAllocation` (or equivalently explicit, narrowly named model) linked to tenant, physical item, assignment, booking, booking item, and fulfilment requirement.
- Store signed integer minor-unit allocations, allocation kind (`RENTAL_REVENUE` or `ADJUSTMENT`), idempotency/source identity, reason, and timestamp.
- Enforce uniqueness so completion/retry cannot allocate the same financial source twice.
- Do not duplicate service cost: completed `InventoryServiceOrder.cost` remains the physical-item service-cost source.

Baseline migration actions:

- Regenerate the single clean baseline from the final schema rather than appending compatibility migrations.
- Review foreign keys, delete rules, unique constraints, check constraints, and indexes.
- Ensure a fresh empty database can be migrated without reference to removed enums/tables.

Seed actions:

- Seed every rentable SKU with serialized physical items only where demo stock is intended.
- Give seeded pieces deterministic asset codes, location, acquisition context, condition, and components.
- Remove pooled quantities and tracking-mode selection from seed helpers.
- Preserve repeatable seed behavior.

### Task B2: Remove pooled and tracking DTO/API contracts

Primary files:

- `apps/backend/src/modules/product/dto/product.dto.ts`
- `apps/backend/src/modules/product/dto/product-onboarding.dto.ts`
- `apps/backend/src/modules/inventory/dto/inventory.dto.ts`
- `apps/backend/src/modules/inventory/dto/inventory-foundation.dto.ts`
- `apps/backend/src/modules/inventory/dto/inventory-block.dto.ts`
- `apps/backend/src/modules/inventory/dto/inventory-transfer.dto.ts`
- `apps/backend/src/modules/inventory/dto/fulfillment.dto.ts`
- `apps/backend/src/modules/booking/dto/booking.dto.ts`

Actions:

- Remove tracking mode from create/update/query DTOs.
- Remove opening pooled quantity and the entire onboarding opening-inventory DTO.
- Remove pool adjustment/count DTOs and endpoints.
- Remove pool block targets and quantity blocks.
- Make transfer creation accept exact physical-item IDs grouped or validated by SKU.
- Remove pool/tracking fields from availability, reservation, booking, and fulfilment responses.
- Rename physical acquisition DTO fields consistently.
- Add bounded acquisition source/reference fields and per-row overrides to batch registration.
- Add typed metadata-correction DTOs requiring `reason` and `expectedVersion` where applicable.
- Keep one canonical batch registration payload and response contract.

### Task B3: Simplify product and onboarding backend services

Primary files:

- `apps/backend/src/modules/product/product-onboarding.service.ts`
- `apps/backend/src/modules/product/product-onboarding.controller.ts`
- `apps/backend/src/modules/product/product.service.ts`
- `apps/backend/src/modules/product/variant.service.ts`
- `apps/backend/src/modules/product/product.controller.ts`
- `apps/backend/src/modules/product/*.spec.ts`
- `apps/backend/test/product-onboarding.integration-spec.ts`

Actions:

- Make every created SKU implicitly physical-item backed; remove tracking-mode writes and change guards.
- Remove opening inventory from onboarding section order, readiness dependencies, controller routes, command replay, and integration tests.
- Remove product purchase/target fields from create, update, projections, filters, and detail responses.
- Add country-of-origin/reference-retail-value catalog fields with explicit storefront behavior.
- Keep catalog publication valid at zero stock.
- Preserve idempotent draft creation, section revisions, pricing versions, media readiness, and safe SKU identity edits.
- Protect SKU restructuring whenever physical items, reservations, fulfilment requirements, bookings, movements, or protected history exist.
- Permit explicit hard deletion only for drafts/variants/SKUs with no protected references; archive/deactivate historical records.
- Remove catalog tracking filters and `NONE`/`MIXED` projections.
- Update focused product and onboarding tests before moving on.

### Task B4: Replace inventory pool and availability services

Primary files:

- delete `apps/backend/src/modules/inventory/inventory-pool.service.ts`
- `apps/backend/src/modules/inventory/inventory.module.ts`
- `apps/backend/src/modules/inventory/inventory-foundation.controller.ts`
- `apps/backend/src/modules/inventory/inventory-management.service.ts`
- `apps/backend/src/modules/inventory/inventory-availability.service.ts`
- `apps/backend/src/modules/inventory/inventory-reservation.service.ts`
- `apps/backend/src/modules/inventory/inventory-assignment.service.ts`
- `apps/backend/src/modules/inventory/inventory-block.service.ts`
- `apps/backend/src/modules/inventory/inventory-ledger.service.ts`
- `apps/backend/src/modules/inventory/inventory-location.service.ts`
- `apps/backend/src/modules/inventory/inventory-dashboard.service.ts`

Actions:

- Delete pool providers, routes, queries, movements, counts, and location-deactivation checks.
- Make SKU/location capacity count eligible physical items minus overlapping active reservation demand exactly once.
- Treat exact assignments as realization of reservation demand, not an additional capacity subtraction.
- Exclude supply-side blocks, transfer state, service/inspection state, blocking issues, missing components, loss, and retirement.
- Preserve policy buffers and explicitly configured shortage behavior.
- Lock affected SKU rows in deterministic order and recheck capacity inside booking transactions.
- Remove preferred/customer-selected physical-item capacity behavior.
- Make item assignment always applicable and keep overlap locking/constraints.
- Make all generic blocks target product, variant, SKU, physical item, or location only.
- Require all movements to reference an exact physical item.
- Replace pooled stock counts with identity-based count sessions/results, or complete the existing count contracts on that basis.
- Derive Inventory Overview, Stock by SKU, location, and attention projections solely from physical items.
- Rename acquisition/valuation fields across service inputs and outputs.
- Add audited metadata-correction command(s) separate from lifecycle commands.

Focused tests:

- `apps/backend/src/modules/inventory/__tests__/inventory-availability.service.spec.ts`
- `apps/backend/src/modules/inventory/__tests__/inventory-reservation.service.spec.ts`
- `apps/backend/src/modules/inventory/__tests__/inventory-batch-registration.service.spec.ts`
- `apps/backend/src/modules/inventory/__tests__/inventory-block.service.spec.ts`
- `apps/backend/src/modules/inventory/__tests__/inventory-foundation.service.spec.ts`

Delete pooled-only assertions and replace them with item-capacity, identity-count, acquisition, and tenant-isolation cases.

### Task B5: Simplify exact-item transfers

Primary files:

- `apps/backend/src/modules/inventory/inventory-transfer.service.ts`
- `apps/backend/src/modules/inventory/inventory-transfer.controller.ts`
- `apps/backend/src/modules/inventory/dto/inventory-transfer.dto.ts`
- `apps/backend/src/modules/inventory/__tests__/inventory-transfer.service.spec.ts`
- `apps/backend/test/inventory-control.integration-spec.ts`

Actions:

- Accept exact eligible physical-item IDs at draft creation.
- Validate tenant, origin, destination, SKU grouping, operational state, blocks, and active assignments.
- Derive requested/dispatched/received/damaged/lost counts from transfer-unit outcomes.
- Lock transfer and item records in stable order for ready, dispatch, receipt, cancellation, and reconciliation.
- Create one movement/lifecycle event per affected item.
- Preserve partial receipt and unresolved exception behavior without anonymous quantities.
- Update transfer integration coverage for mixed SKU batches, partial outcomes, retry, stale version, and tenant isolation.

### Task B6: Remove pooled fulfilment and booking branches

Primary files:

- `apps/backend/src/modules/inventory/fulfillment.service.ts`
- `apps/backend/src/modules/inventory/fulfillment.controller.ts`
- `apps/backend/src/modules/booking/booking.service.ts`
- `apps/backend/src/modules/booking/storefront-cart.service.ts`
- `apps/backend/src/modules/booking/inventory-hold-scheduler.service.ts`
- `apps/backend/src/modules/booking/booking.service.spec.ts`
- `apps/backend/src/modules/inventory/__tests__/fulfillment.service.spec.ts`
- `apps/backend/test/inventory-concurrency.integration-spec.ts`

Actions:

- Remove every tracking-mode and pool branch from requirement creation, reservation, preparation, handout, return, loss, substitution, extension, cancellation, and completion.
- Require physical-item assignment before preparation can become ready and before handout.
- Remove pooled loss reconciliation and reconcile all loss outcomes against assigned physical items.
- Remove public preferred-item reservation inputs and responses.
- Keep quantity requirements and SKU/location reservations before assignment.
- Preserve immutable policy, product, SKU, price, and composition snapshots without tracking mode.
- Ensure bundle requirements reserve and assign physical pieces for every component.
- Update concurrency coverage for SKU-capacity locks and overlapping item assignments.

### Task B7: Add deterministic revenue attribution

Primary files:

- `apps/backend/src/modules/inventory/fulfillment.service.ts`
- `apps/backend/src/modules/booking/booking.service.ts`
- `apps/backend/src/modules/analytics/analytics.service.ts`
- new focused revenue-allocation service/spec under `apps/backend/src/modules/inventory/`

Actions:

- When booking completion finalizes earned rental revenue, allocate each requirement's authoritative integer-minor-unit revenue across its final handed-out assignments.
- Split evenly and place any remainder in stable assignment order.
- Give substituted or released-before-handout items no allocation.
- Append signed adjustment rows for refunds or later financial corrections; never rewrite the original allocation.
- Make completion and correction idempotent.
- Aggregate physical-item, SKU, and product acquisition cost, rental revenue, completed service cost, recorded adjustments, and recovery status.
- Report missing acquisition/cost inputs explicitly instead of treating missing values as zero-profit success.
- Remove analytics reads of product purchase price and target rental count.

### Task B8: Regenerate shared/client contracts and restore compilation

Primary files:

- `apps/frontend/src/lib/api/products.ts`
- `apps/frontend/src/lib/api/inventory.ts`
- `apps/frontend/src/lib/api/inventory-operations.ts`
- `apps/frontend/src/lib/api/bookings.ts`
- `apps/frontend/src/lib/api/fulfillment.ts`
- `apps/frontend/src/lib/api/guest-products.ts`
- `apps/frontend/src/lib/api/analytics.ts`
- `packages/types/src/**`

Actions:

- Remove pool, tracking-mode, product purchase, and target-rental fields from types.
- Rename acquisition fields consistently.
- Add exact-item transfer/count, metadata-correction, profitability, and registration types.
- Remove configuration endpoints that no longer exist.
- Update frontend consumers minimally as needed to compile; full workflow completion belongs to later checkpoints.

### Task B9: Checkpoint verification and commit

Verification:

- `npm run db:validate`
- `npm run db:generate`
- Focused product, inventory availability/reservation/assignment/transfer/fulfilment, booking, and revenue tests changed in this checkpoint.
- `npm run build:types`
- `npm run build:backend`
- Frontend TypeScript/build only after all removed contract consumers have been mechanically updated.
- Migrate and seed a disposable empty PostgreSQL database; do not reset the active development database.
- `git diff --check`

Commit the clean schema/backend cutover only after generated types and all owned consumers agree.

## Checkpoint C — Complete catalog creation and editing

### Task C1: Rebuild the five-stage product form

Primary files:

- `apps/frontend/src/app/(owner)/dashboard/products/components/product-form/index.tsx`
- `apps/frontend/src/app/(owner)/dashboard/products/components/product-form/schema.ts`
- `apps/frontend/src/app/(owner)/dashboard/products/components/product-form/wizard-layout.tsx`
- `apps/frontend/src/app/(owner)/dashboard/products/components/product-form/steps/basic-info.tsx`
- `apps/frontend/src/app/(owner)/dashboard/products/components/product-form/steps/variants.tsx`
- `apps/frontend/src/app/(owner)/dashboard/products/components/product-form/steps/content-media.tsx`
- `apps/frontend/src/app/(owner)/dashboard/products/components/product-form/steps/pricing-services.tsx`
- `apps/frontend/src/app/(owner)/dashboard/products/components/product-form/steps/review.tsx`
- delete `apps/frontend/src/app/(owner)/dashboard/products/components/product-form/steps/opening-inventory.tsx`

Actions:

- Implement the approved stages: Basics; Variants/SKUs/Media; Content; Pricing/Services; Review/Publish.
- Move product and variant image management into stage 2.
- Keep description/details/FAQs in stage 3 without duplicating media state.
- Remove inventory, tracking, purchase, public purchase price, target rentals, and first-stage status controls.
- Add country of origin and separately named reference retail value controls.
- Keep one resumable server draft and section-level revision/idempotency behavior.
- Update step error mapping, local recovery state, review summary, section readiness, and keyboard save behavior.

### Task C2: Add the completion workflow

Create:

- `apps/frontend/src/app/(owner)/dashboard/products/[id]/setup-complete/page.tsx`

Actions:

- Route successful create/publish to the dedicated completion page.
- Offer Add physical items now, View product, Create another product, and Go to catalog.
- Send product scope to `/dashboard/inventory/items/register` through validated URL state.
- Distinguish saved-draft completion from published completion without inventing inventory readiness.

### Task C3: Complete safe editing

Primary files:

- `apps/frontend/src/app/(owner)/dashboard/products/[id]/edit/page.tsx`
- `apps/frontend/src/app/(owner)/dashboard/products/components/product-form/edit-product-form.tsx`
- `apps/frontend/src/app/(owner)/dashboard/products/components/product-form/tabbed-edit-layout.tsx`
- `apps/frontend/src/app/(owner)/dashboard/products/hooks/use-edit-product.ts`
- `apps/frontend/src/app/(owner)/dashboard/products/hooks/use-update-product.ts`
- `apps/frontend/src/app/(owner)/dashboard/products/[id]/page.tsx`
- product list/trash components and hooks under `apps/frontend/src/app/(owner)/dashboard/products/`

Actions:

- Reuse the same section components for creation and editing.
- Surface stale revision and protected-history conflicts with reload/reapply guidance.
- Add variant/SKU/media creation to eligible published products.
- Deactivate historical SKUs instead of deleting/restructuring them.
- Make product inventory entry points links to filtered Inventory and canonical registration.
- Remove target progress and product purchase info from detail/list screens.
- Replace them with authoritative item-backed profitability summaries when data exists.
- Remove tracking filters/badges from Catalog.

### Task C4: Catalog tests and checkpoint commit

Focused verification:

- Product onboarding integration test for five sections and zero-stock publication.
- Product/variant unit tests for safe edit, delete, archive, and history conflicts.
- Frontend type/build check after the complete form is connected.
- No browser/visual verification.
- `git diff --check`.

Commit Catalog lifecycle as one coherent slice.

## Checkpoint D — Canonical physical-item registration and correction

### Task D1: Complete the canonical backend command

Primary files:

- `apps/backend/src/modules/inventory/inventory-management.service.ts`
- `apps/backend/src/modules/inventory/inventory.controller.ts`
- `apps/backend/src/modules/inventory/dto/inventory.dto.ts`
- `apps/backend/src/modules/inventory/__tests__/inventory-batch-registration.service.spec.ts`
- `apps/backend/test/inventory-control.integration-spec.ts`

Actions:

- Keep one atomic batch endpoint as the only registration command.
- Support single and batch rows through the same payload.
- Support supplied/generated asset identities, optional barcode, shared defaults, and per-row acquisition/condition/reference overrides.
- Initialize required component states for every row.
- Validate the entire batch before writes and return row/field errors.
- Preserve request fingerprint/idempotency replay behavior.
- Return registered item summaries and audit/movement references.
- Remove or make private any redundant single-item create endpoint.
- Add audited acquisition/identity/valuation correction endpoint requiring reason and conflict version.

### Task D2: Build the canonical route

Create:

- `apps/frontend/src/app/(owner)/dashboard/inventory/items/register/page.tsx`
- `apps/frontend/src/app/(owner)/dashboard/inventory/items/register/registration-form.tsx`
- `apps/frontend/src/app/(owner)/dashboard/inventory/items/register/schema.ts`
- `apps/frontend/src/app/(owner)/dashboard/inventory/items/register/use-registration.ts`

Remove:

- `apps/frontend/src/app/(owner)/dashboard/inventory/components/register-item-dialog.tsx`

Actions:

- Resolve optional product/SKU/origin scope from validated URL parameters.
- Implement SKU search, active storage location selection, single/batch modes, identity generation/preview, barcode input, acquisition defaults, per-row overrides, component initialization, review, and atomic submit.
- Preserve entered rows after correctable errors and display exact row/field messages.
- On success offer the approved same-SKU, other-SKU, view-items, and return actions.
- Ensure mobile layouts can review large batches without horizontal-only interaction.

### Task D3: Point every entry to the canonical route

Primary files:

- product setup completion page;
- `apps/frontend/src/app/(owner)/dashboard/products/[id]/inventory/page.tsx`
- `apps/frontend/src/app/(owner)/dashboard/inventory/items/page.tsx`
- `apps/frontend/src/app/(owner)/dashboard/inventory/stock/page.tsx`
- related inventory navigation/components.

Actions:

- Replace dialogs and embedded forms with scoped links to the canonical route.
- Preserve origin/return context safely.
- Ensure all success invalidations cover items, SKU aggregates, overview, product detail, and profitability queries.

### Task D4: Checkpoint verification and commit

- Focused batch registration and correction tests.
- PostgreSQL integration cases for duplicate identities, rollback, retry, per-row override, components, and tenant scope.
- Frontend build/type check.
- No browser/visual verification.
- Commit canonical registration.

## Checkpoint E — Serialized Inventory workspace completion

### Task E1: Overview and Stock by SKU

Primary files:

- `apps/backend/src/modules/inventory/inventory-dashboard.service.ts`
- `apps/backend/src/modules/inventory/inventory-foundation.controller.ts`
- `apps/frontend/src/app/(owner)/dashboard/inventory/page.tsx`
- `apps/frontend/src/app/(owner)/dashboard/inventory/stock/page.tsx`
- `apps/frontend/src/app/(owner)/dashboard/inventory/hooks/use-inventory-stock-query.ts`

Actions:

- Return only physical-item-derived counts and attention totals.
- Remove tracking filters and badges.
- Show registered, on hand, available, reserved, assigned, out, unavailable, incoming, location distribution, and shortage/pressure.
- Link every aggregate to canonical filtered item/queue views.
- Keep Register physical items as the stock-creation action; expose no quantity edit.

### Task E2: Physical Items and item detail

Primary files:

- `apps/frontend/src/app/(owner)/dashboard/inventory/items/page.tsx`
- `apps/frontend/src/app/(owner)/dashboard/inventory/hooks/use-inventory-items-query.ts`
- `apps/frontend/src/app/(owner)/dashboard/products/[id]/inventory/[stockUnitId]/page.tsx`
- `apps/frontend/src/lib/api/inventory-operations.ts`

Actions:

- Surface acquisition fields, condition, lifecycle, components, booking context, service/issues, profitability, and next actions.
- Add audited metadata correction without allowing direct operational-state or location edits.
- Route location through transfers and condition through inspection/authorized correction.
- Preserve bounded histories and links to source records.

### Task E3: Exact-item locations, transfers, and counts

Primary files:

- `apps/frontend/src/app/(owner)/dashboard/inventory/locations/page.tsx`
- `apps/frontend/src/app/(owner)/dashboard/inventory/transfers/page.tsx`
- `apps/frontend/src/app/(owner)/dashboard/inventory/counts/page.tsx`
- `apps/frontend/src/lib/api/inventory.ts`

Actions:

- Show location counts by physical-item state only.
- Make transfer creation select exact eligible item identities.
- Render line summaries from transfer-unit outcomes.
- Build stock counts around scan/select identity reconciliation: expected, observed, missing, unexpected, duplicate, and wrong-location.
- Apply corrections/investigations as item-specific audited commands.

### Task E4: Availability controls and movements

Primary files:

- `apps/frontend/src/app/(owner)/dashboard/inventory/availability/page.tsx`
- `apps/frontend/src/app/(owner)/dashboard/inventory/movements/page.tsx`
- `apps/frontend/src/app/(owner)/dashboard/inventory/components/inventory-ledger-table.tsx`
- backend block/ledger controllers and DTOs.

Actions:

- Remove pool target and quantity controls.
- Support product, variant, SKU, item, and location date blocks with preview.
- Show item-specific movements with origin/destination and source workflow.
- Remove pooled movement labels and pool location fallbacks.

### Task E5: Product-scoped inventory and operations queues

Primary files:

- `apps/frontend/src/app/(owner)/dashboard/products/[id]/inventory/page.tsx`
- `apps/frontend/src/app/(owner)/dashboard/inventory/inspections/page.tsx`
- `apps/frontend/src/app/(owner)/dashboard/inventory/service/page.tsx`
- associated backend dashboard/operations services.

Actions:

- Make product inventory a filtered projection and navigation surface, not a second management implementation.
- Remove pooled cards, receive/adjust/count dialogs, and tracking configuration.
- Preserve physical-item policy, components, inspections, issues, service, lifecycle, and availability behavior.
- Ensure every overview/queue action reaches the exact item record.

### Task E6: Checkpoint verification and commit

- Focused inventory dashboard, block, movement, count, transfer, location, inspection, and service tests.
- Backend/frontend build at checkpoint boundary.
- No browser/visual verification.
- Commit serialized Inventory workspace.

## Checkpoint F — Booking, storefront, fulfilment, and profitability UI

### Task F1: Storefront availability contracts

Primary files:

- `apps/frontend/src/lib/api/guest-products.ts`
- guest product list/detail/cart components under `apps/frontend/src/app/(guest)/products/`
- backend product search/availability/storefront cart services.

Actions:

- Remove tracking mode and internal item-selection fields from public responses.
- Keep customer selection at product/SKU/quantity/date/location level.
- Display zero-stock published products as unavailable without exposing internal identities or acquisition data.
- Keep authoritative date/location availability and policy messages.

### Task F2: Owner booking and fulfilment UI

Primary files:

- `apps/frontend/src/app/(owner)/dashboard/bookings/[id]/components/inventory-assignments.tsx`
- `apps/frontend/src/app/(owner)/dashboard/bookings/[id]/components/order-actions.tsx`
- `apps/frontend/src/app/(owner)/dashboard/bookings/[id]/page.tsx`
- `apps/frontend/src/app/(owner)/dashboard/bookings/new/components/manual-booking-form.tsx`
- `apps/frontend/src/lib/api/bookings.ts`
- `apps/frontend/src/lib/api/fulfillment.ts`

Actions:

- Remove pooled/serialized conditional rendering.
- Require and explain exact physical-item assignment for every requirement.
- Preserve quantity reservations until preparation.
- Update assignment, substitution, handout, return, inspection intake, loss, cancellation, and completion states.
- Keep correctable availability/price conflicts without clearing the manual booking form.
- Ensure public/customer data never includes asset code or private acquisition/profitability information.

### Task F3: Investment recovery and profitability UI

Primary files:

- `apps/backend/src/modules/analytics/analytics.service.ts`
- `apps/frontend/src/lib/api/analytics.ts`
- `apps/frontend/src/app/(owner)/dashboard/products/[id]/page.tsx`
- `apps/frontend/src/app/(owner)/dashboard/analytics/**`
- inventory item detail/overview surfaces.

Actions:

- Replace target-rental progress with money-based acquisition recovery and net contribution.
- Show per-item detail and aggregated SKU/product reporting.
- Distinguish acquisition cost, attributed rental revenue, recorded service cost, signed financial adjustments, and current value.
- Mark incomplete inputs clearly and avoid false 100% recovery.
- Keep analytics queries bounded and rebuildable from authoritative records.

### Task F4: Checkpoint verification and commit

- Focused booking/storefront availability/fulfilment tests.
- Revenue-allocation and profitability aggregation tests.
- Backend/frontend builds at checkpoint boundary.
- No browser/visual verification.
- Commit booking and profitability completion.

## Checkpoint G — Accessible contextual help

### Task G1: Replace the help primitive

Primary files:

- replace `apps/frontend/src/components/shared/field-tip.tsx`
- create `apps/frontend/src/components/shared/context-help.tsx`
- create `apps/frontend/src/lib/help/types.ts`
- create `apps/frontend/src/lib/help/content.ts`

Actions:

- Implement a focusable, named trigger using popover behavior suitable for mouse, keyboard, and touch.
- Associate help content with its related field/action through accessible descriptions.
- Support Escape/outside dismissal, mobile sizing/scrolling, and non-hover interaction.
- Support structured title, meaning, why/when, fashion-rental example, default/effect, and optional related link.
- Keep essential instructions and warnings visible outside the popover.
- Keep validation messages separate from explanatory help.

### Task G2: Add typed domain help content

Add stable keys and reviewed content for:

- Catalog basics, category/type/size system, origin, and reference retail value;
- variants, SKU identity, colors, sizes, media, featured images, and alt text;
- rate plans, deposits, fees, delivery, late policy, and services;
- asset codes, barcodes, acquisition date/cost/source/reference, condition, valuation, and components;
- physical-item states, locations, blocks, transfers, counts, inspections, issues, service, loss, and retirement;
- availability buffers, reservation quantity, assignment, substitution, preparation, handout, return, and cancellation;
- investment recovery and incomplete-cost reporting.

Every entry follows the approved what/why/example/effect structure. Do not create redundant help for obvious labels.

### Task G3: Apply scoped coverage

Primary surface groups:

- Product creation, review, completion, edit, detail, composition, and pricing.
- Inventory Overview, Stock by SKU, registration, Physical Items, item detail, locations, transfers, counts, availability, movements, inspections, and service.
- Booking availability, assignment, fulfilment, return, loss, and relevant manual-booking fields.

Actions:

- Add visible guidance for prerequisites, irreversible consequences, and blocked actions.
- Add contextual help for non-obvious fields and calculations.
- Remove obsolete help text for pooled stock, product purchase cost, public purchase price, and target rentals.
- Ensure disabled controls expose their reason and next step.

### Task G4: Accessibility tests and checkpoint commit

- The frontend currently has no dedicated component-test runner. Add the smallest maintainable Vitest/JSDOM/Testing Library setup (including `apps/frontend/package.json` and scoped config/setup files) needed for these interaction tests; do not introduce a broad end-to-end framework.
- Add component tests for focus, accessible name/description, open/dismiss via keyboard and touch-equivalent click, Escape, and content rendering.
- Run focused frontend checks/build.
- Do not run browser/visual tests.
- Commit contextual help.

## Checkpoint H — Documentation, removal audit, and clean-database cutover

### Task H1: Update authoritative documentation

Primary files:

- `docs/flows/owner-add-product-flow.md`
- `docs/ui/owner/add-product.md`
- `docs/ui/owner/edit-product.md`
- `docs/features/stock-inventory.md`
- `docs/features/availability-engine.md`
- `docs/features/booking-system.md`
- `docs/api/product.md`
- `docs/api/inventory.md`
- `docs/api/booking.md`
- `docs/database/product.md`
- `docs/database/seed-data.md`
- `docs/glossary.md`
- `docs/product-rental-domain-completeness-matrix.md`

Actions:

- Rewrite current documentation around product -> variant -> SKU -> physical item.
- Delete `docs/features/target-tracking.md` rather than retaining an obsolete feature contract.
- Delete or clearly supersede obsolete pooled/hybrid plans/specs that would otherwise mislead future implementation; Git history remains the historical record.
- Ensure public/internal acquisition and reference-value terms are unambiguous.
- Document the canonical registration route and product-edit protections.
- Update API examples to serialized-only responses.

### Task H2: Run the final removal audit

Search schema, source, tests, seed, and current documentation for:

- `POOLED`;
- `InventoryPool` / `inventoryPool`;
- `pooledQuantity`;
- inventory `trackingMode`;
- product `purchaseDate`, `purchasePrice`, and `purchasePricePublic`;
- `targetRentals` and Target Rentals UI/copy;
- old opening-inventory routes/components;
- preferred/customer-selected physical-item contracts.

Allowed matches are limited to the approved design/implementation documents where the removed terms are named as removal criteria. Remove all live-code, generated-type, seed, API, UI, test, and authoritative-doc matches.

Update `docs/serialized-inventory-cutover-checklist.md` so every row is closed with evidence.

### Task H3: Final database and application verification

Use a disposable empty PostgreSQL database first:

- `npm run db:validate`
- `npm run db:generate`
- deploy the single baseline migration;
- run the deterministic seed twice and verify logical repeatability;
- run focused schema/seed smoke queries for physical items, locations, SKUs, reservations, transfers, and revenue allocations.

Then run the final code gates:

- `npm run build:types`
- `npm run build:backend`
- `npm run test --workspace=apps/backend -- --runInBand`
- `npm run test:integration`
- `npm run build:frontend`
- `git diff --check`

Do not run browser or visual verification.

Only after the clean database, seed, tests, and builds pass:

- reset/recreate the local development database through the approved project database workflow;
- apply the clean baseline;
- seed it;
- run targeted API smoke checks for product creation/publication, physical-item registration, availability, reservation/assignment, transfer, and item lifecycle.

### Task H4: Final acceptance and commit

Confirm all acceptance workflows from the design:

1. Publish a zero-stock listing and register its physical items from setup completion.
2. Edit a published listing without mutating booking/pricing snapshots.
3. Add eligible variants/SKUs/media safely.
4. Reach one canonical registration workflow from global/product/SKU origins.
5. Prevent unintended over-reservation and overlapping exact assignments under concurrency.
6. Transfer, rent, return, inspect, service, lose/recover, and retire exact items with history.
7. Reconcile stock counts by identity.
8. Derive all SKU/product stock from physical items.
9. Report item-backed profitability and incomplete inputs honestly.
10. Provide accessible contextual help and blocked-action explanations.
11. Leave no live pooled, product-purchase, or target-rental contract.

Commit final documentation, removal audit, verification evidence, and any final scoped fixes without staging protected customer-page changes.

## Expected commit sequence

1. `docs: map serialized inventory cutover`
2. `refactor: replace hybrid inventory with physical items`
3. `feat: rebuild product creation and editing lifecycle`
4. `feat: unify physical item registration`
5. `feat: complete serialized inventory workspaces`
6. `feat: align bookings and profitability with physical items`
7. `feat: add accessible contextual help`
8. `docs: complete serialized inventory cutover`

Commit boundaries may be split further when a checkpoint contains independently complete backend/frontend slices, but no commit may knowingly leave the repository uncompilable or reintroduce a duplicate compatibility contract.
