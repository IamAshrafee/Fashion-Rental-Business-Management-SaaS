---
description: Verify a completed work package against its acceptance criteria
---

# /verify — Verify a Work Package

// turbo-all

## Steps

1. Identify which package to verify. User will specify (e.g., `/verify P03`).
2. Read the package file: `docs/development/P{XX}-{name}.md`
3. Go to the **ACCEPTANCE CRITERIA** section
4. Execute every listed check command or verification step:
   - Run any shell commands listed
   - Test API endpoints (use curl or a test script)
   - Check database state (Prisma Studio or raw query)
   - Verify file structure exists as expected
5. Go to the **OUTPUT CONTRACTS** section
6. Verify each contract is met:
   - Check that the exported service/module/API exists
   - Check that it's importable by downstream packages
   - Verify the interface matches what downstream consumers expect
7. Run lint: `npm run lint`
8. Run tests if they exist: `npm test`
9. Report results:
   - ✅ All acceptance criteria pass → mark package as complete
   - ❌ Any failure → list specific failures and what needs fixing
10. If all pass, update `docs/development/_overview.md` status from ⬜ to ✅
