# Booking and Rental Operations Engine Design

**Date:** 2026-08-18

**Status:** Approved for implementation by the user's explicit pre-approval

**Supersedes:** `2026-08-16-booking-review-and-reserve-lifecycle-design.md` where this document is more specific

## 1. Purpose

Rebuild booking operations around real physical custody, independent operational lifecycles, append-only financial truth, and recoverable failure handling. The owner must experience one direct booking workflow while the system preserves exact truth for every physical item, movement, payment, deposit, return, inspection, exception, and staff action.

The controlling product principle is:

> Make the happy path effortless. Make the unhappy path recoverable. Never sacrifice business truth to keep the workflow visually simple.

The normal owner flow is:

`Approve & Reserve -> Ready Check -> Pack -> Hand Over -> Start Return -> Receive -> Inspect -> Settle & Close`

Payment due, refund due, overdue, courier issues, cleaning, repair, and exceptions are parallel conditions or work queues. They are never fake booking stages.

## 2. Current-code findings

The existing repository already provides valuable foundations:

- storefront and owner-manual booking creation;
- immutable pricing-policy references and booking-item price snapshots;
- serialized physical inventory, exact assignment, reservation buffers, and serializable transactions;
- pre-rental and return inspections with evidence, issues, service orders, and lifecycle events;
- outbound and return `Shipment` records, provider adapters, webhook receipt deduplication, stale-event protection, manual delivery updates, and COD reconciliation;
- a combined operational timeline and a server-owned booking-operations projection.

The redesign is necessary because the current code also contains structural contradictions:

- `Booking.status` is manually advanced through generic `updateStatus` calls and is used as the gate for unrelated item, logistics, and financial facts.
- `delivered` means both customer possession and courier delivery; courier webhooks can directly activate a rental.
- `Shipment` assumes courier-like movement and cannot truthfully represent customer pickup, instant delivery, customer drop-off, staff delivery, or internal transfer.
- booking-level `paymentStatus`, `totalPaid`, mutable late fees, destructive payment refund fields, and one-time deposit settlement records are not a financial ledger.
- return-shipment arrival can be confused with physical-item return, even though an empty or incorrect parcel is possible.
- exceptions are inferred from overdue/shortage/item issues rather than owned, assignable operational records.
- no first-class handover, rental, return-intake, task, booking-version, override, or close/reopen record exists.
- workflow and queue projections still rely heavily on the coarse booking enum, so partial fulfillment and partial return cannot be represented honestly.

## 3. Alternatives considered

### A. Extend the existing booking and shipment statuses

Add more booking statuses, more shipment statuses, and special-case customer pickup and payments.

This is the smallest initial change, but it recreates the original failure: a multi-item booking can simultaneously be partially delivered, partially active, overdue, payment-due, and awaiting replacement. More states cannot make one scalar value represent several independent facts.

### B. Normalized operations engine with derived projections — selected

Keep `Booking` as the commercial container. Give items, fulfillment, custody, rental, return intake, inspections, money, exceptions, and tasks independent state. Derive the owner-facing stage and attention flags from those facts. Persist operational events for audit and timeline purposes, but use normalized current-state records for efficient commands and queries.

This fits the current codebase, preserves its strongest inventory and courier work, supports incremental milestone delivery, and remains understandable to the team.

### C. Fully event-sourced rewrite

Store every domain change as an event and rebuild all current state from event streams.

This offers maximal historical power but would impose unnecessary projection, migration, debugging, and operational complexity on the entire SaaS. Append-only evidence and explicit command records deliver the required auditability without making every read dependent on event replay.

## 4. Domain boundaries

`Booking` owns the customer agreement and connects the following independent domains:

| Domain | Authoritative question |
| --- | --- |
| Booking version | What terms did the customer and business agree to at each revision? |
| Booking item | What catalog item, quantity, dates, and snapshotted price were requested? |
| Reservation and assignment | Which exact physical units are committed for which blocked period? |
| Custody | Who or what physically possesses each exact unit now? |
| Fulfillment | How are selected physical units moving between two locations or parties? |
| Handover | What verified transfer of possession occurred? |
| Rental | When did possession-based rental actually start and end? |
| Return intake | Which expected physical units actually came back, and what unexpected units arrived? |
| Inspection | What condition was a physical unit in and what inventory action follows? |
| Financial ledger | Who owes whom, how much, why, and what money actually moved? |
| Exception | What uncertain or abnormal fact requires owned resolution? |
| Task | What should a staff member do next? |
| Timeline | What happened, when, by whom, and from which source? |

No integration is authoritative over internal business truth. It supplies evidence that a command handler evaluates.

## 5. Owner-facing booking stage

The primary stage is a server-derived projection, not a freely editable field:

| Stage | Meaning | Dominant action |
| --- | --- | --- |
| `REVIEW_RESERVE` | Request requires customer/commercial review and exact reservation | Approve & Reserve |
| `READY_CHECK` | Assigned units require pre-handover readiness verification | Complete Ready Check |
| `PREPARING` | Approved, ready-checked units are being packed | Mark Packed |
| `READY_HANDOVER` | Required fulfillment groups are ready for the next custodian | Start Handover |
| `HANDOVER_PROGRESS` | One or more outbound handovers started and not all required units reached customer custody | Manage Handover |
| `ACTIVE_RENTAL` | All currently expected fulfilled units are with the customer and no return intake has started | Start Return |
| `RETURN_PROGRESS` | Return has started or the booking has a mixture of customer and return custody | Manage Return |
| `RETURN_INSPECTION` | Returned units await intake reconciliation or inspection | Inspect Returned Items |
| `FINAL_SETTLEMENT` | Physical return decisions are complete but money or blocking resolution remains | Settle & Close |
| `CLOSED` | Strict close gates pass | View Summary |
| `REJECTED` | Request was rejected before approval | View Decision |
| `CANCELLED` | All cancellable scope ended without customer possession | View Cancellation |

The projection may also return a truthful modifier such as `PARTIAL`, `ON_HOLD`, or `REOPENED`. For example, the UI may show `Handover in progress · 3/5 with customer · 1 in transit · 1 needs replacement`.

The existing persisted booking status may remain temporarily as a compatibility projection during the cutover, but no controller, courier webhook, or client may set it generically. Named commands update domain facts; a projector updates compatibility fields in the same transaction.

## 6. Conditions and operational queues

The following are derived flags and queues, not lifecycle stages:

- payment due;
- refund due or refund failed;
- deposit collection due;
- return due today;
- overdue return;
- pickup no-show;
- courier issue or integration uncertainty;
- COD settlement due;
- partial fulfillment or partial return;
- cleaning, repair, quarantine, or replacement required;
- exception requiring action.

Primary booking workspace queues are:

`Needs Review | Ready Check & Preparing | Ready for Handover | Active Rentals | Returns | Inspection & Settlement | Closed`

Cross-stage counters are:

`Payment Due | Refund Due | Return Due Today | Overdue | Exceptions | Courier Issues`

## 7. Fulfillment model

Rename the internal concept from shipment to fulfillment. The UI remains **Deliveries & Returns**.

### 7.1 Direction

- `OUTBOUND` — business to customer;
- `RETURN` — customer to business;
- `INTERNAL_TRANSFER` — business location to business location.

### 7.2 Method

- `COURIER`;
- `CUSTOMER_PICKUP`;
- `INSTANT_DELIVERY`;
- `STAFF_DELIVERY`;
- `CUSTOMER_DROPOFF`;
- `STAFF_PICKUP`;
- `OTHER`.

Provider is optional and separate from method. A manual Pathao Bike or Uber-style rider is `INSTANT_DELIVERY` with a manual provider reference; an integrated Pathao parcel is `COURIER` with a Pathao connection.

### 7.3 Normalized status

`PLANNED -> PREPARING -> READY -> AWAITING_HANDOVER -> IN_CUSTODY -> IN_TRANSIT -> COMPLETED`

Additional outcomes are `ATTEMPTED`, `FAILED`, `CANCELLED`, and `RETURNED_TO_ORIGIN`.

Provider-specific statuses are preserved verbatim as events and mapped to the normalized status. They never become booking stages.

### 7.4 Groups and exact units

A booking has one or more fulfillment groups. A group snapshots origin, destination, direction, method, policy, and scheduled dates. Every fulfillment contains exact unit allocations rather than only booking-item quantities.

Multi-location customer pickup defaults to one final pickup location. If assigned units span locations, the command returns `CONSOLIDATION_REQUIRED` and offers internal transfer, multiple pickup groups, reassignment, or delivery-method change.

Outbound and return methods are independent. Partial outbound, split delivery, partial cancellation, and partial return create or amend item-scoped allocations without lying about the rest of the booking.

### 7.5 Integration safety

- Every dispatch, webhook, poll result, and manual update has an idempotency/deduplication key.
- Provider timestamp and received timestamp are stored separately.
- Older or regressive provider events remain in the timeline but cannot regress normalized state.
- A provider contradiction with confirmed custody creates an integration-conflict exception.
- Fallback order is automatic integration, retry, refresh/poll, manual evidence, then exception.
- Integration outages never block packing, handover, return intake, or other safe manual operations.

## 8. Custody and handover

Custody is first-class and item-specific. Each active physical unit has exactly one current custody record:

`BUSINESS_LOCATION | INTERNAL_TRANSFER | OUTBOUND_CARRIER | CUSTOMER | RETURN_CARRIER | RECEIVING_AREA | SERVICE_PROVIDER | QUARANTINE | LOST | UNKNOWN`

The record includes the custodian type/reference, location where applicable, source handover/event, effective timestamp, version, and last-confirmed evidence.

`UNKNOWN` always opens a critical exception. Custody cannot be silently inferred from a pretty booking status.

A handover is a verified transfer of one or more exact units between custodians. It records source, destination, method, verification method (`STAFF_CONFIRMATION`, `OTP`, `SIGNATURE`, `PROVIDER_EVIDENCE`, or approved override), actor, actual time, and evidence. Courier `delivered` is provider evidence; the handover policy decides whether that evidence is sufficient to create customer custody or requires confirmation.

Handover completion triggers, in one idempotent transaction:

- exact-unit custody transition;
- actual handover timestamp;
- rental activation according to tenant policy;
- required payment/deposit gate evaluation;
- follow-up task and timeline creation;
- compatibility projection refresh.

Two staff members submitting the same handover receive the existing completed result or a version-conflict explanation; they never create duplicate custody or rental events.

## 9. Rental policy and dates

Scheduled and actual facts are never overwritten:

- scheduled rental start and end;
- scheduled outbound and return handover;
- actual outbound handover;
- actual return handover by customer;
- actual receipt by business;
- actual inspection completion;
- actual financial close.

Supported rental-start policies are `SCHEDULED`, `HANDOVER`, `LATER_OF_SCHEDULED_AND_HANDOVER`, and `MANUAL`. Return timeliness policy can use customer handover or business receipt. Both policies are snapshotted on the booking version.

Extensions use an intent-specific command that locks affected assignments, checks later reservations including turnaround buffers, snapshots price impact, records approval evidence, and either applies atomically or returns exact conflicts with reassignment options.

Late fees are estimates while the relevant late interval remains open. Final charge entries are posted once the configured timeliness event occurs. Policy supports grace period, fixed or daily calculation, rounding, and cap.

## 10. Review, reserve, ready check, and packing

Storefront and manual booking creation remain the only creation channels.

Creation makes short-lived capacity holds at SKU/location level. Review presents customer history, risk indicators, outstanding balances, dates, pricing/deposit/payment policies, fulfillment plan, availability, and exact-unit assignment. Holds have a configurable expiry and explicit renewal command.

`Approve & Reserve` is serializable and requires:

- valid, unexpired request version and pricing snapshot;
- every active requirement resolved;
- every required quantity assigned to eligible exact units;
- no overlapping committed reservation including turnaround buffers;
- valid fulfillment origin/consolidation plan;
- required commercial review outcome;
- applicable pre-approval payment condition.

Ready Check is a pre-handover inspection, distinct from general inventory condition and return inspection. It verifies the exact unit, components/accessories, cleanliness, current condition, service blockers, and optional before-customer evidence. Failure offers reassignment, cleaning, repair, booking modification, partial plan, or cancellation.

Packing belongs to the fulfillment group. Booking and Deliveries & Returns show the same record, never duplicated statuses.

## 11. Return intake and inspection

Return movement uses the same fulfillment engine. Customer return handover and business receipt remain separate events.

Fulfillment completion means a parcel or person reached its destination. It never proves that expected physical assets were received.

Return intake records each expected exact unit as received, missing, or reported lost and records unexpected scanned units separately. Wrong or unexpected items enter quarantine. An empty parcel completes logistics but leaves all expected units in their previous custody and opens a critical exception.

Return inspection then decides, independently:

1. the physical-unit outcome: available, cleaning, washing, repair, quarantine, lost, or retired;
2. customer financial responsibility: none, proposed charge, waived, or management review.

Inspection amendments supersede rather than overwrite. Charges reference inspection evidence. Ordinary cleaning/service continues in inventory and does not keep an otherwise resolved booking open, but it blocks future availability and may trigger reassignment tasks for upcoming bookings.

## 12. Financial ledger

Money is append-only. Booking totals become projections over financial entries, not mutable source-of-truth balances.

### 12.1 Entry concepts

- charge: rental, delivery, extension, late fee, damage, missing item/accessory, or other customer receivable;
- discount or waiver;
- customer payment;
- payment reversal;
- deposit requirement;
- deposit collection;
- deposit application to an approved charge;
- refund obligation;
- refund attempt, completion, or failure;
- customer credit where enabled;
- courier receivable and courier settlement;
- authorized correction/adjustment.

Every entry stores tenant, booking, optional item/inspection/fulfillment, amount, currency, direction, kind, status, effective time, source, actor, reason, evidence, idempotency key, and reversal/reference relationship.

No payment, charge, refund, or deposit history is edited or deleted after posting. Corrections create reversing and corrected entries.

### 12.2 Handover payment policy

The default tenant policy is rental charges plus required deposit due at handover. Customer pickup exposes one primary `Record Payment & Hand Over` action. Standard courier COD may record customer payment when trustworthy provider evidence confirms amount collected. Courier settlement remains a separate business receivable.

If delivery is confirmed but COD amount is unavailable, customer custody/rental truth advances while a critical payment-confirmation task remains. The system never invents payment.

An authorized `Hand Over With Balance` override requires permission, reason, and evidence. Partial payments and split methods are supported.

### 12.3 Deposit lifecycle

Deposit policy supports not required, before dispatch, or at handover. Projection states are required, awaiting collection, held, partially applied, fully applied, refund due, refund processing, refunded, or waived.

Final settlement allocates held deposit to approved charges, creates remaining refund obligations, and leaves any excess charge as customer receivable. A failed refund keeps settlement open. A deposit is never revenue merely because it was collected.

## 13. Exceptions, tasks, holds, and overrides

Exceptions are explicit records with category, severity (`INFO`, `WARNING`, `ACTION_REQUIRED`, `CRITICAL`), affected entity, description, evidence, assignee, due time, status, resolution, and timestamps.

An exception may overlay any stage. Blocking is explicit. Unknown scenarios use `Create Exception / Put On Hold`; the command preserves current facts and stops only unsafe automatic transitions.

Tasks translate facts into work. Entering a stage or condition creates idempotent tasks such as review customer, inspect assigned units, pack group, confirm handover, inspect return, resolve damage charge, confirm COD, or process refund. Tasks have assignee/team, priority, due time, status, source condition, and completion evidence. Lifecycle truth never depends only on a task checkbox.

Manager overrides include handover payment bypass, manual custody correction, force close, waiver above configured threshold, delivered confirmation, and reservation-conflict override where policy permits. Each requires permission, reason, actor, timestamp, and immutable audit event. An override never silently erases the underlying discrepancy.

## 14. Cancellation, force close, and reopening

Cancellation is stage-aware and item-scoped:

- before approval: expire/release holds;
- after approval but before custody leaves business: release committed reservations and cancel planned fulfillment;
- after payment: create refund obligation;
- after courier request but before pickup: request/record cancellation;
- after carrier custody: use return-to-origin;
- after customer custody: use early return/loss resolution, not cancellation;
- partial fulfillment: cancel only eligible unfulfilled scope.

Strict close requires:

- no expected unit remains in customer, carrier, unknown, or unresolved custody;
- all expected returns are accounted for or explicitly resolved as lost;
- required inspections are complete or formally waived;
- damage/customer-responsibility decisions are resolved;
- customer receivable is zero or formally waived/written off;
- deposit and refund obligations are fully resolved or formally waived;
- no blocking exception remains;
- every affected physical unit has a known inventory disposition;
- all required immutable records exist.

Force close is manager/admin-only and posts the required waivers, loss/custody decisions, and audit evidence. Reopening creates a new close cycle for settlement or operational correction; it preserves every previous close timestamp and reason.

## 15. Named command surface

Generic status mutation is removed. Commands include:

- `approve-and-reserve`, `reject`, `revise`, and `renew-hold`;
- `complete-ready-check`, `replace-assignment`, and `complete-packing`;
- `plan-fulfillment`, `dispatch`, `record-provider-event`, and `cancel/return-to-origin`;
- `complete-handover` and `correct-custody`;
- `start/approve-extension` and `initiate-return`;
- `record-return-handover`, `receive-return`, and `complete-return-intake`;
- `complete/amend-inspection`;
- `post-charge`, `record/reverse-payment`, `apply-deposit`, `initiate/complete/fail-refund`, and `reconcile-courier`;
- `create/assign/resolve-exception`;
- `close`, `force-close`, and `reopen-for-settlement`.

Every state-changing command requires an idempotency key, expected aggregate version where concurrent edits matter, authenticated actor, authorization policy, serializable transaction where invariants span rows, and an actionable domain error contract.

## 16. Error contract and recovery UX

Domain rejections return:

- stable code;
- human explanation of what happened;
- why the action is unsafe;
- structured blockers and affected identifiers where safe;
- recovery actions/deep links;
- current version/state for conflict refresh.

Examples:

- `RESERVATION_CONFLICT`: “DRESS-M-004 was just reserved for another rental. Select DRESS-M-006 or reopen availability.”
- `REFUND_PENDING`: “Booking cannot close because a ৳500 deposit refund is still pending. Process refund or use an authorized waiver.”
- `COURIER_UNAVAILABLE`: “Courier request was not submitted and custody did not change. Retry, create a manual fulfillment, or change method.”
- `STALE_COMMAND`: “This handover was already completed by Rafi at 5:31 PM. The current booking has been refreshed.”

No operational screen ends at a generic server error when the system knows a safe recovery.

## 17. Owner experience

The booking header is the operational command center and answers immediately:

- where the booking is;
- the single most important next action;
- exact item progress and present custody;
- who owes whom money;
- return deadline/progress;
- unresolved exceptions.

The page uses progressive disclosure. A one-item pickup with cash and a normal return remains nearly trivial. Split groups, partial custody, multiple payments, replacement, and exception controls appear only when relevant.

Each stage has one dominant button. Secondary and override actions live in a clearly labeled overflow menu. Disabled actions explain their blocker and link to the fixing workflow. Tooltips/context help explain non-obvious policy, custody, deposit, COD, and timing concepts without hiding essential warnings.

Deliveries & Returns has `To Customer`, `Returns to Us`, and `Internal Transfers` projections with method and normalized-status filters. Customer pickup never displays courier-only fields.

The unified timeline combines booking revisions, reservations, assignments, custody, fulfillment/provider evidence, handovers, rentals, return intake, inspections, ledger activity, exceptions, tasks, overrides, close, and reopen events. It retains provider occurrence and system receipt times.

## 18. Data integrity and PostgreSQL rules

The implementation must enforce these invariants in application transactions and, where PostgreSQL supports it cleanly, database constraints/indexes:

1. One active custody owner per physical unit.
2. No overlapping committed exact-unit reservations including turnaround buffers.
3. No negative or silently edited ledger history.
4. One idempotent effect per external or command event.
5. Provider events cannot regress normalized state without an explicit conflict resolution.
6. Scheduled and actual timestamps are separate.
7. Physical return requires item-level intake; logistics completion is insufficient.
8. Required handover verification and financial policy gate are checked atomically.
9. Strict close gates are evaluated from authoritative records.
10. Unknown custody and financial mismatches create critical exceptions.
11. Tenant IDs are present and checked on every aggregate child and unique key.
12. Significant aggregates use optimistic versions plus row/advisory locks for contested commands.

Database ranges should use PostgreSQL range/exclusion semantics or an equivalent lock-safe invariant for exact-unit overlaps. Counts and mutable summary fields may exist only as transactionally maintained projections that can be rebuilt from authoritative records.

## 19. Migration and cutover

The product is in active development and the database baseline is disposable, so implementation favors a clean target schema over long-lived compatibility layers.

Cutover sequence:

1. Introduce normalized entities, enums, constraints, projectors, and named commands.
2. Adapt exact assignment, inspection, service, shipment/provider, payment, and timeline logic behind the new boundaries.
3. Replace booking and Deliveries & Returns queries with server-owned projections.
4. Replace owner actions and generic endpoints with named commands.
5. Update storefront/customer tracking projections without exposing physical-unit identities.
6. Rebuild seed data around complete happy paths and abnormal scenarios.
7. Reset the single development baseline migration after schema and tests stabilize.
8. Remove obsolete coarse-state, destructive financial, and courier-only compatibility fields and code.

No migration step may create customer custody, payment, returned inventory, or financial closure by inference when evidence is absent. Ambiguous development fixtures become explicit exceptions.

## 20. Verification strategy

### Domain unit tests

- stage and condition projection for simple and mixed item states;
- allowed fulfillment, custody, handover, rental, return, and close transitions;
- ledger balances, deposit allocation, reversals, partial payment, overpayment, and refund failure;
- late-fee estimation/finalization and timing policies;
- exception/task creation and resolution.

### PostgreSQL integration tests

- simultaneous approval and exact-unit overlap conflict;
- simultaneous handover and return intake idempotency/version handling;
- duplicate and out-of-order provider events;
- courier integration failure with manual continuation;
- empty parcel, wrong item, partial return, lost item, and replacement;
- stage-aware and partial cancellation;
- strict close, force close, and reopen;
- tenant isolation for every new child record and command.

### API and component tests

- named command authorization and actionable error payloads;
- booking workspace queues and cross-stage counters;
- one dominant action per projected stage;
- customer pickup, courier, and instant delivery progressive disclosure;
- operational header, item/custody progress, financial summary, blockers, and timeline;
- public tracking redaction of internal inventory, risk, and financial evidence.

### End-to-end acceptance matrix

The complete matrix includes normal pickup/COD/return, instant delivery, courier outage, no-show, delivery attempt/RTO/loss, partial payment/overpayment, deposit shortfall/application/refund failure, early/late/partial/wrong/empty return, damage/repair/retirement, pre-pack replacement, split fulfillment, multi-location consolidation, booking revision, concurrency, duplicate/stale webhooks, manual contradiction, correction/amendment, stage-aware cancellation, fraud hold, force close, post-close correction, and unknown-scenario exception handling.

## 21. Implementation checkpoints

1. **Foundation:** schema, enums, custody, fulfillment groups/allocations, handover/rental, booking versions, events, exceptions, tasks, and stage projector.
2. **Review through handover:** named review/reserve, ready check, packing, customer pickup, instant delivery, courier dispatch, verification, and partial/multi-location handling.
3. **Return and inspection:** return planning, return handover, receipt, item-level intake, wrong/empty/lost handling, inspection linkage, and inventory disposition.
4. **Financial truth:** ledger, payment/deposit/refund/COD projections, reversals, late fees, settlement, close, force close, and reopen.
5. **Owner workspaces:** booking queues, operational header, stage actions, custody/item progress, Deliveries & Returns, exception/task queues, and timeline.
6. **Storefront and automation:** public projections, policy-aware dates/payment copy, provider safety, fallback controls, schedulers, and notifications.
7. **Cutover:** seed/stress scenarios, baseline migration rebuild, obsolete-contract removal, documentation, complete test/build gates, and manual workflow verification.

Each checkpoint is committed only when its touched backend and frontend contracts compile and its focused tests pass. A temporary compatibility projection is acceptable between checkpoints; a second writable source of truth is not.
