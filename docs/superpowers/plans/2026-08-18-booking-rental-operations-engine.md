# Booking and Rental Operations Engine Implementation Plan

**Design:** `docs/superpowers/specs/2026-08-18-booking-rental-operations-engine-design.md`

**Goal:** Replace the coarse booking/shipment/payment lifecycle with independent, auditable operational domains and a simple derived owner workflow.

**Delivery rule:** Complete and commit each checkpoint with its focused tests passing. Temporary read-only compatibility projections may bridge checkpoints; there must never be two writable sources of truth.

## Working conventions

- Preserve tenant isolation in every query, relation, idempotency key, and unique constraint.
- Use named commands rather than generic state setters.
- Require idempotency keys on consequential mutations.
- Use expected versions and serializable transactions for contested aggregate transitions.
- Store integer minor currency units and explicit `currency` values.
- Store scheduled, provider-occurred, system-received, and business-confirmed timestamps separately.
- Add timeline/audit records inside the state-changing transaction.
- Return stable error codes, blockers, and recovery actions.
- Keep public/customer responses free of physical asset identity, staff risk notes, acquisition values, and internal evidence.
- Run `git diff --check` before every commit.

## Checkpoint A — Operations foundation

### A1. Add the normalized schema

Primary file:

- `apps/backend/prisma/schema.prisma`

Add enums for:

- booking decision and close-cycle outcomes;
- projected booking stage/modifier only if persisted projection storage proves necessary;
- fulfillment direction, method, normalized status, provider-source type, and allocation status;
- custody type and transition reason;
- handover status and verification method;
- rental status and start/timeliness policy;
- return-intake status and item outcome;
- financial entry kind, direction, and processing status;
- exception severity/status;
- task type/priority/status;
- override kind;
- operational event category.

Add models:

- `BookingVersion` — immutable agreement/pricing/fulfillment/policy snapshot and actor/reason;
- `FulfillmentGroup` — origin/destination/method/direction snapshot and aggregate version;
- `Fulfillment` — method-neutral movement instance with optional provider metadata;
- `FulfillmentAllocation` — exact assignment/unit scope for a fulfillment;
- `FulfillmentEvent` — normalized plus original provider evidence and dual timestamps;
- `StockUnitCustody` — one current custody row per unit with optimistic version;
- `CustodyEvent` — append-only from/to evidence;
- `Handover` and `HandoverItem` — verified possession transfer;
- `Rental` and `RentalItem` — actual rental state/times independent of scheduled booking dates;
- `ReturnIntake` and `ReturnIntakeItem` — expected/received/missing/unexpected reconciliation;
- `FinancialEntry` — append-only charge/payment/deposit/refund/courier/adjustment ledger;
- `OperationalException` — affected entity, severity, assignment, due time, resolution;
- `OperationalTask` — idempotent work generated from facts;
- `BookingCloseCycle` — strict close, force close, reopen, and prior-close history;
- `OperationalEvent` — unified application/domain event source for timeline projection.

Alter existing models to add relations and aggregate versions. Keep existing `Shipment`, `Payment`, `DepositSettlement`, and coarse booking financial/status fields during the first checkpoint as explicit compatibility records only.

Required database protections:

- tenant-scoped unique idempotency keys;
- one current custody row per stock unit;
- unique exact-unit allocation within a live fulfillment;
- unique active rental item per assignment;
- immutable linkage for reversal/supersession records;
- indexes for booking timeline, queues, task/exception ownership, custody lookup, fulfillment dashboard, and financial balances.

Do not rewrite the baseline migration yet. Generate and validate Prisma against the working schema; the baseline is rebuilt only at cutover.

### A2. Build shared domain primitives

Create under `apps/backend/src/modules/operations/`:

- `operations.module.ts`;
- `domain/operations.types.ts`;
- `domain/domain-error.ts`;
- `domain/idempotency.ts`;
- `domain/transition-rules.ts`;
- `operational-event.service.ts`;
- `booking-stage-projector.service.ts`;
- `booking-stage-projector.service.spec.ts`;
- `operations-query.service.ts`;
- `dto/operations.dto.ts`.

The projector input contains exact facts rather than a coarse booking status. Its output contains:

- primary stage and modifier;
- stage label/description;
- dominant action and authorized recovery actions;
- item progress by reservation, readiness, custody, handover, return intake, and inspection;
- financial balances and deposit/refund conditions;
- due/overdue flags;
- blocking and non-blocking exceptions;
- task summary;
- strict close-gate results.

Add pure projection tests for normal booking, partial fulfillment, partial return, wrong return, refund failure, unknown custody, cancellation, force-close, and reopened settlement.

### A3. Seed initial version/custody facts during booking and inventory creation

Primary files:

- `apps/backend/src/modules/booking/booking.service.ts`
- `apps/backend/src/modules/inventory/inventory-management.service.ts`
- `apps/backend/src/modules/inventory/stock-unit-lifecycle.service.ts`
- related focused tests and `apps/backend/prisma/seed.ts`

Actions:

- Create Booking Version 1 in the same transaction as storefront/manual booking creation.
- Initialize every registered stock unit with business-location custody.
- Move legacy stock lifecycle operations through a custody service where they represent physical possession.
- Backfill only deterministic development records; ambiguous records create explicit unknown-custody exceptions.

### A4. Foundation integration tests and commit

Create or extend:

- `apps/backend/test/booking-operations-engine.integration-spec.ts`
- `apps/backend/test/serialized-inventory.integration-spec.ts`

Prove tenant isolation, booking-version immutability, one-custody invariant, idempotent events, stage projection for mixed states, and safe concurrent custody/version conflicts.

Verification:

- `npm run db:validate`
- `npm run db:generate`
- focused operations/inventory unit tests
- focused integration tests
- `npm run build:backend`
- `git diff --check`

Commit: `feat: add rental operations foundation`

## Checkpoint B — Review, reserve, readiness, and packing

### B1. Replace generic approval with named review commands

Primary files:

- `apps/backend/src/modules/booking/booking.controller.ts`
- `apps/backend/src/modules/booking/booking.service.ts`
- `apps/backend/src/modules/booking/dto/booking.dto.ts`
- `apps/backend/src/modules/inventory/fulfillment.service.ts`
- `apps/backend/src/modules/inventory/inventory-assignment.service.ts`

Add commands:

- approve and reserve;
- reject request;
- revise booking terms;
- renew temporary hold;
- replace/release exact assignment.

Approval must lock booking, requirements, reservations, and exact units; check expected booking version; require complete eligible assignments and valid holds; snapshot fulfillment/payment/deposit/timing policies; commit reservations; create operational event/task changes; and refresh compatibility projection atomically.

Remove the externally callable generic confirmation mutation. Keep customer cancellation only through the explicit stage-aware cancellation command.

### B2. Make Ready Check first-class

Primary files:

- `apps/backend/src/modules/inventory/stock-unit-inspection.service.ts`
- `apps/backend/src/modules/inventory/inventory-operations.controller.ts`
- inventory operation DTOs and tests

Actions:

- Link one required pre-rental inspection to the active assignment and booking version.
- Require exact unit/components, cleanliness/condition, service blockers, and optional before-customer evidence.
- On failure return recovery options: reassign, cleaning, repair, modify scope, partial plan, cancel.
- Do not mutate booking stage directly; stage derives from completed readiness across active allocations.

### B3. Move packing to fulfillment groups

Primary files:

- new operations fulfillment command/query services;
- `apps/backend/src/modules/inventory/fulfillment.service.ts` during adaptation;
- `apps/backend/src/modules/fulfillment/fulfillment.service.ts` during adaptation.

Actions:

- Create outbound fulfillment groups only after approval or as non-actionable drafts.
- Group exact assigned units by origin and chosen customer handover plan.
- Detect multi-location consolidation requirements.
- Record preparation/packing against the group and exact allocations.
- Emit `handover ready` only when all group gates pass.

### B4. Owner review/readiness UI

Primary files:

- `apps/frontend/src/lib/api/bookings.ts`
- `apps/frontend/src/lib/api/inventory-operations.ts`
- booking detail page and components under `apps/frontend/src/app/(owner)/dashboard/bookings/[id]/`
- booking list/workflow components under `apps/frontend/src/app/(owner)/dashboard/bookings/`

Actions:

- Drive UI from the server operations projection.
- Build one Review & Reserve workspace with customer/risk/commercial details, hold expiry, assignments, locations, policies, and one approve action.
- Build Ready Check and packing views with exact-unit evidence and clear recovery actions.
- Remove manual status advancement controls.
- Show stale/conflict errors without clearing staff work.

### B5. Verification and commit

Test simultaneous approval, expired hold, missing/changed assignments, readiness failure/reassignment, multi-location consolidation, duplicate commands, role permissions, and projection-driven UI guidance.

Commit: `feat: rebuild booking review and preparation`

## Checkpoint C — Method-neutral handover and outbound fulfillment

### C1. Adapt courier shipment code behind fulfillment

Primary files:

- `apps/backend/src/modules/fulfillment/fulfillment.service.ts`
- provider adapters under `apps/backend/src/modules/fulfillment/providers/`
- `apps/backend/src/modules/fulfillment/fulfillment.controller.ts`
- fulfillment DTOs and tests

Actions:

- Make `Fulfillment` the domain record and retain provider/shipment fields as adapter evidence.
- Map original provider statuses to normalized statuses.
- Preserve provider occurrence and receipt times.
- Keep deduplication and stale-event protection; create conflict exceptions for contradictions.
- Remove direct booking-status mutation from manual delivery and webhook handlers.
- Make integration outage/retry/manual fallback explicit.

### C2. Implement every outbound method

Commands and policies:

- standard courier dispatch;
- customer pickup scheduling/no-show/reschedule/change-method;
- manual instant-delivery rider details and progress;
- staff delivery and other manual methods;
- split fulfillment and partial cancellation;
- internal consolidation transfer before pickup.

Customer pickup has no fake courier provider or tracking fields. Instant delivery fee records whether the customer paid provider directly or it is a pass-through charge.

### C3. Add verified handover and rental activation

Create:

- `handover-command.service.ts` and tests;
- `rental-command.service.ts` and tests;
- controller/DTO endpoints for complete handover and custody correction.

Actions:

- Validate exact allocations, readiness, custody, payment/deposit policy, verification method, expected versions, and evidence.
- Move custody and start rental idempotently in one serializable transaction.
- Support provider evidence policy and manual confirmation.
- Represent partial handover truthfully.
- Require reason/permission for handover-with-balance and manual delivered/custody override.

### C4. Deliveries & Returns and handover UI

Primary files:

- `apps/frontend/src/app/(owner)/dashboard/deliveries/page.tsx`
- `apps/frontend/src/lib/api/fulfillment.ts`
- booking detail workflow/actions/delivery components.

Actions:

- Add To Customer/Returns/Internal Transfers projections.
- Add method and normalized-status filters.
- Show provider detail only for courier methods.
- Implement one handover flow with method-specific verification and payment gate.
- Surface integration uncertainty, last confirmed evidence, retry/manual/change-method recovery.

### C5. Verification and commit

Test customer pickup, no-show, manual instant delivery, courier API failure, provider duplicate/stale/conflicting events, RTO, outbound loss, partial/split fulfillment, concurrent handover, and payment override audit.

Commit: `feat: normalize outbound fulfillment and handover`

## Checkpoint D — Return fulfillment, intake, and inspection

### D1. Implement return planning and movement

Actions:

- Initiate return independently of outbound method.
- Support customer courier, business courier, customer drop-off, instant rider, staff pickup, and manual other.
- Record customer return handover separately from business receipt.
- Apply snapshotted timeliness policy.
- Project due today/overdue as conditions, not status mutations.

### D2. Implement exact-unit Return Intake

Create return-intake command/query/controller/DTO files under operations.

Actions:

- Load all customer/return-carrier custody units expected for the booking/group.
- Scan/confirm exact received units.
- Record missing, lost, and unexpected units.
- Keep wrong expected unit in prior custody; quarantine unexpected unit.
- Treat empty parcel as completed logistics plus failed intake and critical exception.
- Move verified received units to Receiving Area custody and create inspection tasks.

### D3. Integrate Return Inspection

Primary files:

- inventory inspection, issue, service, lifecycle, media services/controllers;
- booking damage/deposit code scheduled for later financial adaptation.

Actions:

- Require return intake before return inspection.
- Keep physical disposition and customer responsibility separate.
- Link proposed charges to inspection evidence without changing money directly.
- Preserve amendment history.
- Invalidate/reassignment-task future reservations after loss/retirement or blocking service.

### D4. Return and inspection UI

Actions:

- Build return planning/movement controls.
- Build Receiving — Awaiting Inspection queue.
- Build scan-first exact-unit intake with expected/missing/unexpected summary.
- Build before/after evidence comparison and separate inventory/financial decisions.
- Show partial return counts and per-unit custody.

### D5. Verification and commit

Test early/late return, return handover vs receipt policy, partial return, wrong item, empty parcel, lost item, normal cleaning, customer damage, beyond-repair retirement, inspection amendment, and future reservation impact.

Commit: `feat: add exact return intake and inspection`

## Checkpoint E — Financial ledger and settlement

### E1. Add ledger command/query services

Create under `apps/backend/src/modules/operations/finance/`:

- financial-ledger service;
- balance projector;
- payment command service;
- deposit command service;
- refund command service;
- courier receivable service;
- late-fee service;
- DTOs/controllers and focused tests.

Actions:

- Post immutable initial charge/deposit requirements from Booking Version 1.
- Support verified/pending/failed payments and split methods.
- Reverse and correct payments append-only.
- Support deposit collection, hold, application, refund obligation, attempts, completion, failure, and waiver.
- Separate customer payment from courier receivable and courier settlement.
- Support overpayment refund/customer credit policy.
- Estimate late fees while open and post one final charge with evidence.

### E2. Adapt existing payment and damage flows

Primary files:

- `apps/backend/src/modules/payment/payment.service.ts`
- payment controller/DTOs/tests;
- `apps/backend/src/modules/booking/booking.service.ts` damage and late-fee sections;
- fulfillment COD reconciliation code.

Actions:

- Route all new writes through ledger commands.
- Stop directly updating `Booking.totalPaid`, `paymentStatus`, mutable late-fee totals, payment refund fields, and one-shot settlement truth.
- Keep those fields read-only compatibility projections until removed.
- Convert approved inspection responsibility into charge entries.
- Create critical task/exception when delivered COD amount is unknown.

### E3. Strict close, force close, and reopen

Create close-gate and close-command services.

Actions:

- Evaluate every physical, return, inspection, money, deposit/refund, exception, custody, and record gate.
- Return one actionable blocker per unresolved fact.
- Force close posts explicit waivers/write-offs/loss decisions and immutable override evidence.
- Reopen creates a new close cycle and preserves earlier closure.

### E4. Finance/settlement UI

Primary files:

- booking price/payment/deposit/damage components and modals;
- deliveries COD page;
- booking list cross-stage counters.

Actions:

- Show charges, payments, deposit held/applied/refund, customer balance, courier receivable, and corrections as distinct concepts.
- Implement payment reversal/correction and refund attempt flows.
- Add Payment Due and Refund Due queues independent of stage.
- Build Final Settlement with strict close blockers and authorized overrides.

### E5. Verification and commit

Test partial/split payments, correction, overpayment, deposit timing/application, charges above deposit, refund failure/retry, COD customer-vs-courier balances, late-fee finalization, close blockers, force close, and reopen.

Commit: `feat: add booking financial ledger and settlement`

## Checkpoint F — Exceptions, tasks, projections, and complete owner workspace

### F1. Complete exception and task engines

Actions:

- Add create, assign, acknowledge, resolve, reopen, and hold commands.
- Generate idempotent tasks from stage/conditions.
- Cancel or supersede obsolete tasks when facts change.
- Add ownership, due-time, severity, priority, and SLA-age queries.
- Add manager override authorization thresholds.

### F2. Replace booking list/detail projections

Primary files:

- `apps/backend/src/modules/booking/booking-operations.ts`
- booking list/detail/stats/timeline sections of `booking.service.ts`
- operations query/projector services.

Actions:

- Remove coarse enum-based stage decisions.
- Query normalized facts in bounded projections.
- Build primary queues and cross-stage counters.
- Include next action, blockers, recovery links, item/custody progress, money summary, return summary, exceptions, tasks, and source confidence.
- Expand unified timeline from operational events without unbounded fan-out.

### F3. Rebuild booking workspace

Primary frontend areas:

- booking list/table/query hooks/types;
- booking detail page and components;
- shared status, empty, alert, dialog, help, and workspace components.

Actions:

- Build operational command-center header.
- Use one dominant stage action.
- Add item/custody, fulfillment, money, return, exception/task, and timeline sections.
- Apply progressive disclosure and contextual help.
- Ensure mobile/keyboard/accessibility behavior.
- Never expose backend-normalization vocabulary unnecessarily.

### F4. Verification and commit

Test every projected stage/modifier, queue/counter, task transition, exception ownership/resolution, role/override behavior, recovery error rendering, and accessibility interactions.

Commit: `feat: rebuild booking operations workspace`

## Checkpoint G — Storefront, automation, and policy configuration

### G1. Storefront and customer tracking

Primary files:

- guest booking/checkout APIs and pages;
- public tracking endpoint/page;
- store delivery/payment settings pages.

Actions:

- Explain payment/deposit timing and available handover methods before submission.
- Price delivery by configured area/district snapshot.
- Preserve temporary hold semantics.
- Show customer-safe progress derived from fulfillment/handover/rental/return facts.
- Redact exact units, risk review, internal tasks/exceptions, acquisition data, and sensitive evidence.

### G2. Policies and schedulers

Actions:

- Add configurable hold expiry, handover verification, payment/deposit timing, rental start, return timeliness, grace/late-fee, auto-review, override thresholds, pickup no-show, and task-SLA policies.
- Update jobs to expire holds, project overdue conditions, retry/poll integrations, create reminders/tasks, and flag stuck work idempotently.
- Make auto-approval explainable and bounded by risk/outstanding-balance rules.

### G3. Notifications and analytics

Actions:

- Trigger messages from authoritative operational events.
- Prevent duplicate notifications via event/idempotency references.
- Update analytics to distinguish scheduled, actual, charges, cash received, deposit liability, refunds, courier receivable, cancellations, and operational exceptions.

### G4. Verification and commit

Test guest/manual creation equivalence, public redaction, policy snapshots, hold expiry, reminders, retries, no-show/overdue conditions, notification deduplication, and analytics truth.

Commit: `feat: align storefront and automation with rental operations`

## Checkpoint H — Clean cutover and acceptance

### H1. Remove obsolete contracts

Remove after all consumers use normalized facts:

- generic booking `updateStatus` service/controller paths;
- booking-status writes from courier code;
- courier-only shipment assumptions in owner contracts;
- `PaymentStatus` as source of truth and direct `totalPaid` writes;
- mutable late-fee truth;
- destructive refund/payment editing;
- artificial returned/overdue/inspected stage dependencies;
- duplicated booking/delivery packing state;
- obsolete frontend types/actions/copy/tests.

Keep compatibility projections only when a documented external consumer still needs them; otherwise remove them from schema and code.

### H2. Rebuild the development baseline and seed

Primary files:

- `apps/backend/prisma/migrations/20260803200000_complete_saas_baseline/migration.sql`
- `apps/backend/prisma/seed.ts`

Actions:

- Generate one clean target baseline.
- Seed deterministic businesses, locations, physical units, policies, and representative booking scenarios.
- Include normal pickup, courier COD, instant delivery, partial fulfillment, active/overdue rental, partial/wrong return, return inspection, damage/deposit settlement, refund failure, courier conflict, force close, and reopened settlement.
- Prove seed rerun repeatability.

### H3. Update authoritative documentation

Update booking, payment, inventory, courier, flow, API, database, UI, glossary, architecture, events, and domain-completeness documents. Mark the 2026-08-16 review-and-reserve design as superseded rather than leaving conflicting guidance.

### H4. Final gates

Run:

- `npm run db:validate`
- `npm run db:generate`
- clean baseline deployment to a disposable PostgreSQL database;
- deterministic seed twice;
- `npm run build:types`
- `npm run build:backend`
- backend unit suite;
- backend integration suite;
- `npm run build:frontend`
- frontend component suite;
- `npm run lint` or scoped lint with any pre-existing failures documented;
- `git diff --check`.

Perform manual browser verification for the happy path and highest-risk recovery paths: pickup, courier COD, instant delivery, integration failure fallback, partial handover, partial/wrong return, damage/deposit/refund, close blocker, force close, and reopen.

### H5. Final commit

Commit: `refactor: complete rental operations engine cutover`

## Acceptance definition

The work is complete only when:

1. One scalar booking status is no longer the authority for item, logistics, rental, money, return, inspection, or exception truth.
2. Every active physical unit has exactly one known custody owner or a critical unknown-custody exception.
3. Customer pickup and instant delivery are first-class fulfillment methods without fake courier data.
4. Courier delivery evidence cannot silently create customer custody, payment, or physical return when policy/evidence is insufficient.
5. Partial fulfillment and return remain item-accurate.
6. Return logistics completion cannot mark physical units returned without intake.
7. Money is append-only and deposits/COD/refunds remain distinct liabilities/receivables.
8. Strict close gates prevent forgotten inventory, payment, deposit, refund, inspection, custody, or exceptions.
9. Every unsafe or failed command explains what happened, why, and how staff can recover.
10. The owner workflow remains direct, progressively disclosed, and driven by one primary action.
11. The stress-test matrix passes without manual data correction or loss of history.
12. The clean schema, seed, tests, builds, and manual acceptance flows pass.
