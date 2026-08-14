# Serialized Inventory Cutover Evidence

**Completed:** 2026-08-15

**Source design:** `docs/superpowers/specs/2026-08-12-serialized-rental-inventory-and-product-lifecycle-design.md`

**Implementation plan:** `docs/superpowers/plans/2026-08-12-serialized-rental-inventory-and-product-lifecycle.md`

This is the closure record for replacing the former hybrid quantity/item model. `COMPLETE` means the live schema, service, API, UI, documentation, and focused verification use exact physical-item identity. The old concepts below are named only as removal evidence.

## Protected worktree

These pre-existing user changes were preserved and excluded from every cutover commit:

| Path                                                              | Rule                  |
| ----------------------------------------------------------------- | --------------------- |
| `apps/frontend/src/app/(owner)/dashboard/customers/[id]/page.tsx` | Do not edit or stage. |
| `apps/frontend/src/app/(owner)/dashboard/customers/page.tsx`      | Do not edit or stage. |

## Domain and database

| Contract                                  | Status   | Closure evidence                                                                                                                                                                      |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Serialized-only inventory                 | COMPLETE | Tracking-mode enums/columns and inventory-pool tables/relations are absent. Every rentable piece is a `StockUnit` with a tenant-scoped asset code.                                    |
| Exact availability and reservation demand | COMPLETE | Availability counts eligible stock units and subtracts reservation demand once; assignments are identities fulfilling that demand, not a second capacity subtraction.                 |
| Exact assignments and overlap prevention  | COMPLETE | Assignments always identify a stock unit. PostgreSQL GiST exclusion constraint `stock_unit_assignments_no_overlap` prevents date overlap for the same active item.                    |
| Exact transfers, blocks, and movements    | COMPLETE | Transfer lines and blocks target item identities; every inventory movement has a stock unit and a one-item invariant.                                                                 |
| Physical-item acquisition data            | COMPLETE | Acquisition date, cost, source, and reference live on `StockUnit`; product-level commercial reference value remains a separate catalog fact.                                          |
| Physical-item revenue attribution         | COMPLETE | Booking completion creates deterministic `RENTAL_REVENUE` rows per assignment. Signed, idempotent `ADJUSTMENT` rows preserve refund/correction history without rewriting originals.   |
| Identity-based stock counts               | COMPLETE | Count sessions retain raw observations and expected/observed item findings, including duplicates, unknowns, missing items, unexpected items, wrong locations, and state-review flags. |
| Clean baseline and seed                   | COMPLETE | The single baseline migration applies to an empty PostgreSQL database; deterministic seed succeeds twice without duplicate system data.                                               |
| Tenant isolation registration             | COMPLETE | All new serialized inventory and count models are tenant-scoped and registered with tenant isolation.                                                                                 |

## Product lifecycle

| Contract                         | Status   | Closure evidence                                                                                                                                          |
| -------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Five-stage onboarding            | COMPLETE | Basics/sizing; variants, SKUs, and images; details/FAQ; pricing/services; review/publish. Inventory is no longer an onboarding section.                   |
| Catalog/internal fact separation | COMPLETE | Country of origin and reference retail value are catalog facts. Acquisition facts are entered only while registering or correcting physical items.        |
| Zero-stock publication           | COMPLETE | A complete listing can publish with zero items and appears unavailable until identities are registered. `product-readiness.spec.ts` locks this rule.      |
| Publication lifecycle            | COMPLETE | Draft saving is distinct from publication. Publishing uses readiness checks; archive has an explicit confirmation and retains operational history.        |
| Safe editing                     | COMPLETE | Create and edit share contracts; published structural changes are guarded when referenced by inventory, rental, pricing, composition, or history records. |
| Completion handoff               | COMPLETE | Setup completion offers direct, product/SKU-prefilled physical-item registration without duplicating registration logic.                                  |

## Operational backend

| Contract                      | Status   | Closure evidence                                                                                                                                                     |
| ----------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical registration        | COMPLETE | One atomic batch command creates one record per physical identity, validates duplicates and component completeness, and safely replays an identical idempotency key. |
| Audited item correction       | COMPLETE | Item correction uses optimistic versioning and records before/after acquisition and identity changes in the movement ledger.                                         |
| Exact fulfilment              | COMPLETE | Booking assignment, preparation, handout, return, inspection, loss, service, and release flows use stock-unit assignments.                                           |
| Serialized transfers          | COMPLETE | Transfer drafts, dispatch, receipt, discrepancies, and history operate on exact item IDs.                                                                            |
| Serialized inventory overview | COMPLETE | Overview, items, stock by SKU, locations, availability, movements, and product inventory derive counts from physical items.                                          |
| Physical-item economics       | COMPLETE | Analytics aggregates item acquisition cost, attributed revenue, and recorded service cost; incomplete inputs remain explicit instead of being estimated.             |

## Frontend and help

| Contract                       | Status   | Closure evidence                                                                                                                                                  |
| ------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical item registration UI | COMPLETE | Dedicated registration route is reused from inventory, SKU, product inventory, and setup-complete entry points.                                                   |
| Item correction UI             | COMPLETE | Product item detail exposes guarded acquisition/identity corrections and exact operational history.                                                               |
| Identity count workspace       | COMPLETE | Counts page accepts scans, explains reconciliation, and exposes session findings/history.                                                                         |
| Storefront behavior            | COMPLETE | Guest product, cart, and checkout use quantity/date availability without exposing internal identities or acquisition facts.                                       |
| Booking assignment UI          | COMPLETE | Staff assign exact available pieces and see identity-specific fulfilment actions and history.                                                                     |
| Cost-recovery analytics        | COMPLETE | The obsolete rental-count target is replaced by physical-item cost recovery derived from actual acquisition, revenue, and service records.                        |
| Accessible contextual help     | COMPLETE | Typed help registry plus `ContextHelp` provides click, touch, keyboard, focus, screen-reader text, and examples. Component tests cover interaction accessibility. |

## Removal and verification

| Gate                         | Status   | Evidence                                                                                                                                                                                                                                                                       |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Live-code removal search     | COMPLETE | No live schema/API/UI/docs reference remains for inventory pools, pooled quantity, tracking modes, preferred-item reservations, opening inventory, product purchase facts, or rental-count targets. Current design/plan retain those terms only to document removal decisions. |
| Superseded design removal    | COMPLETE | Hybrid and rental-target plan/spec files were removed; the current serialized design and plan are authoritative.                                                                                                                                                               |
| Fresh database verification  | COMPLETE | Empty database migration and two consecutive seeds succeeded; baseline contains count tables and stock-unit versioning and contains no pool table.                                                                                                                             |
| Focused backend verification | COMPLETE | Unit and PostgreSQL integration coverage exercise registration, counts, availability, transfers, exact revenue allocation/adjustment, lifecycle behavior, and zero-stock readiness.                                                                                            |
| Frontend verification        | COMPLETE | Context-help component tests and the production frontend build cover the changed owner/storefront contracts.                                                                                                                                                                   |
| Type and production builds   | COMPLETE | Shared types, NestJS backend, and Next.js frontend production builds pass.                                                                                                                                                                                                     |

## Final invariants

- One rentable physical piece equals one stock-unit identity.
- A SKU may exist with zero stock; it never implies anonymous capacity.
- Inventory is registered after catalog setup and corrected only through the canonical item workflow.
- Reservations express demand; assignments identify the exact pieces fulfilling that demand.
- Acquisition and operational history belongs to physical items.
- Financial corrections append signed rows and never rewrite earned-revenue attribution.
- Published zero-stock products remain truthful and unavailable.
