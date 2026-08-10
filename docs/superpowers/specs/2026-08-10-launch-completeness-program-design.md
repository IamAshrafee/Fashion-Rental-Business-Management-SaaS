# ClosetRent Launch Completeness Program Design

**Date:** 2026-08-10

**Status:** Approved for implementation by standing user direction

**Scope:** Complete the product onboarding, customer, storefront, checkout/order, shipping, and launch-readiness domains as one coherent rental SaaS. The already completed product/rental operational domain is the baseline.

## 1. Product principles

ClosetRent is an operations-first rental platform with a customer storefront, not a quantity-only shop. The system must preserve one chain of truth:

`Customer intent -> Product/variant/SKU -> date-aware quote -> booking -> inventory obligation -> fulfillment -> shipment or pickup -> return -> inspection -> settlement`

No legacy compatibility layer, duplicate source of truth, frontend-owned financial calculation, or mutable operational history will be retained. A workflow is complete only when its data model, authorized backend commands, typed frontend integration, discoverable UI, recovery behavior, and automated verification all agree.

Cross-cutting rules:

- Every business record is tenant-scoped and every cross-record reference is tenant-validated.
- Money is integer minor units with an explicit ISO currency.
- Rental business dates use PostgreSQL `date`; operational instants use `timestamptz` and an explicit tenant/location timezone.
- Availability, pricing, totals, booking state, shipment state, and publish readiness are backend-authoritative.
- Retryable creates and transitions are idempotent and reject reuse with changed input.
- Concurrent edits use optimistic revisions or serializable transactions according to risk.
- Audit, payment, inventory, fulfillment, customer-consent, and courier events are append-only evidence.
- Public APIs reveal only intentionally public product, item, customer, and operational fields.
- List APIs use bounded pagination, stable ordering, selective projections, and indexed filters.
- UI flows are responsive, keyboard-accessible, dependency-aware, and preserve correctable input.

## 2. Product and inventory onboarding

### 2.1 Decision

Product creation becomes one server-backed workflow with six sections:

1. **Basics** — identity, classification, product type, size system, storefront visibility, and acquisition context.
2. **SKUs** — visual variants, colors, sizes, and a deliberate pooled or serialized tracking choice for every rentable SKU.
3. **Content** — variant media, product description, structured details, FAQs, and public condition policy.
4. **Pricing** — versioned rental rate, duration rules, deposits, fees, discounts, add-ons, and late-fee policy.
5. **Opening inventory** — location-specific pooled receipts or atomic physical-item registration, including set component state.
6. **Review and publish** — one backend readiness report, section-addressable blockers, warnings, and an atomic publish command.

The first valid Basics save creates the real `Product` in `draft` state and a one-to-one `ProductOnboarding` workflow. Subsequent section commands reconcile the real domain records. A browser draft may protect unsaved keystrokes but is never the authoritative workflow state.

### 2.2 Workflow contract

`ProductOnboarding` stores the product, current section, completed-section set, integer revision, creator/updater, and timestamps. It does not duplicate product form data. Every section response returns:

- the authoritative workflow revision;
- normalized section data;
- completed and next allowed sections;
- current readiness blockers and warnings;
- last saved time and actor.

Forward navigation is allowed only when dependencies pass server validation. Backward navigation remains open. A stale revision returns a typed conflict with the current revision and refreshed workflow. Publish re-evaluates the complete product in the transaction; a client cannot publish by declaring sections complete.

The options/SKU command reconciles client-stable row keys so retries and edits cannot duplicate variants. Destructive SKU reconciliation is rejected once operational history exists. Opening inventory uses existing immutable inventory movements: pooled inventory is received through a location pool command; serialized inventory is registered atomically in batches. Zero opening inventory is an explicit valid choice for pre-cataloguing, but it remains a publish warning and makes date availability zero.

### 2.3 Owner experience

The page has a compact progress rail, a primary work area, and a persistent product summary. Desktop and mobile use the same sections without a wide form. Each section saves independently; a user can leave and resume from the product list on another device. Network errors keep form input and reuse the same command key. Validation links to the exact field or row. Review links directly to the blocking section.

After creation, product detail remains the control center for content, pricing, composition, and product-specific inventory, while global Inventory remains the operational workspace for stock, items, service, transfers, counts, and availability.

## 3. Customer domain and future accounts

### 3.1 Customer identity

`Customer` is the tenant-owned commercial person/profile, independent of authentication. It gains normalized phone/email identities, lifecycle status, preferred contact channel/language, source, internal notes summary, risk/deposit flags, consent summary, and derived metrics. Postal addresses move to reusable `CustomerAddress` records with type, recipient, normalized phone, delivery instructions, geographic/provider identifiers, and default flags.

Identity uniqueness is expressed through normalized `CustomerIdentity` records so phone and email can be verified, searched, and merged without relying on a single mutable phone column. Creating a booking resolves or creates a customer through deterministic normalized identifiers. Potential duplicates enter a review queue; merges are explicit, transactional, audited, and redirect all dependent records to the survivor.

### 3.2 Operational customer record

The owner workspace includes:

- searchable/filterable customer list and segments;
- profile, contacts, addresses, preferences, consent, tags, and internal notes;
- booking, payment, deposit, damage, shipment, review, and communication timeline;
- derived lifetime value, completed/cancelled/late rental counts, outstanding balance, active bookings, and last/next activity;
- duplicate review and merge;
- privacy export/anonymization eligibility and retention controls;
- customer account invite/link state without exposing credentials.

Tags use tenant-owned tag definitions rather than unconstrained repeated strings. Notes and consent changes are immutable events with actor and timestamp. Sensitive risk flags are staff-only and permission-gated.

### 3.3 Customer account foundation

Authentication is a separate `CustomerAccount` identity linked to one tenant customer. Guest checkout remains supported. A verified login can claim eligible historical bookings only through a controlled verified-identifier process. The foundation supports future passwordless/OTP authentication, sessions, account security events, saved addresses, booking history, shipment tracking, invoices, deposits, returns, and preferences without coupling storefront customers to owner/staff `User` roles.

## 4. Storefront, cart, checkout, and ordering

### 4.1 Catalogue and product experience

Storefront catalogue is server-rendered for initial discovery with URL-stable search, category, event, size, color, price, and date filters. Product cards show authoritative headline pricing and availability context. Product detail is a configurator: choose variant/SKU, dates, quantity, optional components/add-ons, fulfillment method, and (only when enabled) a public physical item. The backend returns a normalized selection, effective blocked dates, quantity, next available range, quote, deposit, and disclosure.

### 4.2 Cart model

A cart is a tenant-scoped server resource with a public opaque token and optional future customer-account link. Cart lines reference product/SKU selections and store display snapshots only for presentation. Availability and price are revalidated into expiring `CartQuote`/line quote snapshots. Any change to dates, SKU, quantity, fulfillment location/method, components, or add-ons invalidates the applicable quote.

The bag shows each line's dates, location/handover choice, quote validity, conflict state, fees, deposit, and corrective action. It never sums stale client prices as an authoritative total.

### 4.3 Checkout state machine

Checkout stages are:

1. contact/customer resolution;
2. delivery or pickup and return method/address;
3. rental and inventory review;
4. authoritative payment/deposit plan;
5. consent/policies and final confirmation.

Checkout creates or updates one server session, validates section dependencies, and returns a revision. Final submission consumes a current quote and idempotency key, then creates customer/address changes, booking, commercial snapshots, inventory reservations, fulfillment requirements, payment intent/instruction, and order confirmation atomically. Availability or price change returns line-addressable recovery data without losing checkout input.

Booking confirmation exposes a non-guessable guest tracking token. Future signed-in customers access the same booking through account authorization. Public tracking shows customer-safe milestones only; owner operational states and internal notes remain private.

## 5. Shipping and logistics

### 5.1 Domain

Shipping is modeled independently from a booking status:

- `CourierConnection` — tenant/provider account, environment, capabilities, encrypted credential reference, webhook state, and health.
- `Shipment` — one outbound, return, exchange, or recovery movement attached to a booking.
- `ShipmentPackage` — package dimensions, weight, declared value, COD amount, and contents snapshot.
- `ShipmentAttempt` — immutable provider request/response metadata, idempotency, and failure classification.
- `ShipmentEvent` — normalized status plus provider status, occurred/received times, location, source, and payload fingerprint.
- `CourierWebhookInbox` — verified/deduplicated inbound payload processing and replay evidence.
- `CodRemittance` — provider COD collection, fees, remittance reference, reconciliation status, and evidence.

A booking may have multiple shipments and separate outbound/return legs. Manual delivery is a first-class provider for in-house or unsupported couriers, not a fallback pretending to be an API courier.

### 5.2 Provider boundary

Adapters implement capability discovery, service-area lookup, quote when supported, create/cancel, tracking, label/manifest when supported, webhook verification/parsing, and normalized status mapping. Provider-specific identifiers and raw statuses remain at the boundary. Domain workflows depend only on normalized capability/result types.

Pathao supports a developer API and webhook callback configuration through its merchant tooling. Steadfast publicly documents COD, pickup, delivery, returns, nationwide coverage, merchant tracking, warehousing, and packaging, while detailed API contracts are treated as merchant-account material. Therefore adapters are versioned, contract-tested, and disabled until the tenant supplies verified provider credentials/configuration; undocumented behavior is never guessed.

References:

- Pathao merchant developer portal: https://merchant.pathao.com/courier/developer-api
- Pathao Commerce: https://enterprise.pathao.com/
- Pathao developer API/webhook overview: https://pathao.com/blog/pathao-commerce-instant-delivery/
- Steadfast official site: https://www.steadfast.com.bd/
- Steadfast official terms and service scope: https://www.steadfast.com.bd/index.php/terms-and-condition

### 5.3 Workflow

Owner flow: validate address/service area, select connection and service, review quote/COD/package, create shipment idempotently, print/share available evidence, monitor exceptions, and cancel/retry only where provider capability permits. Webhooks are authenticated, deduplicated, stored before processing, and applied monotonically. Polling is a recovery mechanism with bounded backoff, not a competing source of truth.

Shipment milestones update fulfillment only through explicit transition policy. A courier `delivered` event cannot erase incomplete item handout evidence; a return shipment `delivered` creates return intake but does not mark inspected stock available. Failed delivery, refusal, return-to-origin, loss, damage, webhook failure, stale tracking, and COD mismatch have actionable queues.

## 6. Launch-critical platform work

At least these six areas are part of launch closure:

1. **Subscription and entitlements** — authoritative plan features/limits, metering, grace periods, upgrade/downgrade, failed-payment handling, and owner-facing usage.
2. **Staff access control** — permission-level RBAC beyond broad roles, invitations, location scope, sensitive-action step-up rules, and revocation.
3. **Notifications and communication** — transactional outbox, tenant templates, channel preferences, provider attempts, idempotency, retry/dead-letter queue, and customer-safe content.
4. **Finance and reconciliation** — booking receivables, payments/refunds, deposits, damage charges, COD remittance, invoices/receipts, adjustments, and daily reconciliation.
5. **Reporting and analytics** — operational dashboards derived from authoritative events, rentable utilization, revenue, cancellations, maintenance cost, customer value, fulfilment and courier performance, with bounded export jobs.
6. **Security, privacy, and operations** — secrets isolation, audit coverage, rate limits, webhook replay protection, privacy retention/export/anonymization, health/readiness, backups/restore evidence, error monitoring, support impersonation controls, and runbooks.

## 7. Information architecture

Owner navigation is organized by work, not database tables:

- **Overview** — today, attention, and next actions.
- **Catalog** — products and controlled reference data.
- **Inventory** — stock, physical items, availability, service, counts, movements, transfers, locations.
- **Rentals** — bookings/calendar, fulfillment/returns, deliveries/shipments.
- **Customers** — customer records, segments, duplicates, accounts/consent.
- **Finance** — payments, deposits, COD reconciliation, invoices.
- **Reports** — commercial, inventory, customer, and operations analytics.
- **Settings** — store, policies, staff/permissions, courier connections, notifications, billing, security.

Badge counts represent backend queues and link to the exact filter. Common actions remain contextual: Add product from Catalog, add stock from SKU/item context, create booking from Rentals/customer, and create shipment from a booking.

## 8. Error and recovery contract

All APIs use one response/error envelope. Errors include stable code, human-safe message, field/row/line/section context where applicable, retryability, and conflict details. The UI distinguishes initial loading, refresh, empty, no matches, validation, permission, stale revision, availability/pricing conflict, provider failure, and system failure. A retryable request keeps its idempotency key. Financial, destructive, privacy, fulfillment, and courier actions show exact consequences and capture a reason.

## 9. Verification and release gates

Browser and visual verification are excluded by explicit user direction. Completion requires:

- schema validation/generation and a clean migration from an empty database;
- deterministic seed reruns;
- unit tests for validation, state machines, adapters, and error contracts;
- PostgreSQL integration tests for tenant isolation, idempotency, concurrency, deduplication, and rollback;
- backend and frontend production builds;
- contract/type alignment with no frontend/backend gap;
- bounded-query and index review for changed list/lookup paths;
- no placeholder handlers, fake data, TODO workflow branches, legacy credential fields, or duplicate source-of-truth calculations in completed scope;
- release checklist, environment contract, operational runbooks, and rollback-safe migration evidence.

