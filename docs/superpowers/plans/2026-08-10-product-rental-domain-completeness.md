# Product and Rental Domain Completeness Implementation Plan

**Date:** 2026-08-10

**Design:** `docs/superpowers/specs/2026-08-10-product-rental-domain-completeness-design.md`

**Strategy:** Close the domain through verified vertical slices. Each checkpoint starts from authoritative database and service behavior, completes the typed owner workflow, and ends with focused automated verification. Browser and visual verification are excluded by project direction.

## Execution rules

- Preserve the existing uncommitted edits in `apps/backend/src/modules/booking/dto/booking.dto.ts` and `apps/frontend/src/lib/api/inventory.ts`. Reconcile them through tests and the final pagination contract; never overwrite or stage them accidentally.
- Do not introduce compatibility fields, fallback calculations, fake queue data, or duplicate APIs.
- Treat historical booking, pricing, movement, assignment, inspection, issue, and service records as immutable operational evidence.
- Keep every checkpoint compilable and independently testable.
- Use `apply_patch` for source edits and stage only files belonging to the active checkpoint.
- Do not reset the development database. Verify schema changes against a disposable empty PostgreSQL database first.
- Use integer minor units for money and explicit tenant/location timezone boundaries for business dates.
- A frontend control is not complete without an authorized, validated, tenant-scoped backend contract.
- A backend capability is not complete without a discoverable owner entry point and recovery states.

## Checkpoint A — Capability and contract audit

### Task A1: Establish the protected baseline

Primary files:

- `apps/backend/src/modules/booking/dto/booking.dto.ts`
- `apps/frontend/src/lib/api/inventory.ts`
- `apps/backend/package.json`
- `apps/frontend/package.json`
- `apps/backend/prisma/schema.prisma`

Actions:

- Record the two pre-existing worktree diffs and their intended contract effects.
- Resolve the booking-list maximum mismatch: DTO validation, service clamp, frontend options, and tests must use one bounded limit.
- Verify whether inventory list endpoints return the project `ApiResponse` envelope or a direct `PaginatedResponse`; keep one response shape across backend controllers, clients, hooks, and pages.
- Record baseline build/test commands and current unrelated warnings without modifying unrelated files.
- Confirm the single clean migration remains the only migration source.

Verification:

- `git diff --check`
- Prisma schema validation and generation.
- Backend type/build check.
- Frontend TypeScript check.
- Focused contract calls through unit mocks or integration tests, not a browser.

### Task A2: Build the completeness matrix

Create:

- `docs/product-rental-domain-completeness-matrix.md`

For each capability, record:

1. schema model, constraints, and indexes;
2. tenant-scoped service/query/command;
3. authorized controller and validated DTO;
4. typed frontend API;
5. discoverable route or contextual entry point;
6. loading, empty, validation, permission, conflict, and retry behavior;
7. audit/history visibility;
8. automated verification.

Matrix rows must include:

- catalog list/readiness/draft/edit/publish/archive;
- variants, SKUs, tracking mode, pricing, media, categories, types, sizing, events;
- composition, required components, alternatives, optional add-ons;
- inventory overview, pools, physical items, locations, transfers;
- pooled adjustments, counts, movements, policies, blocks, blackouts;
- inspections, issues, set completeness, service orders, lifecycle;
- booking lists/queues, manual creation, availability, quote freshness;
- reservation, assignment, substitution, extension, handout, return, loss;
- damage, deposit/payment settlement, overdue, cancellation, completion.

Classify every row as `COMPLETE`, `PARTIAL`, `MISSING`, or `OBSOLETE`. Every non-complete row must name the exact checkpoint and task that closes it. Do not accept a filename or model alone as evidence of completion.

### Task A3: Remove confirmed dead ends from the plan

- Search scoped backend and frontend code for obsolete fields, routes, comments, fallbacks, hard-coded list limits, client-side authoritative calculations, and unbounded nested queries.
- Identify routes that exist but are not reachable from owner navigation or a relevant detail page.
- Identify buttons whose backend command rejects the state the UI presents as valid.
- Identify backend capabilities with no global operational queue.
- Amend this plan only when the audit proves a task is already complete or reveals a required dependency. Keep the approved completion boundary unchanged.

### Task A4: Checkpoint verification and commit

- Review the matrix for missing rows and vague evidence.
- Run baseline builds/tests after resolving only the pagination contract collision.
- Commit the audit/matrix and explicitly reconciled contract edits without staging unrelated changes.

## Checkpoint B — Catalog closure

### Task B1: Publication readiness and safe editing

Primary files:

- `apps/backend/src/modules/product/product.service.ts`
- `apps/backend/src/modules/product/dto/product.dto.ts`
- `apps/backend/src/modules/product/product.controller.ts`
- `apps/backend/src/modules/product/product.service.spec.ts`
- `apps/frontend/src/lib/api/products.ts`
- `apps/frontend/src/app/(owner)/dashboard/products/**`

Actions:

- Audit the readiness projection against catalog identity, variant/SKU validity, SKU identity, tracking mode, pricing profile, required media, composition validity, and inventory source.
- Make publication call one authoritative backend readiness validator and return section/field blockers.
- Reject unsafe tracking-mode or SKU changes when inventory, reservations, fulfillment requirements, or relevant history exists.
- Ensure draft creation remains idempotent and resumes one product ID after refresh or retry.
- Ensure published edits cannot silently invalidate active rental obligations.
- Add or correct tests for readiness, publish rejection, safe editing, idempotent create retry, and tenant scope.

### Task B2: Pricing and service authority

Primary files:

- `apps/backend/src/modules/pricing-engine/**`
- `apps/backend/src/modules/booking/booking.service.ts`
- `apps/frontend/src/app/(owner)/dashboard/products/components/product-form/steps/pricing-services.tsx`
- `apps/frontend/src/lib/api/products.ts`

Actions:

- Prove that the versioned pricing engine is the only authoritative product and booking price source.
- Remove any scoped fallback to obsolete product pricing/service data or frontend total calculation used as authority.
- Validate deposits, fees, included services, optional add-ons, late-fee policies, and bundle adjustments as typed configuration.
- Expose validation failures in the Pricing section and readiness checklist.
- Keep display estimates clearly non-authoritative until a backend quote exists.

### Task B3: Media, composition, and history entry points

- Verify primary, gallery, variant, and item-reference media use final storage/API contracts and explicit visibility rules.
- Complete required-component, alternative, optional-add-on, substitution-policy, quantity, and compatibility validation.
- Prevent composition cycles and invalid self-reference.
- Ensure product detail links to Catalog, Pricing, Composition, Inventory, and relevant history without duplicating global tools.
- Add filtered empty/error states and invalidate only affected queries after mutations.

### Task B4: Catalog frontend completion

- Audit product list, draft/edit sections, detail, composition, categories, product types, size systems, and events for bounded queries and URL-stable filters.
- Split any remaining orchestration that prevents section-level validation or safe resumption; do not refactor unrelated presentation code.
- Add route-level and inline loading/error/empty/conflict handling where absent.
- Ensure mobile actions expose the same valid operations as desktop without wide-table dependence.
- Remove warnings in every changed catalog file.

### Task B5: Checkpoint verification and commit

- Focused product/pricing unit tests.
- TypeScript and focused ESLint for changed files.
- Backend and frontend production builds.
- Update catalog rows in the completeness matrix with evidence.
- Commit Catalog closure.

## Checkpoint C — Inventory control closure

### Task C1: Pooled adjustments and stock counts

Primary files:

- `apps/backend/src/modules/inventory/inventory-pool.service.ts`
- `apps/backend/src/modules/inventory/inventory-foundation.controller.ts`
- `apps/backend/src/modules/inventory/dto/inventory-foundation.dto.ts`
- `apps/frontend/src/lib/api/inventory.ts`
- `apps/frontend/src/app/(owner)/dashboard/inventory/stock/**`

Actions:

- Add or complete reasoned receive, add, subtract, write-off, and count-correction commands.
- Lock the pool row, use optimistic version checks, reject negative stock and reductions below committed demand, and create one immutable movement for every effect.
- Distinguish adjustment from physical stock count. Count reconciliation records expected, observed, variance, actor, reason, and movement reference.
- Never expose direct `onHandQuantity` editing.
- Provide SKU/location-scoped dialogs with effect preview, stale-version recovery, and refreshed projections.

### Task C2: Movement and count workspaces

Create or complete:

- backend paginated movement/count list contracts;
- `apps/frontend/src/app/(owner)/dashboard/inventory/movements/page.tsx`;
- `apps/frontend/src/app/(owner)/dashboard/inventory/counts/page.tsx`.

Requirements:

- filters for product/SKU, physical item, pool, location, movement type, actor, date, booking, transfer, and service context as applicable;
- stable server sorting and pagination;
- current quantity reconstruction evidence for pools;
- contextual links back to source booking, transfer, item, or count;
- no mutation of historical movement rows.

### Task C3: Availability policies, blocks, and blackouts

Primary files:

- `apps/backend/src/modules/inventory/availability-policy.service.ts`
- `apps/backend/src/modules/inventory/inventory-management.service.ts`
- `apps/backend/src/modules/inventory/inventory-foundation.controller.ts`
- `apps/frontend/src/lib/api/inventory.ts`
- new or completed `/dashboard/inventory/availability` route.

Actions:

- Complete tenant/location/product/SKU policy inheritance and normalized projections.
- Use optimistic versions or immutable policy versions so stale editing is rejected.
- Separate customer-visible dates from effective blocked dates.
- Provide scoped blackout/block creation with exact target, date range, quantity rules, reason, and conflict preview.
- Prevent invalid scope combinations and deletion of service/inspection-owned blocks through a generic UI.
- Link active blocks to their owner and affected inventory.

### Task C4: Batch physical-item registration

- Extend the existing single-item dialog and command to support atomic batches with tenant-unique generated or supplied asset codes.
- Include SKU, location, acquisition context, condition, barcode, component state, and identity preview.
- Use an idempotency key plus request fingerprint.
- Return row-addressable validation errors before commit; create all rows or none.
- Add PostgreSQL tests for duplicate identity, retry, rollback, and tenant scope.

### Task C5: Global inspection and issue queue

Create or complete:

- paginated inventory-operations query for inspection/issue attention;
- `/dashboard/inventory/inspections` route;
- typed filters for inspection type/status, issue severity/status/responsibility, decision, location, product/SKU/item, booking, and date.

Actions:

- Show draft return inspections, failed component checks, blocking issues, customer responsibility, and next valid action.
- Link to the exact physical-item operations record and booking context.
- Keep inspection completion on the authoritative item detail command.
- Ensure completing an inspection updates availability only through its decision and resulting service/block state.

### Task C6: Global service-work queue

Create or complete:

- paginated service-order query;
- `/dashboard/inventory/service` route;
- filters for cleaning, washing, repair, alteration, maintenance, status, location, provider, expected completion, overdue, issue, and item.

Actions:

- Expose requested, scheduled, in-progress, overdue, completed, and cancelled work.
- Guard start/complete/cancel transitions and require operational notes.
- Keep availability blocked until the final decision permits return.
- Surface cost, issue, inspection, item, and booking links without exposing private data to storefront contracts.

### Task C7: Overview, navigation, and transfer exceptions

- Add Availability, Inspections, Service work, Movements, and Stock counts to grouped Inventory navigation.
- Make every overview attention card link to a canonical filtered route.
- Complete transfer reconciliation entry points for dispatched shortages, damaged/lost receipts, and overdue transfers.
- Ensure the Operations summary links into these inventory workspaces rather than maintaining duplicate state.

### Task C8: Checkpoint verification and commit

- Unit tests for pools, counts, policies, blocks, inspections, service transitions, and list filters.
- PostgreSQL integration tests for concurrent adjustment/reservation, idempotent batch registration, count correction, block enforcement, and service availability.
- TypeScript, focused lint, backend build, and frontend build.
- Update Inventory matrix evidence and commit.

## Checkpoint D — Rental creation closure

### Task D1: Authoritative quote identity and freshness

Primary files:

- `apps/backend/prisma/schema.prisma`
- `apps/backend/src/modules/pricing-engine/**`
- `apps/backend/src/modules/booking/dto/booking.dto.ts`
- `apps/backend/src/modules/booking/booking.service.ts`
- `apps/frontend/src/lib/api/bookings.ts`

Actions:

- Audit existing quote/policy snapshots before adding schema.
- Return a quote identity/version/hash, inputs hash, itemized lines, policy identity, availability plan, expiry/freshness context, and integer-minor totals.
- Require booking creation to reference the authoritative quote when manual booking uses quoted pricing.
- Recompute and compare quote plus capacity inside the booking transaction.
- Return typed pricing or availability conflicts with affected line identities and current authoritative values.
- Preserve request-fingerprint idempotency for retries.

### Task D2: Rental plan and location/handover

- Add explicit rental dates, source/fulfillment location, pickup/delivery method, delivery context, and policy options to manual-booking state and DTOs.
- Validate location capabilities and single-location bundle rules.
- Represent a transfer-dependent plan explicitly and prevent confirmation when preparation cannot be met.
- Invalidate availability and quote whenever planning inputs change.

### Task D3: Decompose manual booking orchestration

Primary route:

- `apps/frontend/src/app/(owner)/dashboard/bookings/new/**`

Create focused components/hooks for:

1. customer/contact;
2. rental plan;
3. item and bundle selection;
4. quote/payment/deposit;
5. review/create;
6. draft persistence and freshness state.

Rules:

- Route orchestration owns stage navigation and submission only.
- Hooks own server queries and mutation recovery, not visual layout.
- Changing authoritative inputs clears the accepted quote reference immediately.
- Restored local drafts reopen before quote acceptance and revalidate current products, policies, and capacity.
- Sensitive credentials are never stored in local persistence.

### Task D4: Payment, deposit, discount, and notes

- Ensure every manual price adjustment is permission-checked, reasoned, bounded, and included in the authoritative result.
- Record initial payments idempotently and reject amounts above the final total.
- Keep deposit received/held/deducted/refunded/forfeited effects auditable and separate from rental revenue.
- Ensure all UI money conversion occurs only at input/display boundaries.

### Task D5: Conflict recovery

- Preserve customer, planning, and cart state on price/capacity conflicts.
- Highlight changed lines and offer recheck, approved substitution, quantity change, date change, location change, or removal.
- Prevent duplicate creation during pending mutation and after a lost response.
- Add pure-state tests for freshness invalidation and recovery where the frontend test stack supports them; otherwise extract deterministic helpers and verify with TypeScript plus backend contract tests.

### Task D6: Checkpoint verification and commit

- Booking/pricing unit tests and PostgreSQL concurrency/idempotency integration tests.
- TypeScript and focused lint for the decomposed workflow.
- Backend and frontend production builds.
- Disposable empty-database migration/seed verification if schema changed.
- Update Rental Creation matrix evidence and commit.

## Checkpoint E — Fulfillment, return, and service closure

### Task E1: Server-derived operational queues

Primary files:

- `apps/backend/src/modules/booking/booking.service.ts`
- `apps/backend/src/modules/inventory/fulfillment.service.ts`
- `apps/frontend/src/app/(owner)/dashboard/bookings/**`

Actions:

- Complete queue definitions for request, assignment, preparation, handoff, active, return due/intake, inspection, overdue/exception, and closed.
- Return independent queue counts and stable filter/sort/pagination metadata.
- Include location, handover, shortage, assignment, preparation, return, inspection, payment/deposit, and next-action projections required by rows.
- Avoid per-row follow-up requests.
- Keep each queue addressable through canonical URL state.

### Task E2: Preparation and handout

- Expose exact requirement readiness, preparation status, assignments, source location, and blockers.
- Guard serialized assignment by full blocked-range and location eligibility.
- Record pre-rental inspection when policy or condition requires it.
- Record exact serialized assignments or pooled quantities at handout.
- Derive delivery/out-for-rental booking state only when every required handout fact is complete.

### Task E3: Extension, overdue, substitution, and loss

- Replan every requirement atomically when dates change.
- Preserve later commitments and return a typed conflict instead of silently overbooking.
- Guard substitutions by composition policy, availability, assignment state, approval, and price impact.
- Record loss against exact assignments/components, update disposition, financial responsibility, and replacement/service context.
- Keep overdue queues derived from dates and unresolved handed-out quantity.

### Task E4: Return intake and inspections

- Record exact returned or lost quantities/assignments before booking return transition.
- Move returned serialized units to `AWAITING_INSPECTION` and retain the released assignment as inspection context.
- Require item-level return inspection before booking inspection/completion.
- Record condition, set-component presence, issues, media, responsibility, customer-liability notes, and decision.
- Ensure pooled returns restore capacity only according to the final inventory and inspection policy; do not invent serialized identity for pooled stock.

### Task E5: Damage, deposit settlement, and service follow-up

- Connect booking damage reports to stock-unit issues and inspection evidence where an exact item exists.
- Calculate suggested charges from recorded facts while requiring explicit authorized settlement.
- Prevent deposit refund/forfeit commands from exceeding held balance or applying twice.
- Create and track cleaning/repair/service work from inspection decisions and keep items blocked.
- Allow booking commercial settlement to close only after required operational and financial work is resolved or explicitly waived with permission and reason.

### Task E6: Booking detail organization

- Keep commercial summary and operational fulfillment as distinct layers.
- Show requirement source, reservation, assignment, progress, blockers, next action, and immutable activity.
- Link returned items directly to inspection and service records.
- Add explicit stale/conflict recovery and background-refresh indicators.
- Ensure mobile actions support warehouse handout and return workflows without horizontal table dependence.

### Task E7: Checkpoint verification and commit

- Unit tests for every transition guard and queue definition.
- PostgreSQL tests for competing assignment, handout, return, extension, substitution, loss, inspection, service, and deposit idempotency.
- TypeScript, focused lint, backend build, and frontend build.
- Update Fulfillment/Return matrix evidence and commit.

## Checkpoint F — Final completeness audit

### Task F1: Close every matrix row

- Re-audit every row using actual code, routes, tests, and commands.
- No `PARTIAL`, `MISSING`, or unexplained `OBSOLETE` row may remain.
- Delete scoped dead routes, frontend methods, DTO fields, fallback calculations, and unreachable controls proven obsolete.
- Confirm owner navigation and product/booking/item contextual links expose every capability.

### Task F2: Database and tenant correctness

- Review foreign keys, delete behavior, unique constraints, check constraints, exclusion constraints, partial indexes, and list/overlap query indexes.
- Verify every query and mutation is tenant-scoped.
- Verify capacity-sensitive lock ordering and transaction isolation.
- Verify idempotency-key uniqueness and request fingerprint comparison.
- Verify all money fields and date/time boundaries.

### Task F3: Frontend contract, accessibility, and performance review

- Confirm one pagination envelope and one error model across scoped clients.
- Confirm canonical URL state, debounced search, stable sorting, bounded limits, and no page-local authoritative sorting.
- Confirm no row-level request waterfalls or unbounded nested history.
- Confirm accessible names, dialog titles/descriptions, text status, keyboard operation, focusable validation, and mobile task actions through code review.
- Confirm destructive and financial commands show exact effects, require confirmation, and capture reasons.
- Do not perform browser or visual verification.

### Task F4: Full automated verification

Run:

- Prisma format/generate/validate.
- All backend unit suites.
- All PostgreSQL integration suites against an isolated database.
- Deterministic seed twice when database schema or seed behavior changed.
- Frontend TypeScript check.
- Focused ESLint for every changed file with no new warnings.
- Backend production build.
- Frontend production build.
- `git diff --check` and final scoped compatibility searches.

If the schema changed:

- apply the single clean baseline to a new empty disposable database;
- seed it twice;
- run read-only invariants and integration tests;
- remove only that explicitly named disposable database.

### Task F5: Completion record and final commit

- Update the design verification record with exact passing suite/build/migration results.
- Mark every matrix row `COMPLETE` with evidence.
- Record unrelated warnings or modules explicitly without presenting them as scoped blockers.
- Confirm the worktree contains no accidental edits and that the two original uncommitted changes were either intentionally incorporated or remain separately preserved.
- Commit the final audit and provide the user a concise operational summary.

## Completion gate

Implementation is finished only when:

- every scoped capability satisfies the eight-part definition of complete;
- the full product-to-return lifecycle has no hidden backend-only step or frontend-only control;
- pooled and serialized capacity remain correct under concurrency;
- bundle components and add-ons remain explicit throughout reservation and return;
- blocked or operationally ineligible inventory cannot be offered;
- booking/queue state follows recorded operational facts;
- authoritative pricing and availability are revalidated atomically;
- every scoped workspace is discoverable, bounded, URL-stable, recoverable, and tested;
- the clean baseline and complete repository pass all defined automated gates without browser verification.
