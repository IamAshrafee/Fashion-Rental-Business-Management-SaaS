# Owner Dashboard Workflow Completion Implementation Plan

**Design:** `docs/superpowers/specs/2026-08-03-owner-dashboard-workflow-completion-design.md`

**Strategy:** Deliver typed vertical slices. Each task ends with focused verification, and each checkpoint ends with backend tests plus frontend/backend production builds. Browser and visual verification are intentionally excluded.

## Checkpoint A — Shared workspace and Catalog

### Task A1: Canonical product list contract

- Extend `ProductQueryDto` with validated owner filters and enum-backed sort/order values.
- Refactor `ProductService.listOwner` to use explicit projections, stable server sorting, and `totalPages` metadata.
- Return category/type, variant/SKU counts, tracking summary, inventory summary, image, price, and backend-derived readiness.
- Add focused unit tests for tenant scope, filters, sort normalization, and readiness.

### Task A2: Owner list query-state foundation

- Add small URL query parsing/updating utilities and a debounced value hook.
- Keep domain columns inside the product module rather than building an over-general table framework.
- Add shared pagination, list-empty, list-error, and loading skeleton components using installed UI primitives.

### Task A3: Catalog page completion

- Replace the current fixed 50-record/client-pagination page with URL-driven server pagination.
- Add search, status, category, product type, tracking, and readiness filters.
- Add stable server sort controls, result counts, readiness/inventory columns, responsive row actions, and clear filtered/unfiltered empty states.
- Add route `loading.tsx` and `error.tsx`.

### Task A4: Product draft lifecycle

- Add idempotent product-draft creation support using the project’s existing idempotency infrastructure or a narrow persisted command record.
- Make the created product ID part of the route and resume editing that draft.
- Correct optional identical-color validation and prevent publish until backend readiness passes.
- Split creation orchestration from section rendering without duplicating edit behavior.
- Add creation/retry/readiness tests.

### Task A5: Checkpoint verification

- Run focused backend tests and frontend type/lint checks for changed files.
- Run backend and frontend production builds.
- Commit Checkpoint A.

## Checkpoint B — Inventory

### Task B1: Inventory overview projection

- Consolidate or parallelize inventory summary queries.
- Return actionable queue counts and link dimensions.
- Connect every metric to a filtered operational route.

### Task B2: Stock by SKU

- Add tenant/location-scoped backend query with pooled and serialized capacity projections.
- Add URL-driven page, filters, sorting, pagination, and tracking-specific actions.
- Add the route to grouped Inventory navigation.

### Task B3: Physical Items

- Complete server filters for product/SKU, location, state, disposition, condition, service/issue state, and optional date availability.
- Replace keystroke requests with debounced URL state.
- Add responsive operational columns and scoped detail links.

### Task B4: Atomic item registration

- Add single/batch registration DTO and transactional service command with idempotency.
- Add global and SKU-scoped registration workflow with generated-code preview and validation recovery.
- Add unit and PostgreSQL integration tests.

### Task B5: Checkpoint verification

- Run focused tests, type/lint checks, and both production builds.
- Commit Checkpoint B.

## Checkpoint C — Bookings

### Task C1: Booking list and queues

- Add queue-count projection and server-authoritative sort/filter contract.
- Persist view, search, filters, pagination, and sorting in the URL.
- Surface operational blockers and next actions in responsive rows.

### Task C2: Manual booking decomposition

- Extract Customer, Rental Plan, Items, Price/Payment, and Review sections.
- Extract focused availability/cart/quote/create hooks with typed state.
- Keep heavy optional UI out of the first route bundle.

### Task C3: Quote and create conflict safety

- Track quote version/freshness explicitly.
- Revalidate pricing and availability in the atomic create command.
- Add an idempotency key and recover line-by-line from availability or pricing conflicts without losing form state.

### Task C4: Detail and fulfilment organization

- Separate commercial summary from requirement-level fulfilment.
- Show blocking reason, source, assignment, and next valid action for each requirement.
- Preserve pooled quantity semantics and serialized identity semantics.

### Task C5: Checkpoint verification

- Run focused tests, type/lint checks, and both production builds.
- Commit Checkpoint C.

## Checkpoint D — Completion audit

- Audit every changed route for loading, empty, validation, permission, conflict, retry, and history states.
- Audit API names and response metadata for one authoritative contract.
- Review tenant scoping, explicit selects, indexes, query counts, client bundle boundaries, accessibility, and mobile behavior in code.
- Run all backend tests, integration tests against an isolated PostgreSQL database, database validation, and both production builds.
- Record verification in the design specification and commit the completion audit.
