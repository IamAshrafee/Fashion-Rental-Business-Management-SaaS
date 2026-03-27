---
description: Execute a development work package (P01-P20) end-to-end
---

# /develop — Execute a Work Package

// turbo-all

## Prerequisites
1. Identify which package to execute (P01–P20). The user will specify which one, e.g., `/develop P04`.
2. Read the master plan first: `docs/development/_overview.md`
3. Verify all REQUIRES packages are complete (check the codebase for their output contracts)

## Steps

### Phase 1: Understand (Do NOT skip)

4. Read the package file: `docs/development/P{XX}-{name}.md`
5. Read ALL listed **Reference Docs** in the package file — every single one
6. Read ALL listed **Cross-cutting docs** (architecture-decisions.md, coding-standards.md, etc.)
7. Understand the **Output Contracts** — what other packages depend on from this work
8. Check existing code to understand what's already built (from previous packages)

### Phase 2: Plan

9. Create an implementation plan artifact listing every file you will create or modify
10. Break down the scope into ordered sub-tasks
11. Identify any ambiguities — if critical, ask the user via notify_user. Otherwise, follow architecture-decisions.md

### Phase 3: Implement

12. Implement each sub-task in dependency order
13. Follow these project rules AT ALL TIMES:
    - All money fields are `Int` (never Decimal) — ADR-04
    - All DB queries must include `tenantId` filter — tenant isolation
    - Use `@map("snake_case")` for all Prisma fields — coding standards
    - Use class-validator DTOs for all inputs — input validation
    - Emit events via EventEmitter2 for cross-module communication
    - Use `@Roles()` + `@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)` on protected endpoints
    - Frontend: ShadCN/ui for owner/admin portals, custom Tailwind for guest storefront
    - All API responses use `{ success, data, message }` format
14. Write clean, production-ready code — not MVP/prototype code
15. Add inline comments only for non-obvious logic

### Phase 4: Verify

16. Run the acceptance criteria from the package file
17. Fix any failing tests or broken functionality
18. Run `npm run lint` and fix any lint errors
19. Verify output contracts are met (other packages can consume your work)

### Phase 5: Commit

20. Stage all changes: `git add -A`
21. Commit with descriptive message following conventional commits:
    ```
    feat(module): description of what was built
    
    - Bullet points of key features
    - References to package number
    ```
22. Update the package status in `docs/development/_overview.md` from ⬜ to ✅
