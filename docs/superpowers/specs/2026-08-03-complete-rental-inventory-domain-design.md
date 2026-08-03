# Complete Rental Inventory Domain Design

**Status:** Approved architecture; written specification pending final user review

**Date:** 2026-08-03

**Scope:** Physical-item lifecycle, inspections, service work, product composition, add-ons, locations, advanced assignment and pricing, and inventory analytics

**Builds on:** `2026-08-03-hybrid-inventory-design.md`

## 1. Purpose

The hybrid inventory foundation establishes `VariantSize` as the rentable SKU and supports pooled quantities, serialized `StockUnit` records, date-bound reservations, maintenance blocks, and deferred physical-unit assignment. This specification completes the rental inventory domain around that foundation.

The completed system must work for garments, sarees, sherwanis, shoes, jewelry, bags, hair accessories, low-cost pooled accessories, inseparable sets, assembled outfits, and larger rental packages. It must preserve a simple customer-facing product catalog while giving the business exact operational control over the inventory it hands to a customer.

The central rule is:

> A product describes what the customer rents; fulfilment requirements and physical inventory describe what the business must provide.

The referenced paper is treated as domain input, not as an implementation specification. In particular, this design separates future reservations from present operational state, separates valuation from availability, and distinguishes inseparable sets from bundles assembled from independently rentable inventory.

## 2. Goals

- Preserve a clean `Product -> ProductVariant -> VariantSize` customer catalog.
- Support pooled and serialized inventory in every fashion category.
- Track the complete lifecycle of each serialized physical unit.
- Prevent returned, incomplete, uninspected, dirty, damaged, or misplaced units from becoming rentable.
- Support inseparable sets, assembled bundles, optional add-ons, alternatives, and substitutions.
- Make booking availability atomic across every required bundle component.
- Support single-location tenants by default and multi-location tenants without redesign.
- Support separate preparation, return, inspection, cleaning, delivery, and transfer buffers.
- Offer tenant-configurable public condition visibility and physical-item selection.
- Support deterministic manual or automatic physical-item assignment.
- Preserve exact inspection, service, damage, movement, pricing, revenue, and valuation history.
- Integrate with the existing pricing, deposit, damage-report, booking, storage, audit, and notification modules.
- Migrate existing inventory and booking history additively and without speculative identity matching.

## 3. Delivery strategy

This domain is too large and interdependent for a safe big-bang patch. It will be delivered through coordinated phases against one master model:

1. Physical-item lifecycle, inspection, issues, and service work.
2. Fulfilment requirements, inseparable sets, assembled bundles, and add-ons.
3. Location-aware pools, transfers, and hierarchical availability policies.
4. Customer visibility, item-level pricing, and assignment strategies.
5. Utilization, operational valuation, depreciation, and profitability analytics.

Every phase must leave the application deployable. Schema changes are additive first; deprecated fields are removed only in a later compatibility cleanup.

## 4. Domain boundaries

### 4.1 Catalog

The catalog describes the customer-visible offering:

- `Product`: the public style or package.
- `ProductVariant`: the color or visual edition.
- `VariantSize`: the SKU and smallest normal customer-selectable inventory pool.

Catalog labels are merchandising data. Inventory identity always uses IDs.

### 4.2 Commercial booking

`BookingItem` remains the immutable customer-facing line: what was selected, how it was described, and how it was priced. A line may represent a simple SKU, an assembled bundle, or an optional add-on.

### 4.3 Fulfilment

A new `FulfillmentRequirement` represents each inventory obligation created by a booking line. A simple product creates one main requirement. A bundle creates one requirement per independently managed component. Each requirement has its own quantity, source location, dates, policy snapshot, reservation, assignment history, return state, and revenue allocation.

This separation removes the current one-booking-item/one-reservation limitation without making bundle components appear as unrelated customer purchases.

### 4.4 Physical inventory

- Pooled inventory represents interchangeable low-value pieces by SKU and location quantity.
- Serialized inventory represents identifiable `StockUnit` records.
- An inseparable set is one stock unit with a contents checklist.
- An assembled bundle is several fulfilment requirements backed by independently managed SKUs or units.

### 4.5 Model ownership summary

| Concern | Authoritative records |
|---|---|
| Customer offering | `Product`, `ProductVariant`, `VariantSize`, pricing plans |
| Bundle definition | `ProductCompositionRule` and its selection/alternative rules |
| Customer purchase snapshot | `BookingItem` |
| Inventory obligations | `FulfillmentRequirement` and its version/substitution history |
| Date capacity claim | `InventoryReservation` |
| Pooled stock | `InventoryPool`, quantity blocks, and inventory movements |
| Serialized stock | `StockUnit`, unit blocks, and lifecycle projection |
| Exact unit fulfilment | `StockUnitAssignment` |
| Inseparable contents | `SkuSetComponentDefinition`, `StockUnitComponentState`, inspection checks |
| Return quality | `UnitInspection`, `UnitIssue`, and approved media |
| Cleaning and repair | `InventoryServiceOrder` |
| Physical location | `InventoryLocation`, `InventoryTransfer`, and movement history |
| Availability rules | `AvailabilityPolicy` and requirement snapshots |
| Public item behavior | visibility, assignment, and pricing-policy versions |
| Historical performance | immutable facts plus rebuildable analytics projections |

## 5. Core invariants

1. Every inventory relationship is tenant-owned and tenant-validated.
2. Every fulfilment requirement references exactly one valid SKU.
3. A SKU uses either pooled or serialized capacity, never both at once.
4. Pooled quantity is stored per SKU and inventory location.
5. Serialized capacity is derived from eligible units for the requested range and location.
6. A future reservation does not change a unit's present operational state.
7. A serialized unit cannot have overlapping active assignments.
8. A pooled location pool cannot be reserved above its effective quantity.
9. Every required bundle component is reserved atomically or none is reserved.
10. Bundle definitions are snapshotted into fulfilment requirements at booking time.
11. Product edits never rewrite historical booking composition.
12. An item awaiting inspection, cleaning, washing, repair, or transfer is not presently rentable.
13. Open service work and unresolved blocking issues reduce availability.
14. An incomplete inseparable set is unavailable.
15. Assignment does not create capacity; it only fulfils a reservation.
16. If a unit affects the customer price, it is assigned inside the booking transaction.
17. Existing commitments retain the availability-policy and price snapshots used when booked.
18. Current state may be updated, but lifecycle, inspection, service, assignment, movement, and pricing history is append-only.
19. Retirement, loss, and quarantine preserve history and prevent new reservations.
20. Operational valuation is never presented as an accounting ledger.

## 6. Physical-item lifecycle

### 6.1 Separate state dimensions

The paper's proposed status list mixes four different concepts. The system keeps them separate:

- **Asset disposition:** `ACTIVE`, `QUARANTINED`, `LOST`, or `RETIRED`.
- **Operational state:** `AVAILABLE`, `PREPARING`, `READY`, `OUT_FOR_RENTAL`, `AWAITING_INSPECTION`, `CLEANING`, `WASHING`, `REPAIRING`, or `IN_TRANSFER`.
- **Condition grade:** `NEW`, `EXCELLENT`, `GOOD`, `FAIR`, `POOR`, or `DAMAGED`.
- **Date commitments:** reservations, assignments, transfers, and blocks.

`DEPRECIATED` is a valuation outcome, not an availability state. `RESERVED` and `CONFIRMED` are reservation states, not present physical states.

### 6.2 State transitions

The normal operational flow is:

`AVAILABLE -> PREPARING -> READY -> OUT_FOR_RENTAL -> AWAITING_INSPECTION`

Inspection may move the unit to:

- `AVAILABLE` when no work is required;
- `CLEANING` or `WASHING`;
- `REPAIRING`;
- quarantine for investigation;
- lost; or
- retired through an authorized retirement decision.

Cleaning, washing, and repair normally return to `AWAITING_INSPECTION` for a service-completion check before `AVAILABLE`. A tenant may configure low-risk cleaning to complete directly to `AVAILABLE`, but the transition and actor are still recorded.

Future assignment alone does not change operational state. `PREPARING` starts only when staff begins fulfilment for the active preparation window.

### 6.3 Lifecycle events

`StockUnitLifecycleEvent` is immutable and records:

- unit, tenant, from/to disposition and operational state;
- booking, fulfilment requirement, assignment, inspection, service order, or transfer context;
- actor, reason, timestamp, and structured metadata;
- an idempotency key for command retries.

The current projection remains on `StockUnit` for efficient querying. Only lifecycle services may change it.

## 7. Inspections, issues, photos, and completeness

### 7.1 Inspections

`UnitInspection` supports `PRE_RENTAL`, `RETURN`, `PERIODIC`, and `SERVICE_COMPLETION` inspections. It records the exact stock unit and, where applicable, booking assignment; condition before and after; inspector; timestamps; notes; recommended action; customer-liability recommendation; and completion state.

Inspection submission is transactional. A completed inspection cannot be silently edited. Corrections create an amendment linked to the original inspection.

### 7.2 Inspection checks and issues

Structured `InspectionCheck` results preserve checklist answers. `UnitIssue` represents stains, tears, scratches, missing pieces, missing accessories, broken fasteners, color fading, hygiene problems, authenticity concerns, or other configurable issue types.

An issue records severity, description, discovered inspection, responsibility, estimated cost, customer charge, resolution state, and service/retirement outcome. Severity and tenant policy determine whether it is informational or availability-blocking.

The existing booking-level `DamageReport` remains compatible. New damage reports reference the exact inspection, fulfilment requirement, assignment, and unit. Deposit deductions and additional charges continue through the existing financial workflow and are never performed implicitly by inventory code.

### 7.3 Media

Inspection, issue, unit, and service-order photos use the existing object-storage pipeline. `InventoryMediaAttachment` stores object reference, purpose, public-visibility approval, uploader, checksum/metadata, and capture time. Public APIs return only explicitly approved media.

### 7.4 Inseparable-set checklist

`SkuSetComponentDefinition` describes contents that are not independently rentable, such as left/right shoes or a necklace set's earrings. It records name, required quantity, inspection guidance, and whether absence blocks rental.

`StockUnitComponentState` stores the current presence and condition for each unit. Inspection results record historical checks. Missing required contents automatically quarantine or block the entire stock unit until resolved.

## 8. Cleaning, washing, repair, and maintenance

`InventoryServiceOrder` represents `PREPARATION`, `CLEANING`, `WASHING`, `REPAIR`, `ALTERATION`, or general `MAINTENANCE` work. It records unit, issue/inspection source, internal or external provider, location, requested/start/expected/completed dates, cost, notes, attachments, status, and completion outcome.

Service states are `REQUESTED`, `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, and `FAILED`. An open blocking order creates or owns the corresponding unit-capacity block. Completing or cancelling the order resolves that block idempotently.

Only one mutually exclusive blocking operational workflow may control a unit at a time. Additional related service tasks may exist, but they must belong to the controlling order or remain non-blocking. This prevents simultaneous cleaning and out-for-rental states.

Maintenance policies can create reminders from elapsed time, rental count, rental days, inspection outcomes, or condition decline. A reminder is not a state change; authorized staff must start service, quarantine, or retire the unit.

## 9. Product composition, bundles, and add-ons

### 9.1 Inseparable set versus assembled bundle

- Use an inseparable set when sub-pieces are never independently reserved. It is one `StockUnit` with a checklist.
- Use an assembled bundle when components have their own inventory identity or can be rented separately. It expands into multiple fulfilment requirements.

The system does not create parent stock units that hide independently rentable child units. That would allow double-reservation of a child both directly and through the parent.

### 9.2 Composition rules

`ProductCompositionRule` belongs to a parent product offering and defines:

- `MAIN`, `REQUIRED_COMPONENT`, or `OPTIONAL_ADDON` role;
- component product/SKU or customer selection group;
- quantity and display order;
- fixed, customer-selected, parent-derived, or staff-selected SKU resolution;
- allowed alternatives and substitution policy;
- size/color compatibility rules;
- whether customer approval is required for substitution;
- pricing and internal revenue-allocation behavior.

Rules are validated against circular composition. A product cannot contain itself directly or transitively. Nested reusable packages may be defined administratively, but booking expansion produces a flat, finite list of requirements with a configured maximum depth.

### 9.3 Booking expansion

At quote time the composition service resolves every selection and produces an immutable requirement proposal. At booking time the backend:

1. re-resolves and validates the proposal version;
2. sorts all SKU and pool locks deterministically;
3. checks availability for every requirement;
4. calculates the complete price;
5. creates the booking line snapshots;
6. creates fulfilment requirement snapshots and reservations;
7. assigns a unit immediately only when customer selection or unit-sensitive pricing requires it;
8. commits everything together.

Any failure rolls back the complete bundle.

### 9.4 Substitutions and partial returns

Substitution never overwrites the original requirement. It creates a versioned replacement record with actor, reason, compatibility result, price impact, and customer approval when required.

Components can be handed out and returned independently. The commercial booking is eligible for completion only when all required fulfilment quantities are returned or explicitly resolved as lost, and financial exceptions have been addressed. Inventory may remain in inspection or service after commercial return; service blocks protect later availability.

### 9.5 Modification, cancellation, and overdue fulfilment

Changing dates, quantities, selections, or bundle components is treated as a transactional re-plan. The system locks the old and proposed requirements, proves complete replacement availability, writes versioned requirement changes, recalculates price, and only then releases superseded reservations. A failed modification leaves the original booking intact.

Cancellation cancels every unreleased requirement reservation and releases future assignments together. Units already preparing, out, returned, or in service require an operational resolution instead of being forced back to available.

Overdue handling is requirement-aware. A late component attempts to extend only its reservation and assignment, while the booking records the overall overdue state. Conflicts with the next commitment create staff alerts and explicit recovery tasks rather than modifying another customer's booking.

## 10. Locations, inventory pools, and transfers

### 10.1 Locations

Every tenant receives a default `InventoryLocation`. Additional locations may represent showrooms, warehouses, pickup points, cleaning facilities, or repair facilities. Locations have tenant-unique codes, timezone/contact metadata, active state, and fulfilment capabilities.

Serialized units hold a current location ID. Pooled inventory uses `InventoryPool`, unique by tenant, SKU, and location, with non-negative on-hand quantity and version metadata.

### 10.2 Pooled movements and partial blocks

Pooled quantity changes and location transfers are written to the existing inventory movement ledger with source/destination locations. A quantity-aware capacity block can remove only part of a pool from availability, such as five damaged hair clips out of fifty. Serialized blocks target exact units.

Pooled availability is:

`on-hand quantity - overlapping reserved quantity - overlapping quantity blocks`

It never relies on a mutable “available now” counter for future dates.

### 10.3 Transfers

`InventoryTransfer` and its lines support serialized units and pooled quantities. Transfer states are `REQUESTED`, `APPROVED`, `DISPATCHED`, `RECEIVED`, and `CANCELLED`.

Serialized location changes only upon receipt. Pooled source quantity leaves on dispatch and destination quantity arrives on receipt, with an in-transit balance preserving reconciliation. Damaged, incomplete, or lost receipts enter inspection/issue handling instead of becoming available.

### 10.4 Fulfilment locations

A booking has a primary fulfilment location; each requirement has a source location. Bundles default to one-location fulfilment. Cross-location sourcing is an explicit tenant capability and is allowed only when required transfers can arrive before preparation starts. Accepted transfer plans become part of the booking snapshot.

## 11. Availability policies and date semantics

`AvailabilityPolicy` supports independent durations for:

- preparation;
- outbound delivery or pickup staging;
- customer rental;
- return allowance;
- inspection;
- cleaning/washing turnaround; and
- inter-location transfer lead time.

Resolution follows:

`Tenant default -> location/category override -> product override -> SKU override`

The most specific configured value wins independently for each field. The complete resolved policy is snapshotted once on the fulfilment requirement. Its reservation stores the resulting effective blocked dates, so policy provenance is preserved without two competing snapshots.

Customer rental dates remain inclusive dates. Operational intervals use normalized project date/time semantics and the location timezone where time-of-day matters. Availability responses expose customer dates and summarized buffers without exposing internal customer or asset information.

An actual service overrun extends the operational block. A late customer return attempts to extend the affected reservation and assignment transactionally. If that conflicts with a later commitment, the system records an operational conflict and alerts staff; it never hides or silently overwrites the later booking.

## 12. Availability calculation

One inventory availability facade remains authoritative. For a simple SKU or resolved bundle it:

1. validates tenant, catalog state, selections, location, and quantity;
2. expands composition and resolves source locations;
3. resolves and snapshots effective policies;
4. derives blocked ranges;
5. rejects applicable product, variant, SKU, unit, location, service, or transfer conflicts;
6. calculates pooled or serialized capacity for each requirement;
7. subtracts overlapping active reservations and quantity blocks;
8. returns per-requirement and aggregate availability with safe reason codes.

Public preflight availability is advisory. The booking transaction repeats the calculation under deterministic locks and serializable isolation.

Current operational state is a present-time projection, not an unconditional rejection of every future date. `QUARANTINED`, `LOST`, and `RETIRED` dispositions are hard eligibility gates. For an active unit currently cleaning, repairing, or transferring, dated service or transfer commitments and their expected completion determine whether a later range is eligible. Missing or uncertain completion dates keep the unit unavailable until staff resolves them.

## 13. Assignment

Visibility and assignment are separate policies with tenant defaults and product overrides.

Assignment modes are:

- `MANUAL_DEFERRED`;
- `AUTO_DEFERRED`;
- `AUTO_AT_BOOKING`; and
- `CUSTOMER_SELECTS`.

Eligibility is always evaluated before scoring: correct tenant/SKU/location, date availability, active disposition, permitted condition, completed checklist, no blocking issue/service/transfer, and bundle compatibility.

Automatic strategies include balanced rotation, least used, best condition, lowest eligible price, oldest eligible inventory, and a tenant-defined weighted strategy. Allowed scoring inputs include condition, completed rental count, recent utilization, age, maintenance due state, accumulated service cost, price, and transfer requirement. Demand may influence pricing or which tier is recommended, but it cannot bypass eligibility. Scoring inputs and weights are versioned. Ties use a stable deterministic key. The selected unit, candidates considered, policy version, score explanation, and staff override reason are auditable.

If unit choice changes customer price or disclosure, assignment occurs atomically during booking. Otherwise it may remain deferred until preparation.

## 14. Customer visibility and privacy

Visibility modes are:

- `INTERNAL_ONLY`: aggregate public availability only;
- `CONDITION_SUMMARY`: condition-tier counts and price ranges; and
- `UNIT_DETAILS`: sanitized eligible-unit information.

Public unit information may include a public alias, approved photos, condition grade, disclosed issues, rental-count band or exact count according to policy, and price. It never includes internal asset code, barcode, purchase cost, maintenance notes, staff notes, other customer history, or private inspection media.

Individual item visibility is disabled by default. A product may be stricter than the tenant default but may be more permissive only when tenant policy allows it.

## 15. Pricing and preferred-price requests

The existing pricing engine remains the base. Inventory pricing adds explicit, composable adjustments:

- condition-tier adjustment;
- unit-specific override;
- disclosed-defect discount;
- premium-unit surcharge;
- bundle adjustment;
- optional add-on price; and
- approved preferred-price adjustment.

Security-deposit rules may also vary by bundle, component risk, condition tier, or exact unit. Deposit calculations are snapshotted separately from rental revenue and remain integrated with the existing deposit workflow.

Every quote and booking stores a versioned explanation and immutable snapshots of base plan, adjustments, condition tier, composition, and selected unit when relevant. Prices are recalculated transactionally at booking; a stale or changed quote returns a structured conflict rather than silently charging a different amount.

A tenant may enable preferred-price or budget matching. A budget can filter/recommend eligible tiers. A preferred-price submission creates an expiring approval request and optional inventory hold. It never automatically changes price unless a configured, auditable approval rule explicitly permits it.

## 16. History, metrics, valuation, and profitability

### 16.1 Serialized metrics

Derived per-unit metrics include completed rental count, rental days, revenue allocation, utilization, cleaning/repair downtime and cost, damage charges/recovery, average revenue per rental, age, condition trend, and time since service.

Metrics are derived from immutable facts. Cached projections may be rebuilt and therefore are not the source of truth.

### 16.2 Pooled metrics

Pooled inventory reports at SKU/location level. The system does not invent item-level history for deliberately non-serialized pieces.

### 16.3 Revenue allocation

Bundle revenue is allocated across fulfilment requirements by a snapshotted policy: explicit percentages, standalone prices, purchase value, or equal weighting. Allocation totals must equal the allocatable booking-line amount after discounts according to a documented rounding rule.

### 16.4 Operational valuation

Valuation supports manual value, straight-line, declining-balance, usage-based, and condition-adjusted estimates using purchase cost/date, useful life, salvage value, usage limits, and condition history. Reports label these as operational estimates unless a future accounting integration supplies authoritative values.

The system may recommend service, quarantine, price change, or retirement. Only an authorized owner or manager may retire a unit.

## 17. Service and module boundaries

- `InventoryAvailabilityService`: safe capacity and conflict calculation.
- `InventoryReservationService`: reservation lifecycle and concurrency.
- `FulfillmentService`: requirement expansion, snapshots, return completeness, and substitution.
- `InventoryAssignmentService`: unit eligibility, scoring, assignment, and release.
- `StockUnitLifecycleService`: guarded operational/disposition transitions.
- `InspectionService`: inspections, checks, issues, amendments, and media links.
- `InventoryServiceOrderService`: cleaning, repair, maintenance, and blocking work.
- `ProductCompositionService`: set definitions, bundles, alternatives, and cycle validation.
- `InventoryLocationService`: locations, pools, adjustments, and transfers.
- `AvailabilityPolicyService`: hierarchical policy resolution and snapshots.
- `InventoryPricingService`: item adjustments and quote snapshots.
- `InventoryAnalyticsService`: rebuildable projections and reports.

Controllers authorize and validate transport concerns, then call domain services. Frontend code never reimplements availability, transition, pricing, or eligibility rules.

## 18. Authorization and audit

- Owners configure tenant-wide policies, visibility, valuation, and retirement permissions.
- Owners and managers manage composition, locations, stock, pricing adjustments, and exceptional overrides.
- Staff perform assignments, handovers, returns, inspections, service tasks, and transfers according to granted permissions.
- Public endpoints expose only safe catalog projections.

Every mutation validates tenant ownership across all referenced records. Cross-tenant IDs return a not-found or forbidden response without disclosing existence. Sensitive overrides require a reason. Existing audit logging is extended with domain event references.

## 19. Error handling and idempotency

Stable error codes include:

- `INVENTORY_CAPACITY_CONFLICT`
- `BUNDLE_COMPONENT_UNAVAILABLE`
- `FULFILLMENT_SELECTION_INVALID`
- `LIFECYCLE_TRANSITION_INVALID`
- `INSPECTION_REQUIRED`
- `SET_COMPONENT_MISSING`
- `UNIT_ASSIGNMENT_CONFLICT`
- `LOCATION_CAPACITY_CONFLICT`
- `TRANSFER_LEAD_TIME_CONFLICT`
- `PRICE_QUOTE_STALE`
- `CONDITION_DISCLOSURE_CHANGED`
- `INVENTORY_VERSION_STALE`

Lifecycle transitions, inspection submission, service completion, transfer receipt, assignment, preferred-price approval, and damage/deposit actions accept idempotency keys. A repeated successful command returns the original result; reuse with different input is rejected.

## 20. Migration and compatibility

Migration is additive, tenant-batched, observable, and resumable:

1. Create a default inventory location for each tenant.
2. Create an inventory pool for every pooled SKU using current `pooledQuantity`.
3. Assign serialized units to the default location while preserving `locationLabel` as legacy metadata for later owner mapping.
4. Create one `MAIN` fulfilment requirement for every existing booking item.
5. Reconnect each existing reservation to that requirement and remove the one-to-one assumption only after validation.
6. Map current `ACTIVE`, `RETIRED`, and `LOST` unit statuses directly.
7. Map `MAINTENANCE` to active disposition, `REPAIRING` operational state, and a generic open maintenance service record, preserving original notes. Owners can later reclassify the work as cleaning, washing, repair, or quarantine without losing the migration event.
8. Preserve all assignments, blocks, movements, booking snapshots, and damage reports.
9. Run compatibility reads/writes while frontend and jobs migrate.
10. Reconcile tenant counts and only then deprecate old scalar/location/status fields.

Backfills never infer ambiguous SKU, location, component, or physical-unit identity. Ambiguous records are reported for owner review.

## 21. Testing strategy

### 21.1 Unit tests

- Lifecycle transition matrix and permissions.
- Inspection completion and amendment rules.
- Issue severity and blocking policy.
- Composition expansion, alternatives, and cycle prevention.
- Checklist completeness.
- Policy inheritance and snapshots.
- Assignment eligibility and deterministic scoring.
- Price-adjustment ordering and allocation rounding.
- Valuation formulas and projection rebuilds.

### 21.2 Database integration tests

- Concurrent pooled and serialized booking attempts.
- Atomic multi-component bundle reservation.
- Overlapping assignment exclusion.
- Location-pool quantity constraints.
- Transfer dispatch/receipt reconciliation.
- Idempotent command uniqueness.
- Tenant isolation across every new model.
- Late-return conflicts and service overruns.

### 21.3 Migration tests

- Empty, small, and representative legacy datasets.
- Restarting partially completed tenant batches.
- Count and financial snapshot reconciliation.
- Ambiguous-record reporting without speculative writes.
- Compatibility readers before and after each phase.

### 21.4 API and frontend tests

- Safe public projections for every visibility mode.
- Owner/manager/staff authorization.
- Booking quote-to-commit conflict behavior.
- Return, inspection, service, substitution, and transfer workflows.
- Code-level compilation and contract verification are mandatory. Browser or visual verification is performed only when explicitly requested.

## 22. Rollout and observability

Each phase is enabled per tenant after migration and reconciliation. Background jobs and backfills publish structured counts, failures, retry totals, and tenant IDs without customer-sensitive data. Alerts cover stuck inspections, overdue service, transfer mismatch, expired holds, unresolved late-return conflicts, and projection-rebuild failure.

Operational dashboards show reservation pressure, unavailable capacity by cause, unassigned upcoming requirements, overdue returns, inspection queues, service queues, and location imbalances.

## 23. Explicit exclusions

The design leaves extension points but does not include barcode-scanner hardware protocols, supplier purchase orders, route optimization, formal general-ledger accounting, external cleaning-vendor portals, or AI-based damage recognition. These can integrate later without changing the core inventory identity, fulfilment, lifecycle, or history models.

## 24. Completion criteria

The domain is complete when a tenant can:

- configure pooled or serialized inventory for any SKU;
- register, locate, inspect, service, price, transfer, and retire serialized pieces;
- define inseparable sets, assembled bundles, alternatives, and add-ons;
- reserve every required component atomically for dates and location;
- hand out and return components independently with exact history;
- prevent incomplete or operationally unready inventory from being offered;
- choose public visibility and assignment behavior safely;
- reconcile damage and deposits against exact physical items;
- report operational performance and estimated value at the correct level of identity; and
- migrate existing bookings and inventory without losing or inventing history.
