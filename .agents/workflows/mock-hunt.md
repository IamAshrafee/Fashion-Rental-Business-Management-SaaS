---
description: Find and kill all mock data, dead buttons, placeholder content, and TODO debt across the codebase
---

# /mock-hunt — Mock & Dead Code Hunter

// turbo-all

Systematically finds every place where the app fakes it instead of making it. Run this before any release.

## Phase 1: Find Mock Data

1. Search for mock data patterns:
   ```bash
   grep -rn "MOCK_\|mock_\|FAKE_\|fake_\|DUMMY_\|dummy_\|SAMPLE_\|sample_data\|placeholder" apps/frontend/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test."
   ```

2. Search for hardcoded data arrays that bypass API:
   ```bash
   grep -rn "const.*=.*\[" apps/frontend/src/app/ --include="*.tsx" | grep -v "import\|from\|export\|useState\|useRef\|queryKey\|TABS\|columns\|className" | head -30
   ```

3. Search for `// TODO`, `// FIXME`, `// HACK`, `// TEMP`, `// mock`:
   ```bash
   grep -rn "TODO\|FIXME\|HACK\|XXX\|TEMP\|mock.*later\|will.*build.*later\|placeholder" apps/ --include="*.ts" --include="*.tsx" | grep -vi "node_modules"
   ```

## Phase 2: Find Dead Buttons & Links

4. Search for buttons/links with no onClick or href:
   ```bash
   grep -rn "<Button" apps/frontend/src/app/ --include="*.tsx" | grep -v "onClick\|asChild\|type=\"submit\"\|disabled"
   ```

5. Search for components that accept but ignore props:
   ```bash
   grep -rn "_[a-zA-Z]*:" apps/frontend/src/ --include="*.tsx" | grep -v "node_modules\|__" | head -20
   ```

## Phase 3: Find Unused API Functions

6. For each API client file in `lib/api/`, check if every exported function is actually imported somewhere:
   - Read `lib/api/bookings.ts` — list all exported functions
   - Search for each function name in the codebase
   - Flag any function that is defined but never imported

7. Repeat for `lib/api/products.ts`, `lib/api/customers.ts`, etc.

## Phase 4: Find Stale Imports

8. Check for imports from deleted or moved files:
   ```bash
   cd apps/frontend && npx tsc --noEmit 2>&1 | grep "Cannot find module" | head -20
   ```

## Phase 5: Report

9. Create an artifact with:
   - **🔴 Mock data still in use** — Pages rendering fake data
   - **🟡 Dead UI elements** — Buttons/links that do nothing
   - **🟠 Unused code** — API functions never called
   - **📋 TODO debt** — All TODO/FIXME comments with file locations
   - **Fix priority** — Ordered list of what to fix first

10. For each finding, include the **exact file, line number, and code snippet**.
