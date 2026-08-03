# Complete Rental Inventory Domain Implementation Plan

**Date:** 2026-08-03

**Source specification:** `docs/superpowers/specs/2026-08-03-complete-rental-inventory-domain-design.md`

**Strategy:** Deliver additive, deployable phases on top of the committed hybrid inventory foundation. Each phase adds schema, migration, backend domain services, owner APIs, frontend workflows, and focused tests before the next phase begins.

## Guardrails

- Preserve unrelated working-tree changes and legacy booking history.
- Keep `VariantSize` as the rentable SKU.
- Keep customer booking lines separate from inventory fulfilment requirements.
- Use tenant-scoped queries and explicit safe public projections.
- Use serializable transactions, deterministic lock order, database constraints, and idempotent lifecycle commands.
- Do not remove compatibility columns until all readers and backfills are verified.
- Use code-level verification; do not open a browser unless explicitly requested.

## Phase 1: Physical-item lifecycle and operations

### 1.1 Schema and migration

- Extend physical-unit condition grades and split durable disposition from operational state.
- Add lifecycle event, inspection, inspection check, unit issue, service order, set-component definition/state, and media-attachment tables.
- Add idempotency, tenant, booking/assignment context, status, date, and query-path indexes.
- Add constraints for completed inspection immutability, valid costs/quantities, and unique active service control where PostgreSQL can enforce it.
- Backfill current stock-unit statuses without deleting the legacy status column.
- Register all new tenant-owned models with tenant-isolation diagnostics.

### 1.2 Backend domain services

- Add a guarded stock-unit lifecycle state machine.
- Add inspection create/complete/amend flows and checklist results.
- Add structured issue creation/resolution and availability-blocking rules.
- Add cleaning, washing, repair, preparation, alteration, and maintenance service orders.
- Create and resolve service-owned unit blocks transactionally.
- Integrate exact unit/assignment references with the existing damage-report workflow.
- Return lifecycle, inspection, issue, service, and checklist history in inventory detail APIs.

### 1.3 Owner interface

- Add lifecycle actions and current-state summaries to the product inventory workspace.
- Add inspection submission, issue reporting, service-order creation/completion, and history panels.
- Add pre-rental/return inspection entry points from serialized booking assignments.
- Reuse existing shadcn components and API conventions.

### 1.4 Tests

- Unit-test the transition matrix, idempotency, inspection decisions, issue blocking, and service-block lifecycle.
- Integration-test tenant isolation and transactional service completion.
- Compile backend and frontend and validate Prisma/migration SQL.

## Phase 2: Fulfilment requirements and product composition

### 2.1 Schema and compatibility

- Add fulfilment requirements, requirement versions/substitutions, product composition rules, alternatives, and customer-selection snapshots.
- Move reservation ownership from unique booking-item identity to one reservation per fulfilment requirement.
- Backfill one `MAIN` requirement for every booking item and reconnect current reservations.
- Preserve existing booking-item snapshot and pricing fields.

### 2.2 Composition domain

- Implement required components, optional add-ons, fixed/customer/parent/staff SKU resolution, quantity, and compatibility rules.
- Prevent direct and transitive composition cycles and enforce maximum expansion depth.
- Expand quotes into flat immutable requirement proposals.
- Atomically reserve every bundle requirement with deterministic SKU locking.
- Implement versioned substitution, cancellation, modification, partial handover, partial return, loss, and overdue handling.

### 2.3 Owner and storefront interfaces

- Add bundle composition management to product editing.
- Add inseparable set checklist configuration per SKU.
- Add optional add-on and component selection to product detail/cart/checkout.
- Present bundle fulfilment and component assignment on booking detail.

### 2.4 Tests

- Test cycle prevention, expansion, alternatives, immutable snapshots, bundle atomicity, modification rollback, and partial-return completeness.

## Phase 3: Locations, pools, transfers, and policies

### 3.1 Schema and migration

- Add tenant inventory locations, location capabilities, location inventory pools, quantity-aware capacity blocks, transfers, and transfer lines.
- Add availability policies and override scopes.
- Create one default location per tenant, one pool per pooled SKU, and default-location assignments for serialized units.
- Preserve `locationLabel` as migration metadata until owner reconciliation.

### 3.2 Domain logic

- Resolve independent availability-policy fields from tenant through SKU scope.
- Snapshot policies on fulfilment requirements and store effective reservation ranges.
- Calculate pooled and serialized availability per source location.
- Implement pooled/serialized transfer request, approval, dispatch, receipt, cancellation, reconciliation, and damage-on-receipt handling.
- Implement bundle source planning, with single-location fulfilment by default and validated transfer plans when enabled.

### 3.3 Interfaces and tests

- Add location, pool, adjustment, policy, and transfer management screens.
- Add location selection and safe location availability to booking flows.
- Test pool constraints, transfer reconciliation, policy inheritance, cross-location lead time, and migration counts.

## Phase 4: Visibility, assignment, and inventory-sensitive pricing

### 4.1 Policy and pricing model

- Add tenant/product visibility policies, assignment policies/versions, item price adjustments, quote snapshots, and preferred-price requests.
- Support internal-only, condition-summary, and sanitized unit-detail visibility.
- Support manual deferred, automatic deferred, automatic-at-booking, and customer-selected assignment.
- Add deposit adjustments separately from rental revenue.

### 4.2 Assignment and quoting

- Implement hard eligibility filters before scoring.
- Implement balanced rotation, least used, best condition, lowest price, oldest inventory, and versioned weighted scoring.
- Persist candidate/score explanations and staff override reasons.
- Assign under the booking transaction whenever item selection affects price or disclosure.
- Add expiring preferred-price approval and optional hold behavior.

### 4.3 Interfaces and tests

- Add policy editors and sanitized storefront tier/unit selection.
- Add assignment recommendation and override UX.
- Test privacy projections, deterministic scoring, stale quotes, changed condition disclosure, and price/deposit snapshots.

## Phase 5: Analytics, valuation, and operational reporting

### 5.1 Facts and projections

- Add revenue allocations, valuation/depreciation policies, maintenance reminder policies, and rebuildable inventory metric projections.
- Derive serialized-unit rental count/days, revenue, utilization, condition trend, downtime, service cost, damage recovery, and profitability.
- Derive pooled metrics only at SKU/location level.
- Implement explicit bundle allocation and deterministic rounding.

### 5.2 Valuation and decisions

- Implement manual, straight-line, declining-balance, usage-based, and condition-adjusted operational estimates.
- Implement service, price-change, quarantine, and retirement recommendations without automatic retirement.
- Add reports by tenant, location, category, product, SKU, bundle, and physical unit.

### 5.3 Tests

- Test projection rebuilds, allocation totals, formulas, recommendation boundaries, authorization, and historical stability.

## Final verification and handoff

- Run Prisma format, validate, generate, and migration deployment against local PostgreSQL.
- Run focused unit/integration suites for every new domain.
- Run backend build and frontend TypeScript checks.
- Run repository-level checks and classify unrelated pre-existing failures separately.
- Run all backfills in dry-run mode, inspect summaries, then apply only against the local development database.
- Confirm no unrelated user files were staged.
- Commit each coherent phase independently.
