# ClosetRent Launch Completeness Implementation Plan

**Date:** 2026-08-10

**Design:** `docs/superpowers/specs/2026-08-10-launch-completeness-program-design.md`

**Execution:** Continuous, checkpointed implementation. The user has pre-approved design decisions and requested no approval pauses. Browser and visual verification are excluded.

## Rules

- Do not add compatibility shims or preserve obsolete models merely for legacy behavior.
- Preserve immutable operational evidence and unrelated user work.
- Use focused modules and orchestration services rather than expanding god services.
- Every changed workflow closes database, service, controller, typed client, UI, recovery, navigation, and tests together.
- Commit coherent verified checkpoints. Run focused checks during a checkpoint and full checks at its boundary.
- Apply migrations to disposable databases before the development database.

## Checkpoint A — Server-backed product onboarding

1. Add `ProductOnboarding` with tenant/product uniqueness, revision, current/completed sections, actors, and indexes.
2. Add validated section DTOs and one owner onboarding controller.
3. Implement idempotent Basics creation/resume and tenant-scoped workflow read.
4. Implement revision-checked Basics, SKU reconciliation, Content, Pricing, and Opening Inventory section commands over real domain records.
5. Reuse inventory movements for pooled receipts and atomic serialized batches; do not write quantities directly.
6. Implement dependency gates, readiness projection, and atomic publication.
7. Replace the local-only five-step frontend with the six-section server-backed flow and typed API/hooks.
8. Add draft resume entry points, unsaved-input protection, conflict recovery, section blockers, and accessible mobile layout.
9. Test idempotency, stale revision, reconciliation protection, tenant isolation, partial resumption, inventory rollback, and publication enforcement.
10. Run migration, focused/full tests, production builds, and commit.

## Checkpoint B — Customer domain

1. Replace flat address/tag structures with customer identity, address, tag definition/assignment, preference, consent, note, event, and account-link foundations.
2. Add normalized identifier utilities and constraints.
3. Implement customer create/update, identity resolution, duplicate detection, audited merge, address/default management, consent, notes, tags, account invite/link state, privacy export, and eligible anonymization.
4. Build authoritative customer summary/timeline metrics using bounded projections.
5. Redesign owner list/detail/create/edit/duplicate/segment workflows and integrate booking, payment, deposit, damage, shipment, and communication context.
6. Route storefront/manual booking customer resolution through the same service.
7. Test isolation, normalization, dedupe/merge rollback, account-link security, privacy constraints, and metrics.
8. Run full checkpoint verification and commit.

## Checkpoint C — Storefront and ordering

1. Audit and normalize public catalogue/product contracts, caching rules, filters, pagination, SEO metadata, and intentional field exposure.
2. Add server cart, cart line, quote validity, checkout session, guest tracking token, and explicit state transitions.
3. Implement product configurator and date/SKU/component/add-on/fulfillment selection against authoritative availability and pricing.
4. Rebuild bag around server state, conflict repair, quote expiry, and backend totals.
5. Implement checkout contact, address/pickup, review, payment/deposit, consent, and idempotent final booking transaction.
6. Implement confirmation and customer-safe guest tracking; keep future account authorization compatible.
7. Complete responsive/accessibility/error/empty/loading behavior and eliminate client authority gaps.
8. Test quote invalidation, concurrent stock conflict, retry, tenant/token isolation, atomic booking creation, and public data boundaries.
9. Run full checkpoint verification and commit.

## Checkpoint D — Shipping and courier integrations

1. Replace tenant-level generic/dedicated credential columns with `CourierConnection` and secret references; remove legacy settings/API paths.
2. Normalize shipment/package/attempt/event/webhook/COD-remittance domain and migrate current legitimate history if present.
3. Define provider capability and normalized status contracts.
4. Complete manual, Pathao, and Steadfast adapters using verified provider contracts; add contract fixtures and capability gates.
5. Implement service-area validation, quote where supported, create/cancel, tracking, webhook verify/store/dedupe/process/replay, polling recovery, and bounded retry.
6. Implement outbound/return/exchange legs and fulfillment transition policy.
7. Build courier settings/health, booking shipment creation, shipment detail/timeline, exception queue, and COD reconciliation.
8. Redact credentials/payload secrets from logs, audit, errors, docs, and UI.
9. Test signatures, payload dedupe, monotonic state, out-of-order events, retry/idempotency, RTO/loss/damage, provider outage, and COD mismatch.
10. Run full checkpoint verification and commit.

## Checkpoint E — Launch-critical areas

1. Subscription entitlements and usage enforcement.
2. Permission-level staff RBAC and invitations/location scope.
3. Notification templates, preferences, transactional outbox, retries, and delivery evidence.
4. Finance/reconciliation across booking payment, refund, deposit, damage, courier COD, invoice, and adjustment.
5. Operational/commercial/customer/inventory/courier analytics and bounded exports.
6. Security/privacy/operations: secrets, audit, rate limiting, webhook replay defense, retention/export/anonymization, health, backups, monitoring, support controls, runbooks.
7. Complete owner navigation, queue badges, global command palette/search if supported by existing design, and cross-module contextual links.
8. Test each feature boundary, run production builds, and commit coherent slices.

## Checkpoint F — Release closure

1. Search for placeholder data, TODO/FIXME workflow gaps, unbounded queries, unused legacy fields/routes, duplicate calculations, unsafe secrets, and dead owner/storefront routes.
2. Produce a schema-to-UI launch completeness matrix with evidence for every scoped capability.
3. Verify fresh migration, repeatable seed, backend unit/integration tests, frontend/backend builds, formatting/diff checks, and API type alignment.
4. Review indexes/query shapes, tenant isolation, state transitions, idempotency, concurrency, accessibility-by-code, and mobile behavior-by-code.
5. Add environment contract, migration/deployment checklist, monitoring/backup/restore/support runbooks, and known external-provider prerequisites.
6. Commit final release closure only when no scoped incomplete row remains.

