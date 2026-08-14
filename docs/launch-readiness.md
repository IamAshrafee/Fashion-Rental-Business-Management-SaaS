# ClosetRent launch readiness

Last verified: 2026-08-11

## Capability closure

| Capability            | Authoritative backend                                                                                                  | Owner/storefront workflow                                                                                       | Recovery and evidence                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Product onboarding    | Revisioned, idempotent six-section onboarding over catalogue, SKU, content, pricing, composition and inventory records | Resumable create/edit/review/publish flow with readiness blockers                                               | Command ledger, database transactions and PostgreSQL integration coverage                        |
| Serialized inventory  | Product → variant/SKU → exact physical items, locations, buffers and date reservations                                 | Inventory overview, SKU stock, physical items, identity counts, transfers, inspections, issues and service work | Item movement/lifecycle ledgers, optimistic versions, idempotency and concurrency tests          |
| Customers             | Normalized identities, addresses, consent, tags, notes, merges, privacy export/anonymization and account foundation    | Operational customer list/detail plus booking-linked history                                                    | Tenant constraints, event history and merge/privacy tests                                        |
| Storefront ordering   | Server cart, signed capability cookie, authoritative quote, date availability, checkout and private tracking token     | Catalogue, product configurator, bag, checkout, confirmation and tracking                                       | Quote/cart binding, atomic consumption, replay protection and integration tests                  |
| Shipping and COD      | Encrypted per-tenant courier connections, shipment legs/events/attempts, webhook dedupe and COD remittance             | Delivery queue, shipment timeline, return shipment and COD reconciliation                                       | Monotonic provider updates, polling, cancellation safety and adapter/integration tests           |
| Staff access          | Single-use hashed invitation tokens, expiry/revocation, role ceiling and restrictive feature permissions               | Invite-link handoff, self-selected password, pending invitation revocation and access editor                    | Immediate session revocation, invitation ledger and PostgreSQL contracts                         |
| Subscriptions         | Fail-closed store entitlement plus product, monthly booking and active/pending staff limits                            | Subscription, resource usage and billing history stay reachable after expiry                                    | Idempotent command replays bypass new-usage checks; explicit test fixtures                       |
| Notifications         | In-app records plus durable SMS delivery outbox                                                                        | Notification centre                                                                                             | Five-attempt exponential retry, restart/5-minute recovery, dead-letter jobs and delivery errors  |
| Analytics and exports | Revenue, booking, customer, inventory, recovery, utilization and storefront funnel projections                         | Date-range dashboard and authenticated CSV downloads                                                            | Tenant-scoped 10,000-row bounds, private/no-store responses and spreadsheet-injection escaping   |
| Operations/security   | Global authentication, tenant/rate/subscription/permission guards, encrypted secrets and validated production config   | Clear expired-subscription path and courier health controls                                                     | `/api/v1/health/live`, `/api/v1/health/ready`, audit/dead-letter views and clean migration tests |

## Deployment gate

1. Set every production-required variable in `docs/environment-variables.md`. Startup intentionally fails for missing/default JWT, courier-encryption or SMS gateway secrets.
2. Provision PostgreSQL 16, Redis 7 and S3-compatible object storage with backups enabled.
3. Run `npm ci`, `npm run db:validate`, `npm run db:migrate`, and `npm run db:seed` once for an empty installation.
4. Build with `npm run build:types`, `npm run build:backend`, and `npm run build:frontend`.
5. Check `/api/v1/health/live` and `/api/v1/health/ready` before adding the instance to the load balancer.
6. In each tenant, configure and test Pathao/Steadfast under **Settings → Delivery** before dispatching live parcels.
7. Verify the SMS gateway accepts the documented JSON/Bearer contract and that a test delivery reaches a controlled number.
8. Confirm database point-in-time recovery, object-storage versioning and Redis persistence/monitoring according to the hosting platform.

## Operational response

- Failed async jobs: inspect `/api/v1/admin/failed-jobs`; correct the dependency or credentials before retrying.
- Failed SMS: inspect `notification_deliveries`. Due deliveries below five attempts are recovered every five minutes and at process startup.
- Courier outage: keep the shipment in its safe internal state, use manual dispatch when appropriate, then replay/poll provider updates after recovery.
- Webhook disorder: never edit shipment state directly; stored provider events are deduplicated and applied monotonically.
- Subscription expiry: owner subscription/resource/billing endpoints remain accessible; operational mutation is blocked until entitlement is restored.
- Database restore: restore to a separate database, run Prisma migration status plus integration checks, then promote using the hosting provider’s controlled cutover procedure.

External production accounts, live courier credentials, an approved SMS sender/gateway, DNS/TLS, monitoring destinations and backup schedules remain deployment inputs—not application code fallbacks.
