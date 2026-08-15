# Booking Review and Reserve Lifecycle Design

## Purpose

Make a rental booking operationally truthful for a business that rents individually tracked fashion items. A booking must not be commercially confirmed until the team has reviewed its terms and allocated every exact physical item that will fulfill it.

This supersedes the earlier boundary that permitted exact physical-item selection only during preparation. SKU/location capacity remains useful as a short-lived request hold; it is not a confirmation-grade fulfillment commitment.

## Decision

The owner workflow is:

1. **Review and reserve** — validate the request, commercial terms, customer, dates, location, and return/handover plan; allocate each required exact physical item; resolve substitutions or shortages; then approve or decline.
2. **Confirmed / prepare handoff** — the rental is committed. Staff clean, package, perform required pre-rental inspection, and mark every allocated component ready.
3. **Hand out / dispatch** — record the actual customer pickup or courier handoff. Only then does the rental become active.
4. **Active rental and return coordination** — manage extensions, reminders, overdue work, and return logistics.
5. **Return intake** — receive and account for every handed-out physical item as returned or lost.
6. **Inspect and settle** — complete return inspections, damage/service work, deposits, fees, and outstanding payment.
7. **Completed** — all physical, financial, and exception work is closed.

Cancelled requests remain a terminal branch before handout. A booking that has handed-out items must follow return/loss resolution rather than ordinary cancellation.

## State model and responsibilities

The persistent booking statuses remain commercially meaningful and deliberately small:

| Status | Meaning | Required condition to enter |
| --- | --- | --- |
| `pending` | A request is being reviewed; any capacity hold is temporary. | Booking created. |
| `confirmed` | The business has accepted the rental and reserved exact physical items. | Every active fulfillment requirement has an active exact-item assignment equal to its quantity. |
| `delivered` | The business has handed the rental to the customer or courier. | Every required assigned item has a recorded handout. |
| `overdue` | An active rental has exceeded its return deadline. | Manual/system exception transition from active rental. |
| `returned` | Every handed-out item is returned or recorded as lost. | Item-by-item return intake complete. |
| `inspected` | Every returned item has passed its required return inspection. | Inspection work complete. |
| `completed` | Inventory, finance, deposits, and return exceptions are resolved. | Commercial and operational closeout complete. |

The user-facing workflow must show stages rather than expose status names as the work model. “Review and reserve” includes exact assignment. “Prepare handoff” never includes commercial acceptance. “Dispatch” distinguishes handout to a courier from courier delivery to the customer.

## Inventory and fulfillment rules

### Pending request

- Booking creation creates fulfillment requirements and a short-lived SKU/location capacity reservation.
- Pending reservations expire according to the configured request-hold policy.
- Staff may allocate only eligible, available physical units to each requirement during review.
- Allocating a unit reserves that exact unit for the booking date range, but the allocation stays review-scoped until the approval command succeeds.
- Changing dates, components, substitutions, or quantities revalidates capacity and invalidates any incompatible allocation.
- An extension of a pending request is a request revision, not a rental extension; it returns the request to review with a renewed hold and allocation check.

### Confirmation

- The confirmation command is the sole transition from `pending` to `confirmed`.
- It requires every active requirement to be SKU-resolved, capacity-reserved, and exactly assigned. Partial assignment, generic capacity alone, or an expired hold rejects confirmation with a structured actionable response.
- Confirmation converts the temporary reservation and all exact assignments into committed rental reservations.
- It records the approving actor and an immutable event explaining the commercial decision.

### Preparation and handout

- Preparation begins only for confirmed bookings.
- A component can be marked ready only when all of its exact physical items are assigned.
- Handout requires ready preparation, any condition-driven pre-rental inspection, and explicit selection of the assigned physical units handed out.
- The rental becomes active only after every component is handed out. Courier delivery is evidence of transport progress; it does not substitute for the handout record.

### Return and inspection

- Return transport arrival does not automatically mark a booking returned. Staff must intake each assigned unit and record returned or lost.
- Returned items move to awaiting inspection. Loss records create an issue and remain availability-blocking.
- Inspection, issue/service resolution, deposit settlement, and payment closure retain their existing completion safeguards.

## Logistics rules

- Confirming a delivery booking may create a *draft logistics job*, but it must not request a courier pickup or create an actionable shipment until the booking is fully prepared and ready for handout.
- A courier can be dispatched only from the ready-for-handoff operation. Customer pickup follows the same readiness rule without a courier job.
- Outbound shipment delivery may advance an already-handed-out booking’s transport state, but cannot bypass the physical handout safeguard.
- Return shipment delivery creates a return-intake task; staff still reconcile the actual returned units before moving the booking forward.

## Payments and commercial policy

- Payment gating is explicit policy, not an accidental global blocker. Each tenant’s payment terms define the minimum verified amount required for confirmation and for handout (for example, full deposit before handout, rental balance on delivery for COD).
- The booking workspace explains the applicable payment condition in the stage where it matters.
- Final completion continues to require settled deposits, resolved return work, and the complete required balance.

## Authorization and audit

- Owner/manager: approve or decline requests, substitute requested components, approve exceptions, inspect, settle deposits, and complete bookings.
- Staff: allocate physical items during review, prepare, hand out, receive returns, and record factual fulfillment events. Staff cannot commercially confirm, cancel, settle financial exceptions, or complete the booking.
- Remove the externally callable generic status-transition endpoint. Use named, intent-specific commands with the authenticated actor and reason where relevant.
- Every booking-stage decision stores actor, timestamp, previous and next state, reason/evidence, and correlation/idempotency data.

## Owner queues and booking detail

Replace separate Request and Assign-items queues with one **Review & reserve** queue containing pending bookings. Its primary progress is: request details reviewed, capacity hold valid, exact pieces assigned, payment condition met, then approve/decline.

The confirmed queue is split only by post-approval operational work:

- **Prepare handoff** — assigned pieces not yet ready.
- **Ready to hand out** — all preparation conditions satisfied.

The booking detail’s server-owned operations projection is the one source for stage, prerequisites, blockers, next action, and deep link. The frontend may display detailed fulfillment records, but it must not independently redefine readiness.

## Error handling and migration safety

- Existing confirmed bookings without exact allocations are shown as an explicit migration/work queue, never silently treated as ready.
- Existing pending bookings remain pending holds; operations must allocate exact units before confirming them after rollout.
- Every rejected command returns a domain code, a short explanation, missing counts/identifiers where safe, and the next owner action.
- Reservation/assignment updates and confirmation remain serializable transactions with SKU and booking locks.

## Verification

Tests must prove:

1. A pending booking cannot confirm with only a SKU hold.
2. A pending booking confirms when every requirement has exact eligible assignments and an unexpired hold.
3. Invalid, conflicting, released, or insufficient assignments reject confirmation without consuming capacity.
4. Date/component revisions revalidate or invalidate affected assignments.
5. Courier pickup cannot be requested before all requirements are ready for handout.
6. Shipment delivery cannot bypass required handout events.
7. Return shipment arrival cannot bypass item-by-item return intake.
8. Generic status mutation is unavailable externally; role-specific commands preserve authorization and actor history.
9. Existing closeout safeguards for inspections, deposits, balance, damage, and service work remain intact.
