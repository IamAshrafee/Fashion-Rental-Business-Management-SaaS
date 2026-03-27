# Integration: Cloudflare

## Overview

Cloudflare provides DNS management, SSL certificates, and CDN caching for custom domains and the platform.

---

## Use Cases

| Feature | Cloudflare Service |
|---|---|
| Custom domain SSL | Universal SSL (auto) |
| DNS for custom domains | Cloudflare DNS API |
| CDN for static assets | Cloudflare CDN |
| DDoS protection | Always-on |
| DNS for `*.closetrent.com.bd` | Wildcard DNS |

---

## Custom Domain Setup Flow

```
[Owner enters custom domain: rentbyhana.com]
       │
       ▼
[System generates DNS instructions]
       │
       ├── "Add a CNAME record:"
       │     rentbyhana.com → custom.closetrent.com.bd
       │
       ├── Owner adds CNAME in their domain registrar
       │
       ▼
[System verifies DNS]
       │
       ├── Poll DNS for CNAME resolution
       ├── Cloudflare API: Add domain to zone
       ├── SSL certificate auto-provisioned
       │
       ▼
[Custom domain active ✅]
       │
       ├── Nginx routes: rentbyhana.com → tenant resolution
       └── SSL: Cloudflare edge certificate
```

---

## Cloudflare API Usage

### Add Domain to Zone

```
POST https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records
{
  "type": "CNAME",
  "name": "custom.closetrent.com.bd",
  "content": "server.closetrent.com.bd",
  "proxied": true
}
```

### Verify DNS Resolution

```typescript
async function verifyDNS(domain: string): Promise<boolean> {
  const resolver = new dns.Resolver();
  try {
    const records = await resolver.resolveCname(domain);
    return records.some(r => r.includes('closetrent.com.bd'));
  } catch {
    return false;
  }
}
```

---

## CDN Configuration

| Setting | Value |
|---|---|
| Cache static assets | CSS, JS, images (max 30 days) |
| Cache API responses | No (bypass) |
| MinIO assets | Proxied through Cloudflare for CDN |
| Purge on deploy | Automatic via CI/CD |

---

## Wildcard DNS

```
*.closetrent.com.bd → VPS IP (A record)
closetrent.com.bd   → VPS IP (A record)
```

Nginx handles subdomain routing to the correct tenant.
