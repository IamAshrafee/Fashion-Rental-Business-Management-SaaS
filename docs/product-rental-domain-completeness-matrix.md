# Product and Rental Domain Completeness Matrix

**Audit date:** 2026-08-10

**Design:** `docs/superpowers/specs/2026-08-10-product-rental-domain-completeness-design.md`

**Plan:** `docs/superpowers/plans/2026-08-10-product-rental-domain-completeness.md`

## Status rules

- `COMPLETE`: schema, service, authorized/validated API, typed frontend, discoverable workflow, recovery states, history, and focused verification all exist.
- `PARTIAL`: a real implementation exists, but at least one completeness layer is absent or inconsistent.
- `MISSING`: the scoped operational capability has no usable implementation.
- `OBSOLETE`: an implementation conflicts with the approved authoritative architecture and must be removed.

Evidence is intentionally strict. A model, endpoint, or page alone is not enough for `COMPLETE`.

## Baseline contract decisions

| Contract | Status | Evidence and decision | Closure |
|---|---|---|---|
| Paginated response envelope | COMPLETE | `ResponseTransformInterceptor` emits `{ success, data: T[], meta }`; `PaginatedResponse<T>` matches it; inventory and booking clients consume the top-level envelope. A focused interceptor test locks the shape. | Checkpoint A verification |
| Inventory list client contract | COMPLETE | `inventoryApi.listItems` and `listSkus` return `PaginatedResponse<T>` directly. The previous nested `ApiResponse<PaginatedInventory<T>>` interpretation was incompatible with the global interceptor. | Checkpoint A verification |
| Booking list bound | COMPLETE | DTO validation and the defensive service clamp use the same 250 maximum. Default operational lists remain 20 rows; the existing calendar request for 200 no longer truncates silently. | Replace the large calendar list with a dedicated projection in E1/F3 |
| Inventory list bound | COMPLETE | SKU and item DTOs default to 25 and validate a maximum of 100. Services use validated `page` and `limit`. | Recheck every new list in its checkpoint |
| Shared money unit | PARTIAL | The scoped catalog/inventory/booking work generally uses integer minor units, but older forms and financial modals require a complete boundary audit. | B2, D4, E5, F2 |
| Shared error model | PARTIAL | Nest exceptions and frontend error extraction exist, but conflicts are not consistently discriminated by machine-readable category and affected identity. | B1, C1-C6, D1/D5, E1-E5, F3 |

## Catalog

| Capability | Status | Current evidence | Missing completion layer | Closure task |
|---|---|---|---|---|
| Owner product list | COMPLETE | Server filtering, stable pagination/sorting, typed readiness and inventory projections, URL state, responsive rows, empty/error/loading states, and product service tests exist. | Reconfirm after later contract changes. | B5/F1 |
| Product readiness projection | COMPLETE | `ProductService.evaluateProductReadiness` is the single projection used by list/detail/status commands; blockers carry section, field, and entity identity. Product list/detail show actionable blockers and `product.service.spec.ts` locks publication rejection. | Reconfirm after inventory policy changes. | F1 |
| Idempotent product draft creation | COMPLETE | Tenant-scoped creation key, request matching, resumable created product route, and tests were implemented in Catalog closure. | Reconfirm no secondary create path bypasses it. | B1/F1 |
| Resumable create workflow | COMPLETE | The wizard persists its current section, reopens the server-created product draft, uses a request fingerprint/idempotency key, and exposes draft recovery from `/dashboard/products/new`; create/edit share validated schemas. | Preserve through later form decomposition. | F1 |
| Product editing safety | COMPLETE | Published structure is locked; SKU tracking/identity changes count pools, units, reservations, booking items, requirements, movements, blocks, transfers, set definitions, policies, and composition references before mutation. Conflicts are section-addressable and covered by product/variant tests. | Reconfirm when adding new inventory references. | F2 |
| Publication transition | COMPLETE | `updateStatus` calls `assertPublishReady`; owner controls disable invalid publication and route to the affected section. The transition emits the truthful `product.published` audit fact. | Reconfirm after new readiness rules. | F1 |
| Archive/restore/delete | COMPLETE | Soft delete/restore and restricted permanent delete are tenant-scoped; active/future rentals block trashing and any catalog, pricing, inventory, composition, quote, or review history blocks permanent deletion. Trash/detail workflows expose recovery and audit history. | Reconfirm new history tables join the permanent-delete guard. | F2 |
| Variants and SKUs | COMPLETE | Variant/SKU commands validate tenant, color, resolved size schema, stable identities, published locks, and operational-history locks. `variant.service.spec.ts` covers published and tracking conflicts. | Reconfirm new SKU references in F2. | F2 |
| Categories/subcategories | COMPLETE | Bounded stable owner/guest projections, published-only guest counts, duplicate handling, published-reference deactivation guards, retained-product deletion guards, inactive-parent protection, manager retry states, and focused safety tests exist. | Add global actor attribution in final audit. | F1 |
| Product types | COMPLETE | Bounded stable list, active default-schema enforcement, published dependent-product guard, safe deletion, owner recovery states, and catalog reference tests exist. | Add global actor attribution in final audit. | F1 |
| Size systems | COMPLETE | Tenant-scoped schema/instance/chart APIs, structural locks after SKU use, active/deprecated/reference guards, bounded lists, real add/remove size workflow, and atomic chart replacement exist. `catalog-reference-safety.spec.ts` covers core guards. | Add global actor attribution in final audit. | F1 |
| Events/collections | COMPLETE | Bounded stable owner/guest projections, published-only counts, duplicate conflicts, assignment-preserving deletion guard, deactivation path, owner retry states, and focused tests exist. | Add global actor attribution in final audit. | F1 |
| Pricing profile and versions | COMPLETE | Tenant-bound versioned profiles and policies are authoritative; controller persistence moved into the service, dates and money configs are validated, storefront/cart pricing comes only from backend validation/quote results, and pricing tests cover tenant and retail-value boundaries. | Manual booking must bind a fresh quote identity. | D1 |
| Deposits, fees, services, late fees | PARTIAL | Typed bounded component/policy configuration and backend-authoritative storefront totals are complete; booking summary now preserves bundle adjustments. | Manual payment/deposit settlement still needs idempotent balance invariants. | D4/E5 |
| Product media | COMPLETE | Tenant-scoped final object keys, entity ownership validation, safe replacement/deletion, last-image protection, stable featured ordering, computed accessible storefront alt text, and upload/product tests exist. Public exposure occurs only through published product projections. | Reconfirm item evidence visibility in C5/E4. | C5/E4 |
| Composition and add-ons | PARTIAL | Draft-only edits, public published filtering, recursive cycle/depth prevention, SKU/product ownership, role/pricing/default/duplicate validation, bounded money/quantity inputs, honest notes-only compatibility, backend totals, owner recovery, and focused tests exist. | Runtime substitution approval/evidence and full requirement history close with fulfillment. | E3 |
| Product contextual navigation | COMPLETE | Product detail exposes edit/pricing data, composition, inventory, and a product-ID-filtered audit trail; mobile overflow contains the same operational destinations and readiness blockers deep-link to the affected editor. | Reconfirm role visibility in final UX audit. | F1 |

## Inventory

| Capability | Status | Current evidence | Missing completion layer | Closure task |
|---|---|---|---|---|
| New-tenant inventory foundation | COMPLETE | Registration creates default location, default availability policy, size systems, and product types; PostgreSQL integration coverage exists. | Reconfirm after schema changes. | F2/F4 |
| Inventory overview | PARTIAL | Consolidated overview exposes locations, pooled/serialized summaries, reservations, transfers, work queues, low stock, condition, and economics. | Every attention count does not yet link to a complete filtered workspace; some aggregates are capped/live-heavy. | C7/F3 |
| Stock by SKU | PARTIAL | Location-aware pooled/serialized projection, URL filters, pagination, mobile rows, and integration coverage exist. | Pooled commands, next-pressure context, movement/count actions, and full index review remain. | C1/C2/C8 |
| Physical-item list | PARTIAL | Paginated global list, filters, rental metrics, open-work counts, registration, and item-detail links exist. | Product/SKU, issue/service, component-completeness, date-availability filters, batch registration, and last/next activity remain. | C4/C5/C6 |
| Single physical-item registration | PARTIAL | SKU/location-scoped command and global dialog exist. | Idempotency fingerprint, generated identity preview, component initialization, and focused conflict tests need audit. | C4 |
| Batch physical-item registration | MISSING | No atomic batch DTO/command/preview is exposed in the global workflow. | Entire capability. | C4 |
| Physical-item lifecycle | PARTIAL | State/disposition commands, guarded transitions, movement/lifecycle history, and item detail exist. | Global discoverability, conflict normalization, and complete transition tests remain. | C5/C6/F1 |
| Set component definitions/state | PARTIAL | Definitions, per-unit component states, inspection checks, and item UI exist. | Global completeness filters, bundle linkage audit, and missing-component queue remain. | C5 |
| Inventory locations | PARTIAL | Location CRUD/default/capabilities and owner page exist. | Deactivation guards, optimistic conflict handling, pagination/history, and complete tests need closure. | C3/C7 |
| Location pools | PARTIAL | Unique SKU/location pools, quantity/version fields, location views, and availability integration exist. | Final command semantics and reconstruction from movements need closure. | C1/C2 |
| Pooled adjustments | PARTIAL | `setPoolQuantity` records a reason through the pool service. | Separate receive/add/subtract/write-off/count commands, explicit effect preview, stale-version response, and committed-demand guards need closure. | C1 |
| Stock counts | MISSING | No global count aggregate, count record workflow, or reconciliation workspace is exposed. | Entire capability. | C1/C2 |
| Movement history | PARTIAL | Immutable movement model and SKU-scoped endpoint exist. | Global paginated query, filters, source links, reconstruction evidence, and owner route are missing. | C2 |
| Availability policy inheritance | PARTIAL | Tenant/location/product/SKU scopes and resolver exist; owner location page edits policies. | Normalized inherited view, stale editing, dedicated discoverability, and focused inheritance tests need closure. | C3 |
| Blocks and blackouts | PARTIAL | Inventory block commands and availability subtraction exist. | Dedicated scoped UI, ownership protection, conflict preview, filters/history, and constraint audit remain. | C3 |
| Availability calculation | PARTIAL | Location-aware pooled/serialized capacity, blocked ranges, policies, reservations, assignments, transfers, and bundle planning exist with unit tests. | Timezone boundaries, next-available guidance, cache/public contract, and full concurrency matrix remain. | C3/D1/F2 |
| Transfers | PARTIAL | Draft, ready, dispatch, receipt, cancel, pooled/serialized lines, partial outcomes, owner workspace, and tests exist. | Reconciliation workflow, overdue attention, immutable timeline UX, and booking-vs-transfer concurrency need closure. | C7/C8 |
| Return/pre-rental inspections | PARTIAL | Draft/complete commands, checks, issues, media, decisions, lifecycle integration, item UI, and tests exist. | Global paginated queue, filters, next-action projection, and full booking linkage remain. | C5/E4 |
| Issues and responsibility | PARTIAL | Issue creation/resolution, severity, responsibility, costs, media, service links, and item UI exist. | Global queue, waiver/permission audit, deposit linkage, and paginated history remain. | C5/E5 |
| Cleaning/washing/repair/service | PARTIAL | Service-order create/start/complete/cancel, blocking state, cost, media, and item UI exist. | Global queue, overdue handling, provider/location filters, and return-to-availability audit remain. | C6/E5 |
| Inventory operations summary | PARTIAL | `/owner/inventory/operations` returns up to 100 open inspections, service orders, and issues; Operations page consumes it. | It is an unpaginated capped combined list and cannot replace dedicated workspaces. | C5/C6/C7 |
| Condition, loss, quarantine, retirement | PARTIAL | Disposition/state/condition models and guarded item commands exist. | Global exception filters, valuation effects, authorization, and end-to-end rental tests remain. | C5/C6/E3/F2 |
| Inventory audit/history visibility | PARTIAL | Item lifecycle, movements, inspections, issues, service orders, and transfer events retain history. | Global bounded access and consistent source linking are incomplete. | C2/C5/C6/C7 |

## Rentals, fulfillment, and return

| Capability | Status | Current evidence | Missing completion layer | Closure task |
|---|---|---|---|---|
| Booking list pagination contract | COMPLETE | Global pagination envelope, typed client, stable server sorting, URL state, responsive rows, and a single 250 maximum now align. | Dedicated calendar projection still replaces high-limit nested list use. | E1/F3 |
| Booking operational queues | PARTIAL | Review, assignment, handoff, active, return/inspection, overdue, and closed URL queues exist. | Preparation, return-due/intake, exception dimensions, independent counts, location/handover/deposit projections, and complete tests remain. | E1 |
| Rental calendar | PARTIAL | Three-month overlap query and responsive calendar exist. | It depends on the full booking-list projection, caps at 250, and can still truncate busy tenants without notice. | E1/F3 |
| Manual customer/contact stage | PARTIAL | Customer search/create and delivery fields exist in the manual form. | Decomposition, validation recovery, and explicit stage contract need closure. | D3 |
| Manual rental plan | MISSING | Dates are currently item-centric; no complete location/handover planning stage exists. | Entire authoritative planning stage. | D2/D3 |
| Manual item/bundle selection | PARTIAL | Product search, SKU selection, availability checks, bundle selections, and cart validation exist. | Location-aware planning, freshness invalidation, stale-line recovery, and focused state tests remain. | D2/D3/D5 |
| Authoritative quote identity/freshness | PARTIAL | Pricing engine persists quote records and returns quote identity for its quote endpoint. Manual booking validation returns calculations. | Manual booking does not yet require/compare a quote/version/hash through atomic creation. | D1 |
| Manual price/payment/review stages | PARTIAL | Discounts, overrides, initial payment, totals, notes, review, idempotent create, and local draft persistence exist. | Backend-authoritative quote integration, permission/reason bounds, decomposition, and conflict recovery remain. | D3/D4/D5 |
| Booking creation idempotency | COMPLETE | Tenant-scoped creation key plus canonical SHA-256 request fingerprint returns a matching prior booking and rejects changed reuse; unit/DB tests exist. | Preserve through quote contract changes. | D1/D6 |
| Atomic booking availability | PARTIAL | Requirement expansion, deterministic SKU locks, validation, reservations, and creation use a serializable transaction. | Quote freshness comparison, full location/handover plan, and additional pooled/bundle concurrency tests remain. | D1/D2/D6 |
| Payment recording | PARTIAL | Payment APIs, history, initial payment, and owner modals exist. | Unified idempotency, typed conflicts, permission limits, minor-unit audit, and overpayment tests remain. | D4/E5 |
| Deposit settlement | PARTIAL | Deposit modal/actions and damage context exist. | Held-balance invariants, idempotency, double-settlement prevention, and operational close guard need closure. | D4/E5 |
| Fulfillment requirements | PARTIAL | Simple items, bundle components, alternatives, add-ons, reservations, versions, events, and booking detail cards exist. | Complete blocker/next-action projection and global queue dimensions remain. | E1/E6 |
| Serialized assignment | PARTIAL | Date/location eligibility, exact assignment/release, overlap constraint, booking UI, and concurrency coverage exist. | Preparation policy, bulk-safe queue workflow, conflict normalization, and full tenant tests remain. | E2/E7 |
| Pooled reservation/fulfillment | PARTIAL | Quantity reservation and handout/return counters exist without fake identities. | Return-to-capacity policy, adjustments during active rentals, and complete concurrency tests remain. | E2/E4/E7 |
| Substitution | PARTIAL | Controlled requirement substitution, alternatives, approval state, price impact, version/event history, and UI exist. | Complete compatibility enforcement, quote impact, customer approval evidence, and concurrency tests remain. | E3 |
| Rental extension | PARTIAL | All requirements can be replanned atomically and conflicts roll back. | Owner recovery UX, overdue interaction, location/transfer implications, and PostgreSQL tests remain. | E3 |
| Preparation and handout | PARTIAL | Requirement events and exact assignment handout exist; booking delivery guard requires complete handout. | Explicit preparation facts/queue, conditional pre-rental inspection, and handoff context remain. | E1/E2 |
| Active rental and overdue | PARTIAL | Delivered/overdue booking states, late-fee calculation, counters, and queues exist. | Date-derived exception projection, unresolved-component detail, extension/loss workflow, and end-to-end tests remain. | E1/E3 |
| Return and loss intake | PARTIAL | Partial pooled/serialized return/loss events, released assignments, item state transitions, and booking return guard exist. | Dedicated intake queue, exact recovery UX, financial linkage, and concurrency/idempotency tests remain. | E1/E3/E4 |
| Return inspection bridge | COMPLETE | Released returned assignments remain visible until a return inspection is created; booking inspect/complete guards require every returned physical item inspection; focused tests exist. | Preserve while building global queues and settlement. | C5/E4/E7 |
| Damage reporting | PARTIAL | Booking damage report and stock-unit issue linkage fields exist; inspection issues support evidence and responsibility. | One guided evidence flow, exact-item requirement, charge suggestion, and deposit linkage need closure. | E4/E5 |
| Service follow-up after return | PARTIAL | Inspection decisions can create service work and block the unit; item-level service commands exist. | Global queue, booking close policy, overdue work, and end-to-end tests remain. | C6/E5 |
| Booking status derivation/guards | PARTIAL | Confirmation, delivery, return, inspection, completion, cancellation, and overdue transitions use fulfillment guards in key states; UI buttons are gated by requirements. | Remaining manual state paths, financial close policy, and fact-derived queue/status audit remain. | E1-E5 |
| Booking detail organization | PARTIAL | Commercial detail, payment, totals, fulfillment, item assignment, actions, notes, timeline, and delivery card exist. | Clearer layer boundaries, stale refresh, complete blockers, return/service links, and mobile action audit remain. | E6 |
| Booking audit/history | PARTIAL | Booking timestamps, requirement events/versions/substitutions, payments, notes, damage, and item histories exist. | One bounded unified operational timeline and consistent actor/reason display remain. | E6/F1 |

## Final audit requirements

Checkpoint F cannot complete while any matrix row remains `PARTIAL`, `MISSING`, or an unexplained `OBSOLETE`. When a capability is completed, replace its gap with exact evidence: test name, endpoint/command, frontend route, recovery behavior, and history source. If the audit proves a capability is outside the approved boundary, move it to the design's explicit exclusions rather than silently deleting the row.
