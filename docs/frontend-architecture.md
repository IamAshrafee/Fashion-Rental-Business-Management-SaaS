# Frontend Architecture

## Overview

Single Next.js 14+ application (App Router) serving all three portals. Uses Tailwind CSS + ShadCN/ui for owner/admin portals, custom Tailwind components for guest storefront.

---

## State Management

| State Type | Solution | Usage |
|---|---|---|
| **Tenant context** | React Context | Branding, config, locale — loaded once, rarely changes |
| **Auth state** | React Context | User, role, JWT — managed via refresh token flow |
| **Server data** | TanStack Query | Products, bookings, customers — caching, refetching, loading states |
| **Form state** | React Hook Form | Multi-step wizard, settings forms, checkout |
| **Cart state** | Custom hook + localStorage | Cart items, quantities, dates |
| **URL state** | `searchParams` (Next.js) | Filters, sort, pagination, search query |

---

## Authentication Flow in Frontend

JWT is stored in **memory only** (NOT localStorage). Refresh token is in httpOnly cookie.

```
[Page Load (Owner/Staff Portal)]
       │
       ├── No access token in memory
       │
       ▼
[Call POST /auth/refresh]
       │
       ├── httpOnly cookie sent automatically
       ├── Server validates refresh token
       │
       ├── Valid → return new access token
       │   └── Store in memory (React Context)
       │   └── Set up axios/fetch interceptor with token
       │
       └── Invalid → redirect to /login
```

### Token Refresh Interceptor

```typescript
// API client interceptor
apiClient.interceptors.response.use(
  response => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const newToken = await refreshAccessToken();
      error.config.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(error.config);
    }
    throw error;
  }
);
```

---

## Tenant Context Loading

```typescript
// Loaded on every page via layout.tsx
const TenantProvider = ({ children }) => {
  const hostname = headers().get('host');
  const tenant = await fetchTenantByHost(hostname);
  // tenant includes: branding, locale, settings

  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  );
};
```

Tenant data is fetched **server-side** (SSR) for the guest portal and cached with TanStack Query for the owner portal.

---

## Error Handling UX

### Error Display Strategy

| Error Type | Display Method |
|---|---|
| Form validation (client) | Inline field errors (red text below input) |
| Server validation (400) | Inline field errors mapped from `details[]` |
| Conflict (409) | Toast notification (e.g., "Dates no longer available") |
| Auth errors (401/403) | Redirect to login / "Access denied" page |
| Server errors (500) | Toast: "Something went wrong. Please try again." |
| Network errors | Toast: "No internet connection. Check your network." |

### Implementation

```typescript
// Global error handler for TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      onError: (error) => {
        if (error.status === 409) {
          toast.error(error.message);
        } else if (error.status >= 500) {
          toast.error('Something went wrong. Please try again.');
        }
      },
    },
  },
});
```

---

## Loading & Empty States

| State | Pattern |
|---|---|
| Page loading | Skeleton placeholders matching layout |
| Data loading | Skeleton cards/rows (not spinner) |
| Button loading | Spinner inside button, button disabled |
| Empty list | Illustration + "No products yet" + CTA button |
| Search no results | "No products match your search" + clear filter link |

---

## Component Architecture

### Guest Storefront (Custom Tailwind)

```
components/guest/
├── layout/
│   ├── GuestHeader.tsx
│   ├── GuestFooter.tsx
│   └── MobileNav.tsx
├── product/
│   ├── ProductCard.tsx
│   ├── ProductGallery.tsx
│   ├── BookingCalendar.tsx
│   ├── PriceBreakdown.tsx
│   └── VariantSelector.tsx
├── cart/
│   ├── CartItem.tsx
│   └── CartSummary.tsx
├── checkout/
│   ├── CheckoutForm.tsx
│   └── PaymentSelector.tsx
└── shared/
    ├── FilterDrawer.tsx
    ├── SearchBar.tsx
    └── SortDropdown.tsx
```

### Owner Portal (ShadCN/ui)

```
components/owner/
├── layout/
│   ├── Sidebar.tsx        # ShadCN Sheet/Navigation
│   └── TopBar.tsx
├── products/
│   ├── ProductWizard.tsx  # Multi-step form
│   ├── ImageUploader.tsx
│   └── VariantEditor.tsx
├── bookings/
│   ├── BookingTable.tsx   # ShadCN DataTable
│   ├── BookingCard.tsx
│   └── StatusBadge.tsx
├── shared/
│   ├── StatCard.tsx
│   ├── DateRangePicker.tsx
│   └── ConfirmDialog.tsx  # ShadCN AlertDialog
```
