# Feature Spec: Custom Domain

## Overview

Tenants can connect their own domain (e.g., `rentbysara.com`) to their store instead of using the default subdomain. This gives businesses a professional, branded presence.

---

## Setup Flow

### Owner Portal → Store Settings → Custom Domain

#### Step 1: Enter Domain
```
Custom Domain: [rentbysara.com]
```

Owner enters their domain name (without https:// or www).

#### Step 2: DNS Configuration Instructions

System shows clear instructions:

```
To connect your domain, add one of these DNS records:

Option A — A Record (recommended):
  Type: A
  Host: @
  Value: 103.xxx.xxx.xxx (our server IP)

Option B — CNAME Record:
  Type: CNAME
  Host: @
  Value: closetrent.com.bd

⚠️ DNS changes can take up to 48 hours to propagate.

[Verify Domain →]
```

#### Step 3: Verification

Owner clicks "Verify Domain":
1. Backend checks DNS resolution for the entered domain
2. Verifies it points to our server IP (A record) or our domain (CNAME)
3. If verified → domain is active
4. If not verified → show "DNS not yet propagated. Try again later."

#### Step 4: SSL Provisioning

After domain is verified:
1. System auto-provisions SSL via Let's Encrypt
2. Nginx config updated to handle the new domain
3. Domain is live with HTTPS

---

## Technical Implementation

### Nginx Configuration

For each custom domain, Nginx needs a server block:

```nginx
server {
    listen 443 ssl;
    server_name rentbysara.com www.rentbysara.com;
    
    ssl_certificate /etc/letsencrypt/live/rentbysara.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rentbysara.com/privkey.pem;
    
    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
    }
    
    location /api/ {
        proxy_pass http://backend:4000;
        proxy_set_header Host $host;
    }
}
```

### Automated Nginx Config

When a custom domain is verified:
1. Backend generates Nginx config from template
2. Writes config to Nginx conf.d directory
3. Runs `certbot` for SSL certificate
4. Reloads Nginx

This can be automated via a shell script triggered by the backend.

### Tenant Resolution for Custom Domains

```
Request: GET https://rentbysara.com/products
Host: rentbysara.com
  → Query: SELECT * FROM tenants WHERE custom_domain = 'rentbysara.com'
  → Found: tenant_id = "xyz-789"
  → Proceed normally
```

---

## Domain Management (Owner Portal)

### After Domain Is Connected

```
🌐 Custom Domain

Domain: rentbysara.com
Status: ✅ Active
SSL: ✅ Valid (expires Dec 2026, auto-renews)

Your store is accessible at:
• https://rentbysara.com
• https://hanasboutique.closetrent.com.bd (subdomain still works)

[Remove Custom Domain]
```

### Removing Custom Domain

1. Owner clicks "Remove Custom Domain"
2. Confirm dialog
3. Domain removed from tenant record
4. Nginx config cleaned up
5. SSL certificate revoked
6. Store only accessible via subdomain again

---

## WWW Handling

Both `rentbysara.com` and `www.rentbysara.com` should work:
- Redirect `www.rentbysara.com` → `rentbysara.com` (or vice versa based on owner preference)
- SSL covers both

---

## Limitations (v1)

| Limitation | Detail |
|---|---|
| One custom domain per tenant | No multi-domain support |
| Manual SSL provisioning | Automated via Let's Encrypt but may need monitoring |
| No domain transfer | Transferring a domain between tenants requires admin support |
| Subdomains of custom domain | `shop.rentbysara.com` not supported — only root domain |

---

## Business Rules Summary

1. Custom domain is optional — subdomain always works
2. Owner provides the domain, our system provides the DNS instructions
3. Domain verified by DNS check
4. SSL auto-provisioned via Let's Encrypt
5. Both root domain and www redirect
6. One custom domain per tenant
7. Removing custom domain falls back to subdomain
8. Subdomain continues to work even with custom domain active
