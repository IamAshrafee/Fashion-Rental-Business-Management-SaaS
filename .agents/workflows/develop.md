---
description: Execute a development work package (P01-P20) end-to-end
---

# /develop — Execute a Work Package

// turbo-all

## Prerequisites
1. Identify which package to execute (P01–P20). The user will specify which one, e.g., `/develop P04`.
2. Read the project rules: `.agents/rules.md` — these are NON-NEGOTIABLE.
3. Read the master plan: `docs/development/_overview.md` — understand where this package fits.
4. Verify all REQUIRES packages are complete by checking the codebase for their output contracts.
5. If any dependency is missing, STOP and notify the user immediately.

## Steps

### Phase 1: Context Loading (Efficiency-Optimized)

Read docs in this EXACT priority order to build understanding fastest:

6. **Rules first:** `.agents/rules.md` — 2 min read, prevents 90% of mistakes
7. **Your package file:** `docs/development/P{XX}-{name}.md` — your mission brief
8. **Architecture decisions:** `docs/architecture-decisions.md` — the 28 golden rules. Skim for relevant ADRs.
9. **Coding standards:** `docs/coding-standards.md` — naming, patterns, structure
10. **Package-specific reference docs:** Read ONLY the docs listed in your package's REFERENCE DOCS section. Do NOT read unrelated docs.
11. **Existing code:** Scan `apps/backend/src/modules/` and `apps/frontend/src/` to understand what already exists. Use `list_dir` and `view_file` on key files (module.ts, service.ts) — don't read every file.

> **Efficiency rule:** If a reference doc is > 100 lines, read the structure/headings first (first 30 lines), then deep-dive only into sections relevant to your deliverables. You don't need to memorize every doc — you need to know WHERE to look when you need a detail.

### Phase 2: Plan

12. Create an implementation plan artifact with:
    - Files to create (with full paths)
    - Files to modify (with what changes)
    - Dependency order (which file must exist before which)
13. Break it into small ordered sub-tasks (each should be independently verifiable)
14. Estimate: is this > 15 files? If yes, split into logical groups and implement group-by-group.
15. If any ambiguity could cause a wrong implementation, ask the user. For minor decisions, follow ADRs.

### Phase 3: Implement

16. Implement sub-tasks in dependency order: **types → service → controller → tests**
17. After every major sub-task (e.g., finishing a service), do a quick sanity check:
    - Does it compile? (`npx tsc --noEmit` in backend)
    - Does it match the API spec in the reference docs?
18. Follow `.agents/rules.md` AT ALL TIMES. Key reminders:
    - Money = `Int` (NEVER Decimal)
    - Every tenant-scoped query MUST have `tenantId`
    - Every endpoint MUST have auth guards (unless `@Public()`)
    - DTOs with `class-validator` for all inputs
    - Emit events for cross-module effects
    - API response format: `{ success, data, message }`
19. Write production-quality code:
    - Proper error handling (try/catch, meaningful error messages)
    - Edge cases handled (empty arrays, null values, not-found)
    - No TODO/FIXME/HACK comments — implement it properly now
    - Inline comments only for non-obvious business logic

### Phase 4: Verify

20. Run EVERY acceptance criterion from the package file — no skipping
21. For API packages: test each endpoint with actual HTTP requests
22. Run `npm run lint` — fix ALL errors
23. Verify output contracts: check that every listed contract exists and is importable
24. Check for common bugs:
    - Any query missing `tenantId` filter?
    - Any money field using Decimal instead of Int?
    - Any endpoint missing auth guards?
    - Any N+1 queries (await inside loops)?

### Phase 5: Commit & Handoff

25. Stage: `git add -A`
26. Commit with conventional format:
    ```
    feat(scope): short description
    
    - Key feature 1
    - Key feature 2
    
    Package: P{XX}
    Unlocks: P{YY}, P{ZZ}
    ```
27. Update `docs/development/_overview.md` — change this package's status from ⬜ to ✅
28. Write a brief handoff note as the final commit message body: what the next agent needs to know (any gotchas, deviations from spec, or important implementation decisions)
