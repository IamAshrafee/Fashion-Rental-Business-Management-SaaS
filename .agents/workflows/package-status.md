---
description: Check the status of all work packages and what's ready to start
---

# /package-status — Work Package Status Dashboard

// turbo-all

## Steps

1. Read the development overview:
   ```bash
   cat docs/development/_overview.md 2>/dev/null || echo "Overview file not found"
   ```

2. For each package P01-P20, check implementation status:
   ```bash
   for f in docs/development/P*.md; do echo "=== $(basename $f) ==="; head -5 "$f"; echo "---"; done
   ```

3. Quick verification for key packages — check if core files exist:
   ```bash
   echo "=== Backend Modules ==="
   ls apps/backend/src/modules/ 2>/dev/null
   echo "=== Frontend Route Groups ==="  
   ls apps/frontend/src/app/ 2>/dev/null
   echo "=== API Clients ==="
   ls apps/frontend/src/lib/api/ 2>/dev/null
   ```

4. Report status in this format:

   | Package | Status | Key Evidence |
   |---|---|---|
   | P01 | ✅ Done | Monorepo structure, Docker, types package |
   | P02 | ✅ Done | schema.prisma exists with all models |
   | ... | ... | ... |

5. Identify which packages are **ready to start** (all dependencies met).
6. Identify which packages are **blocked** and why.
