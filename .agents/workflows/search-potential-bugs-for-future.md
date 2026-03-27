---
description: search for bugs in the current codebase
---

# /search-potential-bugs-for-future — Bug Hunter

// turbo-all

## Steps

1. Scan the codebase for common bug patterns:

### Backend (NestJS + Prisma)

2. Search for missing `tenantId` filters:
   ```
   grep -rn "findMany\|findFirst\|findUnique\|updateMany\|deleteMany" apps/backend/src/ --include="*.ts" | grep -v tenantId
   ```
   Any tenant-scoped query without `tenantId` is a **data leak bug**.

3. Search for raw Decimal usage (should be Int):
   ```
   grep -rn "Decimal\|decimal\|DECIMAL" apps/backend/ --include="*.ts" --include="*.prisma"
   ```

4. Search for hardcoded values that should be env vars:
   ```
   grep -rn "localhost\|127.0.0.1\|:5432\|:6379\|:9000" apps/backend/src/ --include="*.ts" | grep -v node_modules
   ```

5. Search for missing auth guards:
   ```
   grep -rn "@Controller\|@Get\|@Post\|@Patch\|@Delete" apps/backend/src/ --include="*.ts" | grep -v UseGuards | grep -v Public
   ```
   All endpoints should have `@UseGuards()` unless explicitly `@Public()`.

6. Search for N+1 query patterns:
   ```
   grep -rn "for.*of.*await\|forEach.*await" apps/backend/src/ --include="*.ts"
   ```

### Frontend (Next.js)

7. Search for direct API calls without error handling:
   ```
   grep -rn "axios\.\|fetch(" apps/frontend/src/ --include="*.ts" --include="*.tsx" | grep -v try | grep -v catch
   ```

8. Search for missing loading states:
   ```
   grep -rn "useQuery\|useMutation" apps/frontend/src/ --include="*.ts" --include="*.tsx" | grep -v isLoading | grep -v isPending
   ```

9. Search for hardcoded strings that should be tenant-configurable:
   ```
   grep -rn "BDT\|৳\|\.com\.bd\|Bangladesh" apps/frontend/src/ --include="*.ts" --include="*.tsx"
   ```

### Both

10. Search for TODO/FIXME/HACK comments:
    ```
    grep -rn "TODO\|FIXME\|HACK\|XXX" apps/ --include="*.ts" --include="*.tsx"
    ```

11. Report all findings with file, line number, and fix recommendation.
