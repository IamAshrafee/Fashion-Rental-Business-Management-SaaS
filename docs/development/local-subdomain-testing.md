# Local Multi-Tenant Subdomain Testing Guide

This guide explains how to test the full multi-tenant subdomain system locally on your development machine.

---

## Quick Start

**No configuration needed!** Modern browsers (Chrome, Edge, Firefox) automatically resolve `*.localhost` to `127.0.0.1`.

### 1. Start the development servers

```bash
# Option A: Using the launcher
.\start-dev.bat  # Select option 1

# Option B: Manually
docker compose up -d
npm run dev:backend    # Port 4000
npm run dev:frontend   # Port 3000
```

### 2. Create a test tenant

Make sure your database has at least one tenant with a subdomain. You can use the existing seed data or create one via the API:

```bash
# Register a new tenant via the API
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test Owner",
    "email": "owner@test.com",
    "password": "Password123!",
    "businessName": "Rentiva Fashion",
    "subdomain": "rentiva"
  }'
```

### 3. Test the subdomain routing

| URL | What You'll See |
|---|---|
| `http://localhost:3000` | SaaS landing page (marketing) |
| `http://rentiva.localhost:3000` | Tenant storefront for "rentiva" |
| `http://rentiva.localhost:3000/products` | Product catalog for "rentiva" |
| `http://rentiva.localhost:3000/dashboard` | Owner portal for "rentiva" (requires login) |
| `http://admin.localhost:3000` | SaaS admin portal (requires admin login) |
| `http://nonexistent.localhost:3000` | "Store not found" (no tenant with that subdomain) |

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser: http://rentiva.localhost:3000                         │
│                                                                 │
│  1. Browser resolves rentiva.localhost → 127.0.0.1 (automatic) │
│  2. Next.js middleware detects subdomain "rentiva"              │
│  3. Sets x-tenant-subdomain header for downstream              │
│  4. TenantProvider calls rentiva.localhost:4000/api/v1/tenant/  │
│     public endpoint                                             │
│  5. Backend TenantMiddleware reads Host: rentiva.localhost      │
│     → extracts subdomain "rentiva"                             │
│     → queries DB: WHERE subdomain = 'rentiva'                  │
│     → attaches tenant context to request                       │
│  6. Frontend receives tenant info, applies branding            │
│  7. All subsequent API calls go through rentiva.localhost:4000  │
│     → complete tenant isolation                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Custom Domain Testing (Hosts File)

For testing custom domains locally (e.g., `rentbysara.com` → your tenant store), you need to add entries to your Windows hosts file.

### Step 1: Edit the hosts file

Open Notepad **as Administrator** and open:
```
C:\Windows\System32\drivers\etc\hosts
```

Add entries for your test custom domains:
```
# ClosetRent — Custom Domain Testing
127.0.0.1    rentbysara.local
127.0.0.1    fashionhub.local
```

> **Note:** We use `.local` instead of `.com` to avoid conflicts with real domains.

### Step 2: Set the custom domain in the database

Update the tenant's `customDomain` field in the database:

```sql
UPDATE tenants
SET custom_domain = 'rentbysara.local'
WHERE subdomain = 'rentiva';
```

Or via the owner portal (Settings → Custom Domain):
- Enter `rentbysara.local` as the custom domain

### Step 3: Test it

| URL | What You'll See |
|---|---|
| `http://rentbysara.local:3000` | Tenant storefront (same store as rentiva.localhost:3000) |
| `http://rentbysara.local:3000/dashboard` | Owner portal for the same tenant |

### How custom domain resolution works

```
Browser: http://rentbysara.local:3000
  → hosts file resolves to 127.0.0.1
  → Next.js middleware detects *.local → custom domain
  → TenantProvider calls rentbysara.local:4000/api/v1/tenant/public
  → Backend TenantMiddleware: Host "rentbysara.local"
    → isCustomDomainHost() → true
    → resolveByCustomDomain("rentbysara.local")
    → DB: WHERE custom_domain = 'rentbysara.local'
  → Full tenant context loaded
```

---

## Multiple Tenants — Testing Isolation

Create multiple tenants to verify complete data isolation:

```bash
# Tenant 1 — Rentiva
# Visit: rentiva.localhost:3000

# Tenant 2 — Fashion House
# Visit: fashionhouse.localhost:3000

# Tenant 3 — Custom domain
# Visit: rentbysara.local:3000  (after hosts file setup)
```

Each tenant should show:
- ✅ Different business name and branding
- ✅ Different product catalog
- ✅ Different booking history
- ✅ Separate customer database
- ✅ Independent settings (currency, timezone, shipping)

---

## Troubleshooting

### "Store not found" error
The subdomain doesn't match any tenant in the database. Check:
```sql
SELECT subdomain, custom_domain, status FROM tenants;
```

### CORS errors in browser console
The backend should allow `*.localhost` origins automatically. If you see CORS errors:
1. Check that the backend is running on port 4000
2. Check the browser console for the exact origin being blocked
3. Verify the CORS configuration in `apps/backend/src/main.ts`

### API calls going to wrong URL
Check the browser's Network tab. API requests should go to:
- `http://rentiva.localhost:4000/api/v1/...` (not `localhost:4000`)

### Safari doesn't resolve *.localhost
Safari does NOT auto-resolve `*.localhost`. Add to hosts file:
```
127.0.0.1    rentiva.localhost
127.0.0.1    fashionhouse.localhost
```

### Custom domain not resolving
1. Verify the hosts file entry: `127.0.0.1    yourdomain.local`
2. Flush DNS cache: `ipconfig /flushdns`
3. Verify the tenant's `custom_domain` column matches exactly

---

## Environment Variables

These variables control subdomain/domain behavior:

| Variable | Default | Description |
|---|---|---|
| `BASE_DOMAIN` | `localhost:3000` | Platform base domain (used for subdomain extraction) |
| `ADMIN_SUBDOMAIN` | `admin` | Reserved subdomain for admin portal |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed origins (*.localhost auto-allowed in dev) |
| `NEXT_PUBLIC_BASE_DOMAIN` | `closetrent.com` | Frontend-side platform domain for subdomain detection |

---

## Production vs Development Comparison

| Concern | Development | Production |
|---|---|---|
| Subdomain routing | `rentiva.localhost:3000` | `rentiva.closetrent.com` |
| Custom domain | `rentbysara.local:3000` (hosts file) | `rentbysara.com` (real DNS) |
| SSL | HTTP only | HTTPS via Cloudflare/Let's Encrypt |
| Proxy | Direct (separate ports 3000/4000) | Nginx (unified port 443) |
| DNS | Automatic (*.localhost) or hosts file | Wildcard DNS + Cloudflare |
| API routing | `rentiva.localhost:4000/api/v1` | `rentiva.closetrent.com/api/v1` (via Nginx) |
