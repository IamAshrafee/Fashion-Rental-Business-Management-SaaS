# Feature Specification: Serialized Rental Inventory

## Domain rule

Every rentable unit is an exact physical item. SKU and product stock numbers are read-only projections derived from those items; the system never stores an editable anonymous quantity.

The hierarchy is:

`Product → visual variant → rentable SKU/size → physical items`

Catalog setup may exist with zero items. Booking capacity begins only when eligible physical pieces are registered at an operational inventory location.

## Canonical physical-item registration

All entry points use `/dashboard/inventory/items/register`, optionally scoped by product or SKU.

One atomic request registers 1–100 items and supports:

- tenant-unique asset code and optional tenant-unique barcode;
- active storage location;
- shared acquisition defaults with per-row overrides;
- acquisition date, cost, source, and invoice/agreement reference;
- initial condition and notes;
- required set-component initialization;
- idempotent replay and row-addressable validation errors.

Asset code is the permanent business identity. Barcode is an optional scanning aid, not a substitute for identity.

## Physical-item record

Each item stores:

- catalog SKU identity;
- structured current location;
- administrative disposition: active, quarantined, lost, or retired;
- operational state across availability, preparation, rental, return, inspection, cleaning, repair, and transfer;
- condition and component completeness;
- private acquisition and valuation data;
- public condition presentation settings where explicitly enabled;
- immutable links to assignments, movements, inspections, issues, service, transfers, and revenue allocations.

Location changes use a transfer/custody command. Operational state changes use the owning lifecycle workflow. Metadata corrections require a reason and expected item version and preserve before/after evidence.

## Inventory workspaces

### Inventory Overview

Summarizes actual items by location, condition, disposition, and operational state, plus active reservation demand, transfer attention, inspection/service/issue queues, and item-backed economics.

### Stock by SKU

Groups physical items by product/variant/size and location. It shows derived capacity, reservation pressure, and next commitments. There is no stock adjustment field.

### Physical Items

Searches and filters individual assets. Item detail exposes acquisition, condition, components, lifecycle, booking context, service/issues, profitability, history, and valid next actions.

### Locations

Counts reflect current physical-item custody. A location cannot be deactivated while it still owns items or participates in unfinished operational dependencies.

### Transfers

Transfer drafts select exact eligible item IDs at the origin. Ready, dispatch, receipt, partial receipt, damage, loss, cancellation, and reconciliation record an outcome for each identity. Summary quantities are derived from transfer-unit outcomes.

### Stock counts

Counts reconcile observed asset codes/barcodes at one location. The immutable result distinguishes:

- expected and observed items;
- missing items;
- unexpected and wrong-location items;
- duplicate and unknown scans;
- items whose disposition or operational state requires investigation.

Completing a count creates item-specific investigation movements for known discrepancies. It never silently relocates, reactivates, loses, or retires an item.

### Availability controls and movements

Manual date blocks may target a product, variant, SKU, physical item, or location. Service, inspection, and transfer-owned blocks can be resolved only by their owning workflow. Every inventory movement references an exact physical item and relevant source, locations, actor, reason, time, and before/after state.

## Availability and reservation

Capacity at a SKU/location is:

`eligible physical items − overlapping active reservation demand + explicit shortage allowance`

Eligibility excludes blocking disposition/state, date blocks, unresolved issues, missing required components, incompatible condition, transfer state, loss, and retirement. Exact assignment realizes existing reservation demand and is not subtracted a second time.

Reservation creation locks affected SKUs in stable order and rechecks capacity in the booking transaction. Exact assignments use overlap protection so the same item cannot serve two overlapping rentals.

## Fulfilment lifecycle

Every quantity requirement ultimately needs the same number of physical-item assignments. Items are prepared, handed out, returned, inspected, serviced, lost/recovered, and retired by identity. Returns move to awaiting inspection; they do not become immediately available.

## Physical-item economics

Investment recovery uses actual item records rather than a manually chosen rental-count target.

- Acquisition cost belongs to each physical piece.
- Earned rental revenue is allocated to the final handed-out assignments in stable order.
- Integer-minor-unit remainders are distributed deterministically.
- Released or substituted-before-handout items receive no revenue.
- Completed service cost and signed financial adjustments affect net contribution.
- Missing acquisition data is reported as incomplete instead of being treated as zero cost.

Product and SKU reporting aggregates these item-level facts without rewriting original financial allocations.

## Catalog relationship

The product stores customer-facing catalog facts such as country of origin and optional reference retail value. Private acquisition cost, acquisition date, and supplier/reference data belong only to physical items. Publishing a product and registering its items are intentionally separate actions connected by the setup-completion screen.
