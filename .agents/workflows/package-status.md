---
description: Check the status of all work packages and what's ready to start
---

# /package-status — Development Progress Dashboard

// turbo-all

## Steps

1. Read `docs/development/_overview.md`
2. Check the Package File Index table for current status (⬜ or ✅) of all 20 packages
3. For each package, verify status by checking if the output contracts exist in the codebase:
   - P01: Check if `apps/backend/src/main.ts` and `apps/frontend/src/app/layout.tsx` exist
   - P02: Check if `apps/backend/prisma/schema.prisma` exists with all models
   - P03: Check if `apps/backend/src/modules/auth/` has auth.service.ts, auth.controller.ts
   - P04: Check if `apps/backend/src/modules/product/` has product.service.ts
   - P05: Check if `apps/backend/src/modules/customer/` has customer.service.ts
   - P06: Check if `apps/backend/src/modules/tenant/` has settings.service.ts
   - P07: Check if `apps/backend/src/modules/booking/` has booking.service.ts
   - P08: Check if `apps/backend/src/modules/payment/` has payment.service.ts
   - P09: Check if `apps/backend/src/modules/courier/` has courier.service.ts
   - P10: Check if `apps/backend/src/modules/notification/` has notification.service.ts
   - P11-P20: Check if corresponding frontend pages/components exist

4. Display a status report:
   ```
   ✅ P01 — Project Scaffolding
   ✅ P02 — Database Schema
   ⬜ P03 — Auth & Tenant (READY — all deps met)
   ⬜ P04 — Product Management (BLOCKED — needs P03)
   ...
   ```

5. Identify which packages are **READY** to start (all dependencies complete)
6. Suggest the next best package(s) to work on
