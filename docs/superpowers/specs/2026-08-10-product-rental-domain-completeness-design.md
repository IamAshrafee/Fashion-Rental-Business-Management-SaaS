# Product and Rental Domain Completeness Design

**Date:** 2026-08-10

**Status:** Approved for implementation

**Scope:** Bring the complete owner-side product and rental domain to operational closure: catalog, inventory, physical items, bundles, bookings, fulfillment, return, inspection, and service. Unrelated owner-dashboard modules are outside this delivery unless a scoped workflow depends on them.

## 1. Decision

The domain will be completed through workflow-first vertical closure. Every capability is audited from database constraints through the owner experience, and missing pieces are implemented in dependency order. A capability is not complete merely because a table, endpoint, or page exists; staff must be able to discover it, understand its state, perform the next valid action, recover safely from conflicts, and see its history.

The final domain chain is:

`Product -> Variant -> SKU -> Pool or Physical Item -> Reservation -> Fulfillment Requirement -> Assignment -> Rental Lifecycle`

The implementation will not retain obsolete compatibility fields, duplicate calculations, fake queues, or frontend guesses. Operational history remains immutable because it is business evidence, not legacy compatibility.

## 2. Completion boundary

### 2.1 Catalog

Catalog covers:

- products, categories, product types, size systems, and events/collections;
- product variants and rentable SKUs;
- pooled or serialized tracking configuration;
- authoritative pricing, deposits, fees, services, and late-fee policy;
- storefront media and publication readiness;
- required bundle components, alternatives, and optional add-ons;
- product-level links to inventory, composition, pricing, and history.

### 2.2 Inventory

Inventory covers:

- inventory overview and actionable attention counts;
- stock by SKU and location;
- serialized physical-item registration and lifecycle;
- pooled stock adjustments and stock counts;
- locations and capabilities;
- transfers, partial receipts, exceptions, and reconciliation;
- availability policies, buffers, blocks, and blackouts;
- immutable movement history;
- inspections, issues, damage, cleaning, washing, repair, alteration, and maintenance;
- return to availability, quarantine, loss, retirement, and valuation context.

### 2.3 Rentals

Rentals covers:

- booking requests and confirmation;
- manual booking creation;
- authoritative availability and quote freshness;
- customer, dates, handover, location, components, price, deposit, and payment context;
- reservations and exact serialized assignments;
- preparation and handout;
- active rental, extension, overdue, and loss handling;
- return intake, physical-item inspection, damage responsibility, deposit settlement, and service follow-up;
- immutable commercial and operational history.

### 2.4 Explicitly excluded

This delivery does not redesign unrelated customer management, analytics, billing, subscription, domain, or general settings workflows. Those areas may be touched only when a scoped product/rental workflow requires an existing contract or link. It also excludes a native mobile application, offline synchronization, label-printer integration, predictive demand, AI pricing, and public selection of a specific physical item.

## 3. Authoritative architecture

### 3.1 Catalog identity

`Product` is the customer-facing offer. `ProductVariant` is a visual or configuration edition. `VariantSize` is the rentable SKU and owns its tracking mode. SKU inventory quantity is never stored on the product or variant.

### 3.2 Hybrid inventory

A pooled SKU owns quantity through `InventoryPool` records by location. A serialized SKU owns individually identified `StockUnit` records. The two modes share availability, location, reservation, movement, and reporting concepts without pretending they have the same operational workflow.

Available quantity is derived from on-hand inventory, active reservations, blocks, assignments, outgoing transfers, operational eligibility, and the requested blocked date range. Incoming transfer inventory is reported separately until receipt.

### 3.3 Fulfillment obligations

`BookingItem` is the commercial snapshot. `FulfillmentRequirement` is the operational obligation. A simple item, required bundle component, chosen alternative, and selected add-on each resolve to a requirement with a source location, SKU, tracking snapshot, date range, policy snapshot, quantity, and reservation.

Pooled requirements reserve quantity. Serialized requirements reserve capacity and later receive exact physical-item assignments. Assignment, substitution, handout, return, loss, and inspection history is never replaced by a mutable summary label.

### 3.4 Lifecycle authority

Inventory commands update operational facts first. Booking readiness and status follow those facts. A booking cannot be marked delivered before all required handouts, returned before all handed-out requirements are returned or resolved as lost, or inspected/completed while a returned serialized item still requires inspection.

Service work and inspections create availability blocks where required. An item becomes available only after its inspection decision and any required service work permit it.

## 4. Owner information architecture

### 4.1 Catalog navigation

- Products
- Categories and product types
- Size systems
- Events/collections
- Product composition and add-ons through product context

Product detail is the control center for one product. Global inventory work is never hidden only beneath product detail.

### 4.2 Inventory navigation

- Overview
- Stock by SKU
- Physical items
- Locations
- Transfers
- Availability policies and blackouts
- Inspections and issues
- Cleaning and service work
- Movements and stock counts

Inventory overview metrics are links into filtered workspaces. Shortages, low stock, incomplete sets, inspection intake, service work, transfer exceptions, and blocked inventory must lead to the exact records requiring action.

### 4.3 Rental navigation

The booking workspace provides URL-addressable queues for:

- requests;
- assignment required;
- preparation and handoff;
- active rentals;
- returns due and intake;
- inspection required;
- overdue and operational exceptions;
- completed and cancelled history.

Booking detail has two primary layers:

1. commercial summary, customer, rental plan, payment, deposit, totals, and notes;
2. fulfillment requirements, sources, reservations, assignments, preparation, handout, return, inspection, service, substitutions, and history.

Common work must be reachable within two navigation steps. Mobile layouts prioritize asset lookup, scanning, assignment, handout, return, and inspection rather than reproducing wide desktop tables.

## 5. Core workflows

### 5.1 Product draft to publication

One resumable product draft moves through basics, variants/SKUs, pricing/services, media, initial inventory, and review. Draft creation is idempotent. Sections save independently without creating duplicate products. Backend readiness identifies section-specific blockers and is enforced on publication.

Tracking mode cannot change silently when inventory, reservations, requirements, or relevant history exists. Published changes that would invalidate active rental obligations are rejected or handled through an explicit safe operation.

### 5.2 Inventory control

Pooled quantity changes occur through reasoned adjustment or count commands that create movements and use optimistic versions. Direct quantity editing is not exposed. Serialized assets are registered singly or atomically in batches with tenant-unique asset codes, location, condition, acquisition context, and component state.

Transfers reserve origin capacity only when ready, move inventory to outgoing/incoming state when dispatched, and apply destination inventory only on receipt. Partial receipts record accepted, damaged, lost, and unresolved outcomes explicitly.

### 5.3 Availability and blackouts

Availability resolves tenant, location, SKU, tracking mode, policy buffers, blocks, reservations, assignments, transfers, condition, operational state, and every bundle component. Customer-visible rental dates remain separate from the effective blocked dates.

Policy edits affect new planning. Existing fulfillment requirements retain their policy snapshot. Blackouts and maintenance blocks identify their exact scope and cannot create invalid or negative capacity.

### 5.4 Manual booking

Manual booking uses five stages:

1. customer and delivery/contact context;
2. rental dates, fulfillment location, and handover method;
3. products, SKUs, components, quantities, and availability;
4. authoritative quote, adjustments, deposit, and payment;
5. review and atomic creation.

Changing dates, location, handover, quantity, SKU, components, or price options invalidates the current availability and quote result. The UI marks stale results and requests a fresh quote. Booking creation sends the quote/version reference and an idempotency key, then revalidates price and capacity in one serializable transaction.

Local draft persistence may protect navigation loss, is tenant-scoped and versioned, and does not persist sensitive payment credentials. Availability or pricing conflicts retain form context and identify affected lines.

### 5.5 Fulfillment, return, and service

Staff resolve every requirement, assign eligible physical items where required, prepare the items, and record exact handout facts. Returns record exact returned or lost components. Returned serialized items move to inspection intake and remain unavailable.

Inspection records condition, set completeness, issues, media evidence, responsibility, and an availability decision. Damage can affect deposit settlement and create service work. Cleaning, washing, repair, alteration, and maintenance remain availability-blocking until completed or explicitly cancelled through a valid transition. Every transition records actor, reason, timestamps, and related identities.

## 6. Backend and frontend contract

The backend is authoritative for availability, pricing, financial totals, queue membership, readiness, and lifecycle transitions. The frontend never reconstructs these from partial records.

Every list contract provides validated tenant-scoped filters, stable sorting, bounded pagination, and consistent metadata. Global operational queues are derived server projections rather than duplicated mutable lists. Large histories are separately paginated.

Every mutation returns the updated record or version and enough audit identity to refresh the correct workspaces. Typed machine-readable errors include:

- validation;
- permission;
- stale version;
- availability conflict;
- pricing conflict;
- lifecycle conflict;
- not found;
- transient failure.

The UI preserves correctable input, identifies the affected product, SKU, item, requirement, or booking, and provides a safe recovery action. Optimistic UI is limited to reversible presentation state.

## 7. Concurrency, idempotency, and performance

- Booking creation, substitution, date extension, assignment, stock adjustment, count reconciliation, transfer dispatch/receipt, and other capacity-sensitive commands use transactions appropriate to their contention risk.
- Capacity locks use deterministic location/SKU/unit ordering.
- Idempotency keys protect retryable create and transition commands, including product draft creation, batch item registration, manual booking creation, stock commands, and transfer transitions.
- Request fingerprints reject reuse of an idempotency key for changed command content.
- Optimistic versions reject stale pool, policy, count, and transfer edits.
- Database constraints prevent negative quantities, invalid date ranges, invalid block scope, duplicate active identity, and overlapping active serialized assignment.
- Owner lists never fetch unbounded nested records or trigger per-row requests.
- Search is debounced, filters reset pagination, and URL state survives refresh and navigation.
- Summary projections avoid N+1 aggregation and remain rebuildable from source records.
- Money is stored and transmitted as integer minor units. Timestamps are UTC; business-date interpretation occurs with tenant/location timezone rules at API boundaries.

## 8. Error, empty, and recovery states

Every completed workspace distinguishes:

- no records from no filter matches;
- initial loading from background refresh;
- correctable validation from permission denial;
- stale data from capacity or lifecycle conflict;
- transient failure from an authoritative rejection.

Dialogs have accessible titles and descriptions. Status is communicated with text, not color alone. Destructive, irreversible, and financially meaningful actions name the affected record, show their exact effect, require confirmation, and capture a reason. Routine inventory-changing commands show their exact effect before submission and require a reason even when a second confirmation is unnecessary.

Retryable commands preserve their idempotency key. A retry can return an already completed matching command but cannot duplicate it.

## 9. Delivery order

### Checkpoint A: Capability audit

- Build a schema-to-UI capability matrix for every scoped workflow.
- Identify dead routes, duplicate contracts, missing entry points, unbounded queries, incomplete state transitions, and absent tests.
- Preserve existing unrelated worktree changes. The current uncommitted booking query limit and inventory pagination edits must be evaluated against the final pagination contract rather than overwritten.

### Checkpoint B: Catalog closure

- Complete draft/edit/publish consistency, pricing authority, media, composition, readiness, and history entry points.
- Remove obsolete product, pricing, and inventory compatibility paths encountered in the scoped workflow.

### Checkpoint C: Inventory closure

- Complete pooled adjustment, movement history, counts, policy/blackout management, batch registration, and transfer exceptions.
- Add discoverable global workspaces for inspections/issues and cleaning/service work.
- Connect overview attention metrics to filtered operational results.

### Checkpoint D: Rental creation closure

- Decompose manual booking orchestration into focused stages and hooks.
- Complete location/handover planning, authoritative quote freshness, conflict recovery, bundles, deposits, and payment integration.

### Checkpoint E: Fulfillment and return closure

- Complete preparation, handout, return, loss, inspection, damage, deposit, and service transitions.
- Make booking status and operational queues derive from completed facts.

### Checkpoint F: Completion audit

- Review tenant isolation, indexes, constraints, transaction boundaries, idempotency, API types, navigation, URL state, accessibility, mobile behavior, and recovery states.
- Remove scoped dead code and compatibility contracts.
- Run all automated verification gates.

## 10. Verification

Browser and visual verification are explicitly excluded by project direction.

Verification includes:

- backend unit tests for filters, readiness, policies, queues, commands, guards, and typed conflicts;
- PostgreSQL integration tests for capacity, tenant isolation, idempotency, adjustments, assignments, transfers, booking creation, and return/inspection transitions;
- frontend tests for URL normalization, workflow state, stale quote invalidation, and mutation recovery where supported by the existing test stack;
- Prisma generation and validation;
- clean empty-database migration and deterministic seed verification whenever the schema changes;
- TypeScript checks and focused lint with no new warnings in changed files;
- backend and frontend production builds;
- contract searches proving that replaced request/response shapes and compatibility branches are gone.

Existing unrelated repository warnings do not block the scoped delivery. Any warning in a changed file is corrected as part of that checkpoint.

## 11. Definition of complete

A capability is complete only when all of the following exist:

1. correct schema constraints and query indexes;
2. tenant-scoped domain behavior;
3. authorized controller and validated DTO;
4. typed frontend API contract;
5. discoverable owner workflow;
6. meaningful loading, empty, success, validation, permission, conflict, and retry states;
7. visible immutable history or audit reference;
8. focused automated verification.

The delivery is complete when:

- staff can perform the full product-to-return lifecycle without a hidden backend-only step or a non-functional frontend control;
- pooled and serialized inventory remain correct under concurrent booking and operational commands;
- every bundle requirement is planned, reserved, handed out, returned, lost, inspected, or serviced explicitly;
- blocked, returned, damaged, incomplete, cleaning, repairing, transferred, lost, retired, or otherwise ineligible inventory is never offered as available;
- booking and queue states follow operational facts;
- authoritative pricing and availability are revalidated atomically;
- all scoped workspaces are discoverable, bounded, URL-stable, recoverable, and backed by final contracts;
- the complete repository passes the defined automated verification gates from the clean baseline.
