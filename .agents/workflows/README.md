# Agentic Workflows — ClosetRent SaaS

## How This Project Works

This project is built by **AI agent teams** using **Antigravity IDE**. Each agent operates in its own conversation and is responsible for one **work package** (P01–P20). Workflows standardize how agents operate.

---

## Quick Start

```
/develop P01     → Build work package P01 from scratch
/verify P01      → Check if P01 meets its acceptance criteria
/commit          → Stage and commit with conventional format
/package-status  → See which packages are done, ready, or blocked
```

---

## Workflow Index

### 🔨 Development
| Command | When To Use | What It Does |
|---|---|---|
| `/develop P{XX}` | Starting work on a package | Full end-to-end: read docs → plan → implement → verify → commit |
| `/verify P{XX}` | After a package is built | Runs acceptance criteria + output contract checks |
| `/commit` | After any meaningful change | Stages + commits with conventional commit format |
| `/package-status` | Before starting new work | Shows progress: ✅ done, 🟡 ready, 🔴 blocked |

### 🔍 Quality & Safety
| Command | When To Use | What It Does |
|---|---|---|
| `/deep-audit {module}` | Before releasing a module | Reads real code, traces user flows, finds real bugs in a specific module |
| `/mock-hunt` | Before any release | Finds all mock data, dead buttons, placeholder content, TODO debt |
| `/api-sync` | After adding new endpoints | Verifies frontend API clients match backend controllers |
| `/search-potential-bugs-for-future` | Periodically | Scans for common bug patterns (missing tenantId, auth guards, etc.) |

---

## Efficiency Guidelines

### 1. Context Loading Order (saves ~30% time)

Don't read every doc randomly. Follow this priority:

```
1. .agents/rules.md          ← Non-negotiable rules (2 min)
2. Your package file          ← Your mission scope (3 min)
3. architecture-decisions.md  ← Skim relevant ADRs (2 min)
4. coding-standards.md        ← Naming/patterns (2 min)
5. Package-specific docs      ← Deep dive only what you need
6. Existing code scan         ← list_dir + key file headers
```

**What NOT to read:** Docs not listed in your package's REFERENCE DOCS section. Don't read P07's booking docs if you're building P04 (products).

### 2. Implementation Order (prevents rework)

Always implement in this dependency chain:

```
Shared types (packages/types/) 
  → DTOs (dto/*.dto.ts)
    → Service (*.service.ts) 
      → Controller (*.controller.ts) 
        → Module (*.module.ts)
```

For frontend:
```
API hooks (hooks/use-*.ts) 
  → Shared components 
    → Page-specific components 
      → Page (page.tsx)
```

### 3. Parallel Agent Coordination

When multiple agents work on parallel packages (e.g., P04 + P05 + P06):

- **No shared files:** Each agent works only in its own module directory
- **No schema changes:** P02 already created the full schema — later packages only READ it
- **Event interfaces:** Agreed upon in `packages/types/` — don't modify each other's types
- **If conflict suspected:** Ask the user before touching files outside your module

### 4. Avoid Common Time Wasters

| Time Waster | Instead |
|---|---|
| Reading all 130+ docs | Read ONLY your package's reference docs |
| Writing tests before implementation | Implement first, test after |
| Asking about every small decision | Follow ADRs — they cover 95% of cases |
| Implementing features not in scope | Stick to YOUR package's deliverables list |
| Over-engineering edge cases | Handle the main flow first, then edge cases |
| Re-implementing existing code | Check `apps/` for what previous packages built |

### 5. Quality Checkpoints

Before finishing, check these in order:

```
□ Every endpoint has @UseGuards()
□ Every query has tenantId filter
□ Every money field is Int
□ Every input has DTO with class-validator
□ Every list endpoint has pagination
□ Every mutation emits an event
□ npm run lint passes
□ Acceptance criteria from package file pass
□ Output contracts are met
```

---

## File Ownership Map

This prevents agents from stepping on each other:

| Package | Owns These Directories |
|---|---|
| P01 | Root config, `packages/types/`, Docker, Nginx |
| P02 | `apps/backend/prisma/` |
| P03 | `apps/backend/src/modules/auth/`, `common/guards/`, `common/middleware/`, `common/decorators/` |
| P04 | `apps/backend/src/modules/product/`, `modules/category/`, `modules/upload/` |
| P05 | `apps/backend/src/modules/customer/` |
| P06 | `apps/backend/src/modules/tenant/` (settings, staff, subscription) |
| P07 | `apps/backend/src/modules/booking/` |
| P08 | `apps/backend/src/modules/payment/` |
| P09 | `apps/backend/src/modules/courier/` |
| P10 | `apps/backend/src/modules/notification/`, `modules/jobs/`, `modules/audit/` |
| P11 | `apps/frontend/src/components/ui/`, `lib/`, `providers/`, `hooks/`, layouts |
| P12 | `apps/frontend/src/app/(owner)/dashboard/`, owner layout polish |
| P13 | `apps/frontend/src/app/(owner)/products/` |
| P14 | `apps/frontend/src/app/(owner)/bookings/` |
| P15 | `apps/frontend/src/app/(owner)/customers/`, `(owner)/analytics/` |
| P16 | `apps/frontend/src/app/(owner)/settings/` |
| P17 | `apps/frontend/src/app/(guest)/`, except checkout |
| P18 | `apps/frontend/src/app/(guest)/cart/`, `checkout/`, `booking/` |
| P19 | `apps/frontend/src/app/(admin)/`, `apps/backend/src/modules/admin/` |
| P20 | SEO config, test files, Docker prod, Nginx prod |

**Rule:** If you need to modify a file owned by another package (e.g., add a new route to `app.module.ts`), that's OK — but ONLY add to it, never restructure it.

---

## Rules Quick Reference

Full rules: `.agents/rules.md`

| Rule | Summary |
|---|---|
| 💰 Money = Int | `7500` not `75.00` — ADR-04 |
| 🏢 Tenant isolation | Every query needs `tenantId` |
| 📦 Booking = Order | No orders table — ADR-02 |
| 🛒 Cart = localStorage | No cart API — ADR-03 |
| 📡 Events for side effects | Never call across modules directly — ADR-05 |
| 🎨 Storefront = custom Tailwind | NOT ShadCN/ui — ADR-01 |
| 🔐 Guards on every endpoint | `JwtAuthGuard + TenantGuard + RolesGuard` |
| ✅ DTOs on every input | `class-validator` decorators |
| 🗑️ Soft delete | `deletedAt` not hard delete |
| ⏰ UTC storage | Display in tenant timezone |
