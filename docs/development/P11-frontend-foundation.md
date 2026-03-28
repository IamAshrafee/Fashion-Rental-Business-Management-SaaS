# P11 — Frontend Scaffolding & Design System

| | |
|---|---|
| **Phase** | 4 — Frontend Foundation |
| **Estimated Time** | 4–5 hours |
| **Requires** | P01 (project scaffolding — Next.js app exists) |
| **Unlocks** | P12, P17, P19 |
| **Agent Skills** | `nextjs-best-practices`, `nextjs-app-router-patterns`, `vercel-react-best-practices` · Optional: `typescript-expert` |

---

## REFERENCE DOCS

- `docs/frontend-architecture.md` — Component patterns, state management, API client
- `docs/ui/_overview.md` — UI framework decisions
- `docs/architecture-decisions.md` — ADR-01 (ShadCN for portals, custom Tailwind for storefront)
- `docs/coding-standards.md` — Frontend code standards
- `docs/localization-strategy.md` — Locale formatting utilities

---

## SCOPE

### 1. Next.js App Structure

```
apps/frontend/src/
├── app/
│   ├── (guest)/                    # Guest portal routes (tenant storefront)
│   │   ├── layout.tsx              # Guest layout (tenant-branded)
│   │   └── page.tsx                # Storefront home
│   ├── (owner)/                    # Owner portal routes
│   │   ├── layout.tsx              # Owner layout (sidebar + header)
│   │   └── dashboard/
│   │       └── page.tsx            # Owner dashboard
│   ├── (admin)/                    # Admin portal routes
│   │   ├── layout.tsx              # Admin layout
│   │   └── page.tsx                # Admin dashboard
│   ├── (auth)/                     # Auth routes (login, register)
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── layout.tsx                  # Root layout
│   └── not-found.tsx
├── components/
│   ├── ui/                         # ShadCN/ui components (portals)
│   ├── guest/                      # Guest-specific components
│   ├── owner/                      # Owner-specific components
│   ├── admin/                      # Admin-specific components
│   └── shared/                     # Cross-portal components
├── hooks/
│   ├── use-auth.ts                 # Auth context hook
│   ├── use-tenant.ts               # Tenant context hook
│   ├── use-locale.ts               # Locale formatting hook
│   └── use-api.ts                  # API query hooks (TanStack Query)
├── lib/
│   ├── api-client.ts               # Axios instance with interceptors
│   ├── auth.ts                     # Token management (store, refresh, clear)
│   ├── tenant.ts                   # Tenant resolution from hostname
│   ├── locale.ts                   # Currency, date, number formatting
│   └── utils.ts                    # cn(), formatPrice(), etc.
├── providers/
│   ├── query-provider.tsx          # TanStack Query provider
│   ├── auth-provider.tsx           # Auth context provider
│   └── tenant-provider.tsx         # Tenant context provider
├── styles/
│   ├── globals.css                 # Global styles + Tailwind base
│   └── themes/                     # Tenant theme variables
└── types/
    └── index.ts                    # Frontend-specific types
```

### 2. ShadCN/ui Setup (for Owner + Admin portals)

```bash
npx shadcn-ui@latest init
# Install core components:
npx shadcn-ui@latest add button input label card table dialog dropdown-menu
npx shadcn-ui@latest add select textarea tabs badge avatar separator
npx shadcn-ui@latest add toast sonner form sheet command popover calendar
```

### 3. API Client (Axios + TanStack Query)

```typescript
// lib/api-client.ts
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT from localStorage
// Response interceptor: auto-refresh on 401, handle errors
// Tenant header: attach X-Tenant-ID if known
```

```typescript
// hooks/use-api.ts — TanStack Query wrappers
export const useProducts = (params) => useQuery({ queryKey: ['products', params], queryFn: ... });
export const useBookings = (params) => useQuery({ queryKey: ['bookings', params], queryFn: ... });
// ... etc
```

### 4. Auth System (Frontend)

- Token storage in memory (access) + localStorage (refresh)
- Auto-refresh: interceptor detects 401, refreshes token, retries request
- Auth provider: `useAuth()` → `{ user, tenant, login, logout, isAuthenticated }`
- Protected routes: middleware or layout-level auth check
- Login/register pages (basic, functional — styled in later packages)

### 5. Tenant Resolution (Frontend)

```typescript
// lib/tenant.ts
// On app load: read hostname → extract subdomain or custom domain
// Fetch tenant public info from API → cache in context
// Apply tenant branding (CSS variables for colors)
```

### 6. Locale Utilities

```typescript
// lib/locale.ts
export const formatPrice = (amount: number, tenant: TenantLocale): string => {
  // Integer → display string (7500 → "৳7,500" or "7,500৳")
  // Handles currency symbol position, number format (south_asian vs international)
};

export const formatDate = (date: Date, tenant: TenantLocale): string => {
  // Formats per tenant's date_format and timezone
};
```

### 7. Shared UI Components

Build these shared components used across all portals:
- `LoadingSpinner` — consistent loading indicator
- `EmptyState` — empty list state with icon + message
- `ErrorBoundary` — error boundary with retry
- `ConfirmDialog` — reusable confirmation modal
- `DataTable` — generic table with sorting, pagination (ShadCN Table)
- `PageHeader` — page title + breadcrumbs + actions
- `StatusBadge` — colored status indicators
- `PriceDisplay` — formatted price with currency
- `DateDisplay` — formatted date with tenant locale
- `ImageUploader` — drag-and-drop image upload component
- `Pagination` — page controls

### 8. Layout Components

**Owner Layout:**
- Sidebar navigation (collapsible)
- Top header (store name, notifications, profile dropdown)
- Breadcrumbs
- Mobile-responsive (sidebar becomes bottom nav on mobile)

**Guest Layout:**
- Tenant-branded header (logo, nav, search)
- Footer (contact info, social links)
- Mobile-responsive
- CSS variables for tenant colors

**Admin Layout:**
- Fixed sidebar
- Top header
- Similar to owner but different navigation items

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | App route structure | All route groups exist with layouts |
| 2 | ShadCN/ui installed and configured | Components import correctly |
| 3 | API client with interceptors | Requests go to backend with token |
| 4 | TanStack Query setup | Provider wraps app, queries work |
| 5 | Auth provider + login/register pages | Login flow works end-to-end |
| 6 | Tenant resolution | Storefront loads tenant branding |
| 7 | Locale utilities | `formatPrice`, `formatDate` work correctly |
| 8 | Shared UI components (11+) | All listed components exist |
| 9 | Owner layout with sidebar | Navigation, responsive |
| 10 | Guest layout with tenant branding | Colors, logo applied |
| 11 | Admin layout | Navigation, responsive |

---

## OUTPUT CONTRACTS

| Contract | Used By |
|---|---|
| Owner layout component | P12–P16 (all Owner portal pages) |
| Guest layout component | P17–P18 (all Guest portal pages) |
| Admin layout component | P19 (Admin portal) |
| API client + hooks | All frontend packages |
| Auth provider + `useAuth()` | All frontend packages |
| Tenant provider + `useLocale()` | All frontend packages |
| Shared components (DataTable, etc.) | P12–P19 |
| `formatPrice()`, `formatDate()` | P13–P18 |
