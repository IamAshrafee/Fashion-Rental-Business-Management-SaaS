# Serialized Inventory Cutover Checklist

**Source design:** `docs/superpowers/specs/2026-08-12-serialized-rental-inventory-and-product-lifecycle-design.md`

**Implementation plan:** `docs/superpowers/plans/2026-08-12-serialized-rental-inventory-and-product-lifecycle.md`

**Status values:** `PENDING`, `IN PROGRESS`, `COMPLETE`

This checklist tracks every live hybrid-inventory contract that must be removed or replaced. A row becomes `COMPLETE` only when its schema/service/API/UI/test or documentation evidence uses physical-item identity exclusively.

## Protected worktree

| Path | Rule |
|---|---|
| `apps/frontend/src/app/(owner)/dashboard/customers/[id]/page.tsx` | Existing user change. Do not edit or stage. |
| `apps/frontend/src/app/(owner)/dashboard/customers/page.tsx` | Existing user change. Do not edit or stage. |

## Database and seed

| Contract | Current evidence | Replacement checkpoint | Status |
|---|---|---|---|
| Inventory tracking enum | `schema.prisma:InventoryTrackingMode` | B1 | PENDING |
| Transfer line kind enum | `schema.prisma:InventoryTransferLineKind` | B1 | PENDING |
| Pooled movement types | `schema.prisma:InventoryMovementType` | B1 | PENDING |
| SKU tracking mode | `VariantSize.trackingMode` | B1 | PENDING |
| Inventory pools | `InventoryPool` and relations | B1 | PENDING |
| Pool reservation reference | `InventoryReservation.inventoryPoolId` | B1 | PENDING |
| Preferred physical-item reservation | `InventoryReservation.preferredStockUnitId` | B1/B6 | PENDING |
| Tracking snapshot | `FulfillmentRequirement.trackingModeSnapshot` | B1 | PENDING |
| Pool/quantity blocks | `InventoryBlock.inventoryPoolId`, `quantity` | B1 | PENDING |
| Hybrid transfer line | `InventoryTransferLine.lineKind`, pool and quantity fields | B1/B5 | PENDING |
| Anonymous movements | `InventoryMovement.inventoryPoolId`, `quantityDelta` | B1/B4 | PENDING |
| Product purchase fields | `Product.purchaseDate`, `purchasePrice`, `purchasePricePublic` | B1 | PENDING |
| Product target rentals | `Product.targetRentals` | B1 | PENDING |
| Ambiguous item country field | `Product.itemCountry`, `itemCountryPublic` | B1/B3 | PENDING |
| Physical-item acquisition naming | `StockUnit.purchaseDate`, `purchasePrice` | B1/B4 | PENDING |
| Acquisition source/reference | Missing on `StockUnit` | B1/D1 | PENDING |
| Item revenue attribution | Requirement-level allocation only | B1/B7 | PENDING |
| Single clean baseline | `20260803200000_complete_saas_baseline/migration.sql` | B1/H3 | PENDING |
| Deterministic serialized seed | `apps/backend/prisma/seed.ts` | B1/H3 | PENDING |
| Tenant middleware pool registration | `tenant-isolation.middleware.ts` | B1 | PENDING |

## Catalog backend

| Contract | Current evidence | Replacement checkpoint | Status |
|---|---|---|---|
| Product create/update purchase/target DTOs | `product.dto.ts`, `product-onboarding.dto.ts` | B2/B3 | PENDING |
| SKU tracking selection DTO | onboarding/variant DTOs | B2/B3 | PENDING |
| Opening inventory DTO | `SaveOpeningInventoryDto` | B2/B3 | PENDING |
| Opening inventory controller | `PUT product-onboardings/:id/opening-inventory` | B3 | PENDING |
| Opening inventory service | `recordOpeningInventory` | B3 | PENDING |
| Opening inventory readiness dependency | onboarding section order/publish | B3 | PENDING |
| Tracking mode change guard | `variant.service.ts`, onboarding service | B3 | PENDING |
| Product list tracking filters/projection | `product.service.ts` | B3 | PENDING |
| Product purchase/target detail projection | `product.service.ts` | B3 | PENDING |
| Zero-stock publication | readiness and onboarding tests | B3/C4 | PENDING |
| Safe SKU identity editing | variant/product services | B3/C3 | PENDING |
| Draft-only hard deletion | product/variant services | B3/C3 | PENDING |
| Product onboarding integration | `product-onboarding.integration-spec.ts` | B3/C4 | PENDING |

## Inventory backend

| Contract | Current evidence | Replacement checkpoint | Status |
|---|---|---|---|
| Pool service/provider | `inventory-pool.service.ts`, `inventory.module.ts` | B4 | PENDING |
| Pool endpoints | inventory foundation controller | B2/B4 | PENDING |
| Pool adjustment/count DTOs | inventory foundation DTO | B2/B4 | PENDING |
| Hybrid availability | `inventory-availability.service.ts` | B4 | PENDING |
| Hybrid reservation creation | `inventory-reservation.service.ts` | B4 | PENDING |
| Conditional assignment | `inventory-assignment.service.ts` | B4 | PENDING |
| Pool/quantity blocks | block service/DTO | B2/B4 | PENDING |
| Pool ledger entries | `inventory-ledger.service.ts` | B4 | PENDING |
| Pool location deactivation guard | `inventory-location.service.ts` | B4 | PENDING |
| Hybrid overview/SKU projection | `inventory-dashboard.service.ts` | B4/E1 | PENDING |
| Hybrid product inventory projection | `inventory-management.service.ts` | B4/E5 | PENDING |
| Duplicate single-item registration | inventory controller/service | D1 | PENDING |
| Atomic canonical registration | batch endpoint/service | D1 | PENDING |
| Audited acquisition correction | generic stock-unit patch | D1/E2 | PENDING |
| Quantity stock counts | foundation services/contracts | B4/E3 | PENDING |
| Item-only movement invariant | schema and ledger services | B1/B4 | PENDING |

## Transfers, fulfilment, and booking backend

| Contract | Current evidence | Replacement checkpoint | Status |
|---|---|---|---|
| Pooled transfer branches | transfer DTO/service/spec | B5 | PENDING |
| Stored transfer quantities | `InventoryTransferLine` fields | B1/B5 | PENDING |
| Exact transfer unit outcomes | transfer unit service/spec | B5 | PENDING |
| Pooled fulfilment branches | `fulfillment.service.ts` | B6 | PENDING |
| Pooled loss reconciliation | fulfilment service/spec | B6 | PENDING |
| Tracking snapshots in booking responses | booking/fulfilment DTOs and clients | B2/B6 | PENDING |
| Preferred-item storefront/cart behavior | storefront cart and availability | B6/F1 | PENDING |
| SKU capacity concurrency | reservation locks/integration test | B4/B6 | PENDING |
| Exact assignment overlap concurrency | assignment/integration test | B6 | PENDING |
| Deterministic revenue allocation | missing item allocation model/service | B7 | PENDING |
| Refund/correction attribution | missing signed adjustment flow | B7 | PENDING |

## Analytics backend

| Contract | Current evidence | Replacement checkpoint | Status |
|---|---|---|---|
| Product purchase-price recovery | `analytics.service.ts` | B7/F3 | PENDING |
| Product target progress | product detail UI/projection | B7/F3 | PENDING |
| Item acquisition aggregates | inventory dashboard | B7/F3 | PENDING |
| Item revenue allocation aggregates | missing | B7/F3 | PENDING |
| Recorded service cost aggregates | service order cost | B7/F3 | PENDING |
| Incomplete-input reporting | current missing-cost behavior | B7/F3 | PENDING |

## Frontend API contracts

| Contract | Current evidence | Replacement checkpoint | Status |
|---|---|---|---|
| Product tracking and pooled onboarding types | `lib/api/products.ts` | B8 | PENDING |
| Product purchase/target types | `lib/api/products.ts` | B8 | PENDING |
| Inventory pools/tracking types | `lib/api/inventory.ts` | B8 | PENDING |
| Pool blocks and transfers | `lib/api/inventory.ts` | B8 | PENDING |
| Booking tracking snapshots | `lib/api/bookings.ts` | B8 | PENDING |
| Fulfilment tracking responses | `lib/api/fulfillment.ts` | B8 | PENDING |
| Guest tracking/item selection | `lib/api/guest-products.ts` | B8/F1 | PENDING |
| Profitability response | `lib/api/analytics.ts` | B8/F3 | PENDING |
| Canonical registration API | inventory API | D1/D2 | PENDING |

## Catalog frontend

| Contract | Current evidence | Replacement checkpoint | Status |
|---|---|---|---|
| Six-stage wizard | product form index/layout | C1 | PENDING |
| Media separated from variants | variants/content steps | C1 | PENDING |
| Opening inventory stage | `steps/opening-inventory.tsx` | C1 | PENDING |
| Tracking selector/default | variants step/schema | C1 | PENDING |
| Product purchase fields | basic info/schema/review | C1 | PENDING |
| Target rentals field | basic info/schema/review | C1 | PENDING |
| First-stage status selector | basic info | C1 | PENDING |
| Completion actions | missing route | C2 | PENDING |
| Tabbed safe editing | edit form/hooks | C3 | PENDING |
| Product tracking filters/badges | catalog toolbar/table | C3 | PENDING |
| Product detail purchase/target UI | product detail | C3/F3 | PENDING |

## Inventory frontend

| Contract | Current evidence | Replacement checkpoint | Status |
|---|---|---|---|
| Registration dialog | `register-item-dialog.tsx` | D2 | PENDING |
| Canonical registration route | missing | D2 | PENDING |
| Registration entry-point convergence | items/stock/product/setup pages | D3 | PENDING |
| Overview hybrid totals | inventory overview | E1 | PENDING |
| Stock tracking filter/badge | Stock by SKU | E1 | PENDING |
| Physical-item acquisition correction | item detail | E2 | PENDING |
| Pooled location totals | locations | E3 | PENDING |
| Hybrid transfer builder | transfers | E3 | PENDING |
| Quantity counts | counts | E3 | PENDING |
| Pool block target | availability | E4 | PENDING |
| Pool movements | movement ledger | E4 | PENDING |
| Product pooled adjustment UI | product inventory | E5 | PENDING |
| Inspection/service exact-item queues | inspections/service | E5 | PENDING |

## Storefront, booking, and profitability frontend

| Contract | Current evidence | Replacement checkpoint | Status |
|---|---|---|---|
| Public tracking mode | guest product types/views | F1 | PENDING |
| Public preferred item | guest availability/cart | F1 | PENDING |
| Conditional assignment UI | booking assignments | F2 | PENDING |
| Pooled fulfilment copy/actions | booking detail/actions | F2 | PENDING |
| Manual booking tracking branches | manual booking form | F2 | PENDING |
| Target Rentals progress | product detail | F3 | PENDING |
| Product purchase-cost display | product detail | F3 | PENDING |
| Item/SKU/product recovery view | missing/partial analytics | F3 | PENDING |

## Contextual help

| Contract | Current evidence | Replacement checkpoint | Status |
|---|---|---|---|
| Hover-only/unfocusable help | `components/shared/field-tip.tsx` | G1 | PENDING |
| Typed help registry | missing | G1/G2 | PENDING |
| Catalog help coverage | scattered Basic/Variants tips | G2/G3 | PENDING |
| Inventory help coverage | mostly missing | G2/G3 | PENDING |
| Booking-assignment help coverage | mostly missing | G2/G3 | PENDING |
| Obsolete pooled/purchase/target help | existing field tips/copy | G3 | PENDING |
| Interaction accessibility tests | missing frontend test runner | G4 | PENDING |

## Documentation and final evidence

| Contract | Current evidence | Replacement checkpoint | Status |
|---|---|---|---|
| Add-product flow/UI | old eight-stage docs | H1 | PENDING |
| Edit-product UI | old form assumptions | H1 | PENDING |
| Stock inventory feature | hybrid docs | H1 | PENDING |
| Availability feature | hybrid docs | H1 | PENDING |
| Booking feature/API | tracking snapshots | H1 | PENDING |
| Product/inventory API docs | purchase/pool examples | H1 | PENDING |
| Product database docs | purchase/target columns | H1 | PENDING |
| Target tracking feature | obsolete standalone spec | H1 | PENDING |
| Domain completeness matrix | hybrid rows | H1 | PENDING |
| Repository removal search | live references currently present | H2 | PENDING |
| Fresh baseline migrate/seed twice | not yet verified | H3 | PENDING |
| Backend unit/integration suite | not yet verified | H3 | PENDING |
| Types/backend/frontend builds | not yet verified | H3 | PENDING |
| Final acceptance workflow smoke | not yet verified | H4 | PENDING |
