# Owner Dashboard Workflow Completion Design

**Date:** 2026-08-03

**Status:** Approved direction; awaiting written-spec review

**Scope:** Complete the owner-facing Catalog, Inventory, Physical Items, and Bookings workspaces on top of the authoritative rental inventory domain. The result must be usable for daily business operations, keep frontend and backend contracts aligned, and work efficiently on desktop and mobile staff devices.

## 1. Decision

The dashboard will be completed as workflow-first vertical slices, not as a cosmetic redesign and not as a disconnected frontend rewrite.

Delivery order:

1. shared owner-workspace primitives and URL state;
2. Catalog and the product creation/editing lifecycle;
3. Inventory overview, stock by SKU, and physical-item operations;
4. Booking queues, manual booking creation, and booking fulfilment;
5. cross-module contract, accessibility, performance, and verification audit.

Each slice includes the backend query or mutation contract, typed frontend API, discoverable route, operational states, and focused tests. A screen is not complete when it only displays data; it is complete when staff can understand the current state, perform the next valid action, and recover from errors or conflicts.

## 2. Product principles

- Use the language of the business: Catalog, Stock, Physical items, Rentals, Returns, and Service.
- Separate customer-facing products from operational inventory without hiding their relationship.
- Show staff why an action is blocked and what resolves it.
- Persist list state in the URL so refresh, back navigation, bookmarks, and shared links preserve the working context.
- Keep authoritative availability, pricing, reservations, and state transitions on the backend.
- Prefer progressive disclosure: common actions are immediate; advanced configuration remains accessible without overwhelming routine work.
- Require explicit confirmation and a reason for destructive or financially meaningful actions.
- Optimize mobile layouts for lookup, scanning, assignment, handout, return, and inspection.
- Do not retain duplicate or compatibility workflows. Existing pages are replaced or refactored onto the final contracts.

## 3. Information architecture

The existing grouped owner navigation remains the foundation and is completed as follows.

### Catalog

- Products
- Categories
- Product types
- Size systems
- Events and collections

Catalog owns what the business offers: merchandising, variants, rentable SKUs, composition, pricing, services, media, and publication readiness.

### Inventory

- Overview
- Stock by SKU
- Physical items
- Locations
- Transfers
- Inspections and issues
- Cleaning and repair
- Policies and blackouts
- Movements and stock counts

Inventory owns what physically exists, where it is, whether it can fulfil a rental, and what work is required before it becomes available.

The first implementation completes Overview, Stock by SKU, Physical Items, Locations, and Transfers. Existing item-detail lifecycle features remain linked from Physical Items. Inspection, service, policy, movement, and stock-count entry points may initially be filtered operational views backed by the existing domain; they must not be fake or empty navigation.

### Rentals

- All bookings
- Calendar
- Requests
- Preparation
- Handout and pickup
- Returns and inspection intake
- Overdue and exceptions

The initial booking workspace uses one list route with URL-addressable operational views. Separate routes are added only when a workflow requires materially different data or interaction.

## 4. Shared owner-workspace foundation

### 4.1 Page structure

Operational pages use a consistent structure:

1. breadcrumb and page title;
2. short purpose or current scope;
3. primary action and relevant secondary actions;
4. optional summary metrics or queue counts;
5. filter and search toolbar;
6. result table or task-focused content;
7. pagination and result count;
8. contextual empty, error, permission, conflict, and stale-state handling.

Reusable components will cover the repeated behavior without creating a universal, over-configured table abstraction. Domain pages retain control of their columns, row actions, and mobile presentation.

### 4.2 URL query state

List pages use canonical query parameters:

- `page`, `limit`;
- `q` for debounced search;
- `sort`, `order`;
- domain filters such as `status`, `category`, `trackingMode`, `location`, `condition`, `from`, and `to`;
- `view` for an operational queue such as `requests` or `returns`.

Changing search, a filter, or sort resets `page` to 1. Default values are omitted from the URL. Invalid values are normalized to safe defaults. Navigation updates are transitions so the previous results remain usable while new data loads.

### 4.3 Data loading and rendering

The current authenticated API model is retained. Interactive owner lists remain focused client components where authentication and mutations require them, while static route structure and loading/error boundaries use App Router conventions.

- Requests with independent dependencies start together.
- Search is debounced; explicit filters apply immediately.
- Server pagination and stable server sorting are authoritative.
- Client sorting of only the current page is removed.
- Heavy forms or calendars are dynamically loaded when they are not required for the first render.
- Results are not duplicated into unnecessary derived state.
- Mutations invalidate only relevant queries and preserve the user’s current URL context.

### 4.4 Shared operational states

Every completed route provides:

- a route-level `loading.tsx` skeleton;
- a route-level `error.tsx` retry experience where appropriate;
- an empty state that distinguishes “no records yet” from “no filter matches”;
- inline validation for correctable input errors;
- a conflict state for stale data, changed availability, or concurrent inventory use;
- retry behavior that cannot duplicate a successful mutation;
- accessible dialog/sheet titles, keyboard navigation, and labeled controls.

## 5. Catalog workspace

### 5.1 Product list

The product list becomes a server-driven catalog workspace.

It displays:

- product name and primary image;
- category and product type;
- publication status;
- variant and SKU counts;
- tracking summary: serialized, pooled, or mixed;
- inventory/readiness summary;
- missing requirements such as pricing, images, SKU identity, or inventory;
- last updated time;
- context-aware actions.

Filters include search, status, category, product type, tracking mode, readiness, and stock state. Sorting includes updated date, name, creation date, publication status, and optionally inventory attention. Pagination is entirely server-side.

Row actions include view, edit, manage composition, manage inventory, duplicate into a new draft when explicitly requested, publish/unpublish when valid, and archive/restore. Actions unavailable in the current state show the blocking reason.

### 5.2 Product readiness

The backend returns a typed readiness projection instead of making the frontend infer publication safety from several payloads.

Readiness checks include:

- required catalog identity and category/type;
- at least one valid variant and rentable SKU;
- unique SKU identity where required;
- a valid authoritative pricing profile;
- required storefront media;
- valid bundle/component configuration;
- an inventory source appropriate to each SKU’s tracking mode;
- no blocking configuration errors.

Readiness is informative while drafting and enforced on publication. Inventory may legitimately be zero, but the product then publishes as unavailable rather than pretending capacity exists.

### 5.3 Product creation workflow

Product creation is one resumable draft lifecycle with six logical sections:

1. **Basics:** name, description, category, product type, event/collection, storefront identity.
2. **Variants and SKUs:** colors, sizes, SKU codes, pooled or serialized tracking choice.
3. **Pricing and services:** authoritative pricing profile, deposit, included or optional services.
4. **Media:** primary image, gallery, per-variant images, ordering, alt text.
5. **Initial inventory:** location pools for pooled SKUs or physical-item registration for serialized SKUs.
6. **Review and publish:** readiness checklist, storefront summary, save draft, or publish.

The first successful Basics save creates one draft and returns its ID. Every later save updates that draft. The ID is kept in the route so refresh or browser navigation resumes the same product. Retrying a timed-out create request uses an idempotency key and cannot create another draft.

Sections save independently, but navigation reports unsaved changes. A section failure leaves completed sections intact. Publishing performs one backend readiness validation and returns field/section-specific failures. The frontend never performs a sequence that can partially publish the product.

Secondary identical colors are optional. Variant combinations and SKU identities are validated before the initial-inventory section.

### 5.4 Product editing

Creation and editing reuse section components and domain hooks. Editing does not reuse a monolithic create-only state object.

- Existing drafts reopen at the first incomplete section or the requested section.
- Published products can be edited safely; changes that would invalidate active bookings are rejected or versioned by the backend.
- Tracking mode cannot silently change when inventory or active requirements exist.
- Product detail exposes Catalog, Composition, Inventory, Pricing, and History entry points without duplicating global inventory tools.

## 6. Inventory workspace

### 6.1 Inventory overview

The overview is an action dashboard, not a decorative collection of totals.

It shows:

- available, reserved, out, unavailable, and incoming stock summaries;
- serialized and pooled inventory totals;
- shortages affecting bookings;
- items awaiting preparation, return inspection, cleaning, or repair;
- transfer exceptions and overdue receipts;
- low-stock pooled SKUs;
- condition, retirement, and unresolved-issue attention;
- location-specific scope when selected.

Each metric links to the relevant filtered workspace. Independent summary requests execute concurrently or use a consolidated backend projection when that avoids repeated aggregation.

### 6.2 Stock by SKU

This new page is the complete stock-control view for both tracking modes.

Each row represents a rentable SKU, optionally expanded or filtered by location, and shows:

- product, variant, size, and SKU code;
- tracking mode;
- on-hand, reserved, available, unavailable, outgoing, and incoming quantities;
- physical-item count for serialized SKUs;
- location distribution;
- next booking pressure or shortage indicator;
- valid stock actions.

Pooled actions include adjustment with reason, movement history, reorder threshold, and transfer. Serialized actions include registering physical items, opening the filtered item list, and transfer. Direct quantity editing is never exposed.

### 6.3 Physical items

Physical Items is exclusively the serialized-asset register.

Filters include search, product/SKU, location, operational state, disposition, condition, component completeness, issue/service state, and availability for an optional date range. Search covers asset code, barcode, SKU, and product name.

The table shows:

- asset code and barcode;
- product/variant/size;
- current location;
- disposition, operational state, and condition;
- current or next booking context when relevant;
- component completeness and open issue indicator;
- rental count and last activity;
- next valid actions.

The mobile presentation favors asset code, state, location, and one primary action, with remaining actions in a menu.

### 6.4 Registering physical items

Staff can enter registration from Physical Items, Stock by SKU, or a product’s inventory view.

The workflow supports:

- selecting a serialized SKU when not pre-scoped;
- choosing location;
- entering or auto-generating tenant-unique asset codes;
- optional barcode values;
- quantity-based batch creation with a preview of generated identities;
- acquisition date/cost, condition, and initial component state;
- printable/exportable identifiers only when an existing supported output path exists.

Batch registration is one backend command with idempotency and per-row validation. It either creates the valid requested batch atomically or returns a correctable preview; it does not leave an unexplained half-batch.

### 6.5 Inventory actions and conflicts

- All adjustments, movements, transfers, assignments, and lifecycle changes use command endpoints.
- Every command returns the updated version or record and an audit/history reference.
- Stale versions return a conflict with the latest state and a safe reload action.
- Operational state transitions expose only valid next states.
- A blocked action explains the active booking, service work, location rule, or transfer causing the block without exposing unrelated customer data.

## 7. Bookings workspace

### 7.1 Booking list and operational views

The booking list becomes a queue-oriented workspace with URL-addressable views:

- all;
- requests awaiting decision;
- confirmed/upcoming;
- preparation required;
- ready for handout;
- out for rental;
- returns due/intake;
- overdue;
- cancelled/completed history.

Queue counts are server-derived and independent of the current page. Filters include search, status, date range, fulfilment location, handover mode, payment state, assignment state, and shortage/exception state. Server sorting replaces current-page sorting.

Rows surface booking number, customer, rental range, fulfilment summary, location/handover, payment state, operational state, conflicts, and the next valid action. Bulk actions are offered only for transitions that are safe and homogeneous.

### 7.2 Manual booking workflow

The existing monolithic form is decomposed into route-level orchestration, focused section components, and domain hooks. The user experience has five stages:

1. **Customer:** find or create the customer and select contact/delivery details.
2. **Rental plan:** choose rental dates, fulfilment location, pickup/delivery method, and relevant policy options.
3. **Items:** search products, select variants/SKUs or bundles/add-ons, check date/location availability, and build the rental cart.
4. **Price and payment:** request the authoritative quote, apply permitted adjustments, record deposit/payment information, and show balance.
5. **Review and create:** show customer, dates, fulfilment, inventory warnings, financial summary, notes, and confirmation choice.

Changing dates, location, fulfilment method, quantities, or selected components invalidates the existing quote and availability result. The UI clearly marks the quote as updating or stale; it never silently submits old figures.

Creation sends the quote/version reference and one idempotency key. The backend revalidates availability and pricing inside the atomic booking transaction. Success routes to the booking detail. Availability or pricing conflicts retain form state, identify the affected lines, and offer recheck/substitution/removal rather than clearing the booking.

Draft manual bookings are not introduced unless the backend owns a real, resumable booking-draft aggregate. Local form persistence may protect accidental navigation but is versioned and contains no sensitive payment data.

### 7.3 Booking detail and fulfilment

Booking detail is organized in two layers:

- commercial summary: customer, dates, handover, payment, totals, notes, and communication;
- fulfilment workspace: requirements, source location, reservations, physical assignments, preparation, handout, return, inspection, service, substitutions, and immutable history.

Each requirement shows its state, blocking reason, selected/assigned inventory, and next valid action. Assigning serialized items uses a date/location-eligible candidate list and prevents duplicate assignment. Pooled requirements show reserved quantity and shortages rather than fake item identities.

Status transitions are derived from completed operational facts where possible. A booking does not become ready merely because a user manually selected a label.

## 8. Backend and frontend contracts

The frontend must not compensate for incomplete list or readiness APIs. Required backend additions/refinements include:

- stable server-side product filters, sorting, pagination, and readiness projection;
- inventory overview projection;
- stock-by-SKU query covering pooled and serialized capacity by location;
- physical-item search/filter/sort contract;
- atomic batch physical-item registration;
- booking queue counts and server-side list sorting;
- explicit quote freshness/version response;
- idempotency for product draft creation, item batch creation, and manual booking creation;
- consistent pagination metadata using `page`, `limit`, `total`, and `totalPages`;
- typed conflict payloads with machine code, safe message, affected identity, and current version when applicable.

All filters are tenant-scoped, validated, and indexed according to actual query paths. List endpoints return only fields required for the list; large histories and nested records remain independently paginated.

## 9. Error and recovery model

Errors are classified so the UI can provide the correct recovery:

- **validation:** field/section correction;
- **permission:** explain unavailable action without retry loops;
- **not found:** route-level not-found or a removed-row refresh;
- **conflict/stale version:** show current state and reload/merge-safe retry;
- **availability conflict:** identify affected rental requirements and recheck options;
- **pricing conflict:** refresh quote and highlight changed amounts;
- **network/transient:** preserve input and provide idempotent retry;
- **unexpected server error:** retain context, provide retry, and expose a trace/reference ID when available.

Optimistic UI is limited to reversible presentation changes. Inventory, booking, pricing, payment, and publication state are updated only after authoritative success.

## 10. Performance targets

- No owner list requests an unbounded result set.
- Search produces at most one request after the debounce period for a typing burst.
- Independent summary requests are parallelized; repeated identical client requests are deduplicated.
- Table rows do not trigger per-row API requests.
- Product and booking creation load heavy optional sections only when reached.
- Route bundles avoid importing calendars, image management, or large forms into unrelated list pages.
- Backend list queries select explicit fields and use stable indexed ordering.
- Summary counts are consolidated or projected when direct aggregation becomes expensive.
- The UI remains usable while route-query transitions are pending and prevents duplicate mutations.

## 11. Accessibility and responsive behavior

- All interactive controls are keyboard reachable and have accessible names.
- Dialogs, sheets, and confirmations have titles and descriptions.
- Status is communicated by text and semantics, not color alone.
- Tables provide a compact mobile representation rather than horizontal overflow for primary workflows.
- Touch targets remain usable for warehouse/operations staff.
- Validation associates messages with fields and focuses the first invalid section on submit.
- Destructive confirmations name the affected product, item, or booking.

## 12. Verification strategy

No browser or visual verification will be performed, per project direction.

Verification includes:

- backend unit tests for filters, readiness, counts, command guards, and conflict responses;
- PostgreSQL integration tests for idempotency and capacity-sensitive commands;
- frontend tests for URL normalization, workflow reducers/hooks, readiness mapping, stale quote handling, and mutation recovery where the project test stack supports them;
- TypeScript checking and focused lint for changed files;
- backend and frontend production builds;
- clean database migration/seed only when the schema changes;
- API contract searches to ensure old request/response shapes are not left behind.

Existing unrelated repository lint warnings do not block a slice, but newly changed files must not add warnings. Touched legacy warnings are removed when the relevant code is refactored.

## 13. Delivery checkpoints

### Checkpoint A — Shared workspace and Catalog

- canonical pagination and query-state utilities;
- shared operational page/list states;
- product list backend contract and scalable UI;
- readiness projection;
- resumable, idempotent product draft workflow;
- create/edit section decomposition;
- focused tests and builds.

### Checkpoint B — Inventory

- actionable overview projection and links;
- Stock by SKU endpoint and page;
- Physical Items filtering and URL state;
- atomic single/batch registration;
- mobile-safe actions and item-detail links;
- focused tests and builds.

### Checkpoint C — Bookings

- booking queue counts and server list sorting;
- URL-addressable operational views;
- decomposed manual booking workflow;
- quote freshness and conflict recovery;
- booking detail/fulfilment organization;
- focused tests and builds.

### Checkpoint D — Completion audit

- frontend/backend capability matrix;
- loading, empty, validation, permission, conflict, retry, and history audit;
- tenant isolation and query/index review;
- responsive/accessibility code review;
- full tests and production builds;
- documentation of any genuinely out-of-scope future capability.

## 14. Acceptance criteria

- Staff can discover and use Catalog, Stock by SKU, Physical Items, and booking queues from grouped navigation.
- Product lists remain correct beyond one page and preserve filters/sort in the URL.
- One product draft is created and resumed through variants, pricing, media, inventory, and publication without duplicate drafts.
- Publication readiness is backend-derived and explains every blocker.
- Pooled and serialized inventory appear together at SKU level while individual physical items remain serialized-only.
- Physical items can be registered singly or in an atomic batch from a global or scoped workflow.
- Inventory metrics and warnings lead to actionable filtered pages.
- Booking list sorting, filtering, pagination, and queue counts are server-authoritative.
- Manual booking creation revalidates authoritative availability and pricing atomically and recovers safely from conflicts.
- Booking detail clearly connects commercial lines to fulfilment requirements and physical assignments.
- All completed routes include meaningful loading, empty, error, permission, conflict, and retry states.
- Changed APIs and UI contracts are typed consistently with no fallback compatibility path.
- Focused tests, backend build, and frontend production build pass without browser verification.

## 15. Explicit non-goals for this delivery

- A new native mobile application.
- Customer-facing selection of a specific physical piece.
- Offline-first warehouse synchronization.
- New label-printer hardware integration.
- Predictive demand or condition-based AI pricing.
- A separate draft-booking domain solely to preserve partially completed manual forms.

These may be designed later against real operational evidence. The completed workflows keep extension points for them without adding speculative complexity now.
