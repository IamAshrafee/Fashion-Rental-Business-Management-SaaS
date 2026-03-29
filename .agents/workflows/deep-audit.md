---
description: Deep audit a specific module/feature — reads real code, traces user flows, finds real bugs
---

# /deep-audit — Deep Module Audit

The user will specify which module to audit, e.g. `/deep-audit booking` or `/deep-audit product` or `/deep-audit auth`.

Valid module targets:
- `auth` — Login, signup, session, guards, tokens
- `booking` — Booking CRUD, status transitions, calendar
- `product` — Product CRUD, variants, images, categories, trash
- `customer` — Customer CRUD, tags, balance, transactions
- `payment` — Payment recording, refunds, cash tracking
- `staff` — Staff invite, roles, permissions
- `analytics` — Dashboard stats, charts, date ranges
- `settings` — Store settings, branding, business config
- `admin` — Super admin panel, tenant management
- `guest` — Guest storefront, browse, checkout
- `jobs` — Background jobs, cron, queue processing
- `notification` — Email, SMS, in-app notifications

## Phase 1: Backend Deep Read

1. Open the backend module directory: `apps/backend/src/modules/{module}/`
2. Read EVERY file in the module — controller, service, DTOs, module file
3. For each endpoint, trace the full flow:
   - Does the controller validate input (DTOs with class-validator)?
   - Does the service check authorization/ownership?
   - Are Prisma queries using `tenantId` consistently?
   - Are error cases handled (not found, duplicate, invalid state)?
   - Are database transactions used where needed (multi-table writes)?
   - Are return types properly structured (not leaking internal data)?
4. Check for:
   - Missing input validation
   - Missing auth guards
   - Race conditions (concurrent booking of same dates, etc.)
   - Decimal/money handling issues
   - Missing error codes or generic error messages
   - Hardcoded values that should be configurable

## Phase 2: Frontend Deep Read

5. Open the corresponding frontend directory: `apps/frontend/src/app/(owner)/dashboard/{module}/`
6. Read EVERY file — pages, components, hooks, types
7. For each page, trace the real user flow:
   - Does the page fetch real data from the API or use mock/hardcoded data?
   - Are loading states shown while data loads?
   - Are error states handled (network error, 404, 403)?
   - Do form submissions call real APIs?
   - Are mutations invalidating the correct query keys?
   - Do buttons have onClick handlers or are they dead?
   - Are optimistic updates used where appropriate?
8. Check UI for:
   - Hardcoded colors (should use theme tokens like `bg-card`, `text-primary`)
   - Missing dark mode support
   - Accessibility issues (missing labels, keyboard navigation)
   - Missing empty states ("No data" messages)
   - Unresponsive layouts (check for mobile breakpoints)

## Phase 3: API Contract Verification

9. For each backend endpoint, verify the frontend API client matches:
   - Does `lib/api/{module}.ts` have a function for every backend endpoint?
   - Do the TypeScript types match what the backend returns?
   - Are URL paths correct?
   - Are HTTP methods correct (GET vs POST vs PATCH)?

## Phase 4: Cross-Cutting Concerns

10. Check the module for:
    - **Tenant isolation**: Every query filters by tenantId
    - **Permission checks**: Role-based access where needed
    - **Audit trail**: Important actions are logged
    - **Pagination**: List endpoints support pagination
    - **Search**: List endpoints support search/filter
    - **Sorting**: List endpoints support sort order

## Phase 5: Report

11. Create an artifact report with:
    - **🔴 Critical issues** — Bugs that break functionality or leak data
    - **🟡 Significant issues** — Missing features, poor UX, security concerns
    - **🟢 What works well** — Confirmed correct implementations
    - **📋 Recommended actions** — Ordered by priority

Do NOT just check if files exist. Read the actual code, trace real user flows, and find real problems.
