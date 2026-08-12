# Serialized Rental Inventory and Product Lifecycle Design

**Date:** 2026-08-12

**Status:** Approved design; awaiting written-spec review

**Scope:** Redesign the owner-side product lifecycle and the inventory, availability, booking, fulfilment, transfer, inspection, service, profitability, and contextual-help contracts around one rule: every rentable piece is an individually identified physical item.

## 1. Decision

The application will replace its hybrid pooled/serialized rental inventory with a clean serialized-only domain.

The authoritative chain is:

`Product listing -> Variant -> SKU -> Physical item`

Catalog describes what the business offers. Inventory records what the business physically owns. A product can be drafted, edited, published, archived, and displayed without inventory. Rental capacity is derived exclusively from eligible physical items.

The implementation will not hide pooled controls while retaining pooled internals. It will remove the pooled concept from the database schema, backend services, APIs, frontend types, workflows, documentation, seed data, and tests. Development data and the existing single baseline migration are disposable, so no compatibility layer or pooled-to-serialized production-data migration is required.

## 2. Product principles

- Every rentable piece has a permanent physical identity and complete operational history.
- Catalog publication and inventory availability are separate concerns.
- A published zero-stock product is valid and appears unavailable rather than inventing capacity.
- Customers choose a product, SKU, and quantity; internal asset identities remain private.
- Staff assign exact physical items during preparation, not necessarily at customer checkout.
- Derived quantities are counts of physical items and are never directly edited.
- Acquisition and valuation data belongs to physical inventory, not the product listing.
- Pricing and customer-facing reference value are separate from private acquisition cost.
- Historical and operational records are retained through deactivation or archival rather than destructive deletion.
- One domain action has one canonical command and workflow, regardless of its entry point.
- Essential instructions remain visible; accessible contextual help explains non-obvious meaning, examples, defaults, and consequences.
- Consumables and supplies are outside the rental inventory domain and may receive a separate future procurement design.

## 3. Domain ownership

### 3.1 Product listing

`Product` owns customer-facing and merchandising data:

- name and description;
- category and subcategory;
- product type and size-system selection;
- suitable events or collections;
- content, details, FAQs, and merchandising attributes;
- product-level media and media ordering;
- pricing, fees, deposits, services, delivery, and late policies;
- optional country of origin;
- optional customer-facing reference retail or replacement value;
- draft, published, and archived lifecycle state.

The product does not own purchase date, purchase cost, physical location, stock quantity, condition, or a target rental count.

Reference retail value must be named and modeled separately from acquisition cost. It may be public when explicitly configured. It must never expose or fall back to a physical item's private acquisition cost.

### 3.2 Variant

`ProductVariant` owns a visual or color edition of a product:

- variant name;
- main and searchable equivalent colors;
- variant-specific media and ordering;
- the set of rentable SKUs under that visual edition.

### 3.3 SKU

`VariantSize` remains the rentable SKU, such as `Ivory Gold / Medium`.

A SKU owns:

- stable identity and optional SKU code;
- product, variant, and size relationships;
- component/set definitions and SKU-level configuration;
- policy references where applicable.

A SKU has no tracking-mode field and no stored stock quantity. It can own zero or more physical items.

### 3.4 Physical item

`StockUnit` is the only source of rental inventory. Every physical item owns:

- tenant-unique asset code;
- optional tenant-unique barcode;
- SKU identity;
- current structured location;
- acquisition date and unit acquisition cost;
- optional acquisition source/reference and notes;
- condition grade and approved valuation fields;
- disposition and operational lifecycle state;
- storefront-safe condition configuration where supported;
- component/set state;
- assignments, movements, blocks, inspections, issues, service work, and lifecycle history;
- attributed rental revenue and attributable operational costs through related records.

Two visually identical pieces remain separate physical items because their cost, condition, location, usage, service history, availability, and retirement outcome can differ.

### 3.5 Derived stock state

The following values are projections over physical-item records:

- registered;
- on hand;
- available;
- reserved;
- assigned;
- out for rental;
- unavailable or blocked;
- incoming or in transfer;
- awaiting inspection;
- in cleaning or repair;
- damaged, lost, or retired.

No owner interface exposes anonymous quantity edits. Inventory-changing actions identify the physical records affected and create auditable events.

## 4. Concepts removed from the domain

The clean schema and contracts remove:

- `InventoryTrackingMode` and all `POOLED`/`SERIALIZED` branches;
- `InventoryPool` and every relation to it;
- pooled quantity, adjustment, receipt, count, loss-reconciliation, and availability commands;
- pooled inventory reservations;
- pooled or quantity-scoped blocks;
- pooled transfer lines and transfer-line kind;
- pooled movement types and quantity deltas used for anonymous stock;
- tracking-mode fields, snapshots, filters, badges, and configuration controls;
- product-level purchase date and purchase cost;
- the public-purchase-price switch;
- product-level `targetRentals` and its progress display;
- the product-onboarding opening-inventory contract and UI;
- duplicate physical-item registration implementations.

Historical booking snapshots retain the commercial product, variant, size, price, and policy facts needed to interpret the booking, but do not retain an obsolete inventory tracking-mode snapshot.

## 5. Product creation and publication

### 5.1 Five-stage catalog workflow

The Add Product workflow becomes catalog-only:

1. **Listing basics**
   - name;
   - category and subcategory;
   - product type and size system;
   - suitable events or collections;
   - optional country of origin;
   - optional public reference retail or replacement value.
2. **Variants, SKUs, and media**
   - visual/color variants;
   - rentable sizes and stable SKU identities;
   - product and variant images;
   - image ordering, featured selection, and alt text.
3. **Content and merchandising**
   - description;
   - detail sections;
   - FAQs and other supported merchandising content.
4. **Pricing and services**
   - authoritative rental rate plan;
   - deposits, fees, late policy, delivery, and supported services.
5. **Review and publish**
   - catalog-readiness checklist;
   - storefront summary or preview;
   - save draft and exit;
   - publish listing.

Product and variant images belong to stage 2 because media and visual variants must be configured together.

### 5.2 Resumable draft behavior

The first successful Basics save creates one server-owned draft. The route retains the product ID so refresh and navigation resume the same product. Every section save:

- updates the same draft;
- uses an idempotency key for retry safety;
- checks the expected onboarding revision;
- returns the updated revision and section readiness;
- preserves successfully saved sections when a later section fails.

The creation workflow does not expose a status selector in its first stage. Draft is the automatic creation state. Publication is an explicit final action.

### 5.3 Publication readiness

Publication validates catalog readiness only:

- required listing identity and active references;
- at least one valid variant and SKU;
- required customer-facing media;
- valid authoritative pricing and service configuration;
- valid composition/component configuration where applicable;
- no catalog configuration blockers.

Inventory is not a publication prerequisite. A published listing with zero eligible physical items is visible but unavailable for the requested dates/location.

### 5.4 Completion screen

After a successful draft completion or publication, show a dedicated completion state with:

- **Add physical items now** — open the canonical registration route with the product preselected;
- **View product**;
- **Create another product**;
- **Go to catalog**.

This preserves the convenient create-then-stock journey without embedding a second inventory implementation in product onboarding.

## 6. Product editing and catalog lifecycle

Creation and editing reuse focused section components and domain hooks. Editing uses a tabbed product workspace rather than replaying the sequential creation wizard.

Editable sections include:

- listing basics;
- variants, SKUs, and media;
- content and merchandising;
- pricing and services;
- publication and readiness;
- composition where applicable.

Editing rules:

- Merchandising fields and media can be updated normally when references remain valid.
- Pricing changes create a new pricing version. Existing bookings retain their quote and price snapshots.
- New variants and SKUs can be added to an existing product.
- A SKU with physical items, reservations, booking history, or movements cannot have its identity restructured into another size or variant.
- When a historical SKU identity must change, deactivate the old SKU and create a replacement.
- Products with operational history are archived, not hard-deleted.
- A draft product, variant, or SKU with no inventory, booking, movement, pricing-history, or other protected reference may be hard-deleted through an explicit confirmed action.
- Publication changes never erase inventory or operational history.
- Backend conflicts identify the exact active booking, inventory, or history dependency blocking a change.
- Optimistic revisions prevent silent concurrent overwrites.

Product editing links to the product-filtered Inventory workspace and canonical registration route. It does not embed a duplicate inventory editor.

## 7. Canonical physical-item registration

### 7.1 Route and entry points

There is one canonical route:

`/dashboard/inventory/items/register`

Every entry point opens that route with optional scope:

- product-creation completion: product preselected;
- product detail or product inventory: product preselected;
- Stock by SKU: SKU preselected;
- Physical Items: no preset, so staff selects the product/SKU.

Scope is explicit in URL or route state and does not create a different workflow implementation.

### 7.2 Registration flow

The workflow:

1. Selects a product/SKU when not already scoped.
2. Selects an active inventory-storing location.
3. Chooses single-item or batch entry.
4. Enters or generates permanent asset codes.
5. Scans or enters optional barcodes.
6. Captures shared acquisition defaults:
   - acquisition date;
   - unit acquisition cost;
   - initial condition;
   - optional source/reference;
   - optional notes.
7. Previews generated rows and permits applicable per-row overrides.
8. Initializes required component/set state for each item.
9. Reviews and registers the full batch atomically.

### 7.3 Command behavior

One backend command creates:

- every requested physical item;
- initialized component states;
- acquisition/registration audit context;
- registration inventory movements.

The command:

- accepts one idempotency key and a request fingerprint;
- validates tenant, SKU, location, identities, acquisition inputs, and components;
- normalizes asset codes consistently;
- validates the complete batch before mutation;
- runs in a transaction with the appropriate isolation level;
- creates all rows or none;
- returns exact row/field errors;
- returns a matching prior result for a safe retry;
- rejects reuse of the key for changed input.

After success, staff can view the registered items, register another batch for the same SKU, choose another SKU, or return to the originating product/inventory page.

### 7.4 Acquisition and metadata correction

Asset code, barcode, acquisition date, acquisition cost, acquisition reference, notes, and approved valuation fields are correctable metadata. Corrections require a reason and create an audit event containing the actor, timestamp, previous state, and new state.

Operational facts are not corrected through generic editing:

- location changes use transfer/movement commands;
- condition changes use inspection or an authorized correction command;
- cleaning, repair, loss, recovery, retirement, and reactivation use lifecycle commands;
- component changes use explicit set/inspection operations.

## 8. Inventory workspace

### 8.1 Overview

Inventory Overview is an action dashboard derived from physical items. It reports and links to filtered records for:

- available, reserved, assigned, and out items;
- blocked and otherwise unavailable items;
- incoming and in-transfer items;
- inspection intake;
- cleaning and repair;
- damaged, lost, and retired items;
- shortages affecting bookings;
- component incompleteness and unresolved issues.

### 8.2 Stock by SKU

Each row represents one SKU and aggregates physical-item counts:

- registered;
- on hand;
- available;
- reserved;
- assigned;
- out;
- unavailable;
- incoming;
- location distribution;
- next booking pressure or shortage.

Valid primary actions are **Register physical items**, open filtered Physical Items, and manage the SKU/product. Direct quantity adjustment does not exist.

### 8.3 Physical Items

Physical Items is the authoritative asset register. Search covers asset code, barcode, SKU, product, and supported reference values. Filters include product/SKU, location, disposition, operational state, condition, component completeness, issue/service state, and optional date-range availability.

The main view surfaces:

- asset code and barcode;
- product, variant, size, and SKU;
- current location;
- disposition, operational state, and condition;
- current/next booking context when permitted;
- component completeness and open issues;
- acquisition context and approved valuation data;
- rental count and last activity;
- the next valid action.

### 8.4 Locations

Location totals count actual physical items by current state. A location cannot be deactivated while it owns on-hand items, active assignments, unfinished transfers, or operational dependencies. The default-location safeguards remain.

### 8.5 Transfers

Every transfer selects exact physical items. Transfer lines no longer have a pooled/serialized kind or anonymous quantity semantics.

- Draft selects eligible items at the origin.
- Ready reserves those identities for transfer.
- Dispatch moves each item to the outgoing/in-transfer state.
- Receipt records an outcome per item: received, damaged, lost, or unresolved as supported.
- Partial receipt and reconciliation preserve exact outstanding identities.
- Cancellation returns only valid undisbursed/resolvable items to their prior state.

### 8.6 Stock counts

Stock counts reconcile identities, not quantities. Staff scan or select observed items at a location. The result identifies:

- expected and observed items;
- missing items;
- unexpected items;
- duplicate scans;
- items recorded at the wrong location;
- items whose current operational state needs resolution.

Applying a count creates item-specific correction or investigation events with a reason. It never changes an anonymous number.

### 8.7 Blocks and availability controls

Date blocks may target a product, variant, SKU, physical item, or location according to explicit business rules. Inventory-pool targets and quantity blocks are removed. Blocks explain their scope, effective date range, cause, and resulting availability effect.

### 8.8 Movements, inspections, issues, and service

Every inventory movement references a physical item and, when relevant, origin, destination, transfer, reservation, actor, reason, timestamp, and before/after state.

Inspection, issue, cleaning, repair, alteration, maintenance, loss, recovery, and retirement workflows always act on exact physical items and retain immutable history.

## 9. Availability and reservation model

### 9.1 Capacity calculation

Customer availability remains quantity-based. For a requested SKU, source location, and effective blocked date range, the backend:

1. Resolves the applicable availability policy and buffers.
2. Counts active physical items at the location that satisfy eligible condition and operational-state rules.
3. Excludes supply-side unavailability independent of booking demand: applicable item/product/SKU/location blocks, transfers, blocking issues, incomplete required components, inspection, service, loss, or retirement.
4. Subtracts quantity demand from overlapping active pending and confirmed reservations exactly once. Exact assignments realize that reservation demand and are not subtracted a second time.
5. Applies an explicitly configured shortage policy only if the business permits it.
6. Returns authoritative capacity, remaining quantity, effective dates, and machine-readable reasons when unavailable.

No pool row participates in capacity.

### 9.2 Quantity reservations before assignment

A customer or staff member reserves SKU/location capacity, not necessarily exact physical items. This lets operations choose the most suitable piece during preparation while guaranteeing that total demand does not exceed eligible capacity.

Booking creation and other capacity-sensitive mutations:

- lock affected SKU records in stable order;
- run in a transaction suitable for contention;
- recompute availability after acquiring locks;
- create quantity reservations against SKU and source location;
- preserve rental dates, effective blocked dates, policy snapshot, status, expiry, and requirement identity;
- reject conflicts with requested and remaining capacity.

Pending holds expire automatically. Confirmation promotes valid holds. Cancellation and completion release the appropriate reservations and assignments.

### 9.3 Exact assignment and fulfilment

During preparation, staff assigns the required number of eligible physical items. Assignment:

- locks selected items in deterministic order;
- rechecks tenant, SKU, location, condition, operational state, components, blocks, and overlapping assignments;
- prevents assignment beyond reserved quantity;
- updates requirement progress and history atomically.

Handout, return, inspection intake, loss, substitution, service, and release reference exact assignments and physical items. There is no pooled loss reconciliation or tracking-mode conditional.

Customers do not select internal asset identities. Existing preferred/customer-selected physical-item behavior is removed from public booking contracts.

### 9.4 Booking changes

Changes to dates, source location, SKU, components, fulfilment method, or quantity invalidate the relevant availability and quote result. The backend revalidates capacity and price transactionally. Conflicts preserve user input and identify the affected lines with safe substitution, removal, date, or location options.

## 10. Profitability and investment recovery

`targetRentals` is removed because a timeless product-level count cannot measure return when physical items have different costs, acquisition dates, rental rates, discounts, service costs, and lifecycles.

Performance is derived from actual records:

- per physical item: acquisition cost, attributed completed-rental revenue, attributable discounts/refunds where applicable, service/repair/cleaning costs where captured, loss/write-off outcome, and approved residual or retirement value;
- per SKU: aggregation across its physical items;
- per product: aggregation across its SKUs and physical items.

Investment recovery is expressed primarily in money, not an arbitrary count. Reporting must distinguish revenue, recorded direct costs, net contribution, acquisition cost recovered, and whether cost coverage is incomplete because required inputs are missing.

Revenue attribution uses the actual physical-item assignments for completed fulfilment. Existing booking price snapshots remain authoritative even after later catalog pricing changes.

When one requirement's revenue covers multiple handed-out items, allocate integer minor units evenly across the final handed-out assignments and distribute any remainder in stable assignment order. Substituted or released-before-handout items receive no revenue. Refunds and later financial corrections append corresponding attribution adjustments instead of rewriting the original allocation.

Time-bound business goals, if introduced later, belong to Analytics and require a separate design. They are not fields in Add Product.

## 11. Contextual help system

### 11.1 Presentation levels

The current hover-oriented `FieldTip` is replaced with two deliberate help levels:

- **Visible guidance:** prerequisites, warnings, irreversible effects, required formats, empty-state instructions, and information required to finish a task.
- **Context help popover:** business definitions, calculation details, realistic examples, defaults, and secondary consequences.

Obvious labels do not receive redundant help. Help is present wherever meaning, format, consequence, or domain terminology is not self-evident.

### 11.2 Content contract

Reusable help entries use stable typed keys and structured content:

- short title;
- what the field or action means;
- why and when it matters;
- realistic fashion-rental example;
- default or downstream effect;
- optional link to a related workflow or documentation surface.

Content is organized by domain—Catalog, Pricing, Inventory, Physical Items, Availability, Transfers, and Fulfilment—rather than copied into page components.

### 11.3 Interaction and accessibility

Help triggers:

- support mouse, keyboard, and touch;
- are focusable and have an accessible name;
- associate help with the relevant control through accessible descriptions;
- dismiss with Escape and outside interaction;
- fit and scroll appropriately on small screens;
- never hide essential instructions behind hover;
- contain no private customer data or sensitive internal calculations.

Validation remains separate from explanatory help. A validation message explains how to correct the current input. Disabled actions expose their blocking reason and required next step.

### 11.4 Coverage scope

This delivery completes contextual-help coverage for all Catalog, SKU, Physical Item, Inventory, Availability, Transfer, and related booking-assignment surfaces touched by the serialized migration. Obsolete help about pooled inventory, product acquisition cost, public purchase price, or target rentals is deleted.

A dashboard-wide audit of unrelated modules is a separate follow-up initiative.

## 12. API, concurrency, and audit contracts

- The backend is authoritative for catalog readiness, availability, reservation capacity, pricing, lifecycle transitions, and projections.
- Mutations return the updated entity/version and enough audit identity to invalidate the correct frontend queries.
- Capacity-sensitive commands use transactional locking and deterministic SKU/item ordering.
- Retryable creation and transition commands use idempotency keys plus request fingerprints.
- Optimistic revisions reject stale product, policy, transfer, and other versioned changes.
- Tenant scope is applied and tested at every query and mutation boundary.
- Money is transmitted and stored as integer minor units.
- Timestamps are UTC; business dates use explicit tenant/location interpretation at boundaries.
- List contracts use bounded pagination, stable sorting, validated filters, and consistent metadata.
- Operational history remains immutable; corrections append auditable events rather than rewriting history.

## 13. Error and recovery behavior

Every affected workflow distinguishes:

- field or row validation errors;
- duplicate identity conflicts;
- stale revision conflicts;
- active booking or historical dependency conflicts;
- availability/capacity conflicts;
- invalid lifecycle transitions;
- permission and tenant-scope failures;
- not-found results;
- transient failures.

Errors are typed and identify the affected product, SKU, physical item, batch row, reservation, transfer, or lifecycle record. Correctable input is preserved. Failed batches create nothing. Safe retry reuses the original idempotency key. Financially meaningful corrections require a reason. Irreversible actions describe their exact effect before confirmation.

## 14. Delivery checkpoints

This is a multi-checkpoint domain program. Implementation planning must keep each checkpoint independently reviewable and mergeable, define its own focused verification gate, and avoid beginning a dependent checkpoint until the preceding schema/API contract is stable.

### Checkpoint A: Serialized domain foundation

- Remove tracking enums, `InventoryPool`, pooled relations, and pooled fields.
- Remove product acquisition fields and `targetRentals`.
- Simplify SKU, reservation, requirement, transfer, block, and movement models.
- Rebuild the single baseline migration.
- Rebuild deterministic seed data using physical items only.
- Regenerate Prisma and shared/generated API types.

### Checkpoint B: Catalog lifecycle

- Refactor onboarding to the approved five stages.
- Place product/variant media in stage 2.
- Remove opening inventory and first-stage status selection.
- Complete resumable creation, editing, archival, history protection, and readiness.
- Add the post-completion action screen.

### Checkpoint C: Canonical registration

- Build the canonical registration route and atomic batch command.
- Add shared acquisition defaults, row overrides, component initialization, and correction audit.
- Route global, product, and SKU entry points into the same workflow.
- Delete onboarding and other duplicate registration implementations.

### Checkpoint D: Inventory operations

- Rebuild overview and Stock by SKU projections from physical items.
- Complete Physical Items, item detail, locations, exact-item transfers, identity counts, blocks, movements, inspections, issues, and service.
- Remove quantity-adjustment and pooled controls.

### Checkpoint E: Bookings and fulfilment

- Simplify availability and reservations to item-derived capacity.
- Remove pool references and tracking-mode branches.
- Update assignment, substitution, handout, return, inspection, service, loss, cancellation, and release.
- Add item-backed revenue and direct-cost attribution.

### Checkpoint F: Profitability and contextual help

- Replace Target Rentals UI with accurate investment-recovery/profitability projections.
- Implement the accessible contextual-help primitives and typed content registry.
- Complete the scoped help coverage audit.

### Checkpoint G: Final removal and contract audit

Repository and schema searches must find no live domain references to:

- `POOLED`;
- `InventoryPool` or `inventoryPool`;
- `pooledQuantity`;
- inventory `trackingMode`;
- product purchase date/cost/public-purchase-price fields;
- `targetRentals`.

Obsolete DTOs, services, controllers, routes, frontend types, filters, components, documents, seed paths, and tests are deleted rather than retained as compatibility code.

## 15. Verification strategy

Verification is proportional to each checkpoint. Focused tests run while changing a subsystem; schema validation, generated-type checks, type-checking, builds, and essential integration workflows run at checkpoint boundaries. The entire expensive suite is not repeated after every small edit.

Essential automated coverage includes:

- resumable product draft creation and stale-revision rejection;
- editing and publishing a zero-stock listing;
- safe product/SKU archival and historical identity protection;
- adding variants, SKUs, and media to existing products;
- pricing version preservation for existing bookings;
- atomic single/batch item registration and duplicate detection;
- acquisition/valuation correction audit;
- item-derived availability and concurrent booking protection;
- exact-item assignment and overlap prevention;
- substitution, handout, return, inspection, service, loss, cancellation, and release;
- exact-item transfer lifecycle and identity-based stock counts;
- profitability attribution from completed assignments;
- contextual-help keyboard, touch, dismissal, and accessible-description behavior;
- tenant isolation for catalog, inventory, reservation, and lifecycle commands.

## 16. Acceptance workflows

The delivery is complete when all of the following work through real backend contracts:

1. Staff create and publish a zero-stock product, then register physical items from the completion screen.
2. Staff edit a published product without mutating existing booking or pricing snapshots.
3. Staff add variants, SKUs, and media to an eligible existing product.
4. Global, product-scoped, and SKU-scoped entry points all use the same registration workflow and command.
5. Concurrent requests cannot over-reserve SKU/location capacity unless an explicit shortage policy permits it, and cannot assign the same physical item for overlapping dates.
6. Staff transfer, rent, return, inspect, service, lose/recover, and retire an exact item with complete history.
7. Stock counts identify missing, unexpected, duplicate, and wrong-location items by identity.
8. SKU and product stock summaries are derived exclusively from physical items.
9. Investment-recovery reporting uses item-backed acquisition, revenue, and recorded cost data and communicates incomplete inputs honestly.
10. A keyboard-only or touch user can discover and dismiss contextual help and can understand why an action is disabled.
11. Schema, generated types, APIs, UI, seed data, documentation, and tests contain no pooled inventory, product purchase-cost, public-purchase-price, or target-rental concept.

## 17. Explicit non-goals

- Production migration of pooled development records.
- A supplies, consumables, procurement, or purchase-order module.
- Customer selection or disclosure of internal asset identities.
- Predictive demand or AI profitability forecasting.
- A general dashboard-wide contextual-help rewrite outside affected workflows.
- Offline scanning or label-printer integration unless an existing supported path already satisfies the requirement.
