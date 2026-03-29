---
description: Verify frontend and backend API contracts match — find mismatches, missing endpoints, wrong types
---

# /api-sync — API Contract Sync Check

Ensures every backend endpoint has a matching frontend API client function, and vice versa.

## Phase 1: Inventory Backend Endpoints

1. Extract all controller endpoints from the backend:
   ```bash
   grep -rn "@Get\|@Post\|@Patch\|@Put\|@Delete" apps/backend/src/modules/ --include="*.ts" -A1 | head -100
   ```

2. Extract all controller prefixes:
   ```bash
   grep -rn "@Controller(" apps/backend/src/modules/ --include="*.ts"
   ```

3. Build a complete list of backend endpoints in format:
   `METHOD /api/v1/{prefix}/{path} → {ControllerName}.{methodName}`

## Phase 2: Inventory Frontend API Clients

4. Read all files in `apps/frontend/src/lib/api/`:
   ```bash
   ls -la apps/frontend/src/lib/api/
   ```

5. For each API client file, extract all function definitions:
   ```bash
   grep -rn "async.*=>" apps/frontend/src/lib/api/ --include="*.ts" | grep -v "import\|//"
   ```

6. Extract the HTTP method and URL path from each function:
   ```bash
   grep -rn "apiClient\.\(get\|post\|patch\|put\|delete\)" apps/frontend/src/lib/api/ --include="*.ts"
   ```

## Phase 3: Cross-Reference

7. For each **backend endpoint**, check if a **frontend API function** exists that calls it.
   - Flag: `MISSING_CLIENT` — Backend endpoint with no frontend caller
   
8. For each **frontend API function**, check if a **backend endpoint** exists.
   - Flag: `MISSING_ENDPOINT` — Frontend calls a URL that doesn't exist in the backend

9. Check URL path alignment:
   - Flag: `PATH_MISMATCH` — Frontend calls `/owner/products` but backend is `/owner/product`
   
10. Check HTTP method alignment:
    - Flag: `METHOD_MISMATCH` — Frontend uses GET but backend expects POST

## Phase 4: Type Safety Check

11. For key endpoints (especially list/detail), compare:
    - Backend `select`/`include` in Prisma query → what fields are returned
    - Frontend TypeScript interface → what fields are expected
    - Flag: `TYPE_MISMATCH` — Frontend expects `customer.name` but backend returns `customer.fullName`

## Phase 5: Report

12. Create an artifact report with:

| Endpoint | Backend | Frontend | Status |
|---|---|---|---|
| GET /owner/bookings | booking.controller.ts:151 | bookingApi.list() | ✅ |
| PATCH /owner/bookings/:id/complete | booking.controller.ts:261 | bookingApi.complete() | ✅ |
| GET /owner/analytics/revenue | analytics.controller.ts:22 | — | ❌ MISSING_CLIENT |

13. List specific fixes needed, ordered by severity.
