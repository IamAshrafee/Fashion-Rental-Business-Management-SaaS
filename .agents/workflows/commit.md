---
description: Quick-commit changes with conventional commit format
---

# /commit — Commit with Conventional Commits

// turbo-all

## Steps

1. Run `git status` to see what changed
2. Run `git diff --stat` to summarize changes
3. Determine the commit type:
   - `feat` — new feature or functionality
   - `fix` — bug fix
   - `refactor` — code restructuring without behavior change
   - `docs` — documentation only
   - `style` — formatting, no code change
   - `test` — adding or updating tests
   - `chore` — tooling, deps, config changes
4. Determine the scope (module name): `auth`, `product`, `booking`, `frontend`, `infra`, etc.
5. Stage changes: `git add -A`
6. Commit with format:
   ```
   {type}({scope}): {short description}
   
   {optional body with bullet points}
   ```
   Example:
   ```
   feat(product): implement full product CRUD with variants and image upload
   
   - Category/subcategory/event management
   - Multi-variant with color system
   - Image pipeline: validate → WebP → 3 sizes → MinIO
   - Full-text search with tsvector + pg_trgm fuzzy fallback
   - Soft delete with trash and restore
   
   Package: P04
   ```
