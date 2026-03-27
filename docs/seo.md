# SEO & Social Sharing

## Overview

Full SEO implementation for tenant storefronts. When a product is shared on Facebook or WhatsApp, it must show a rich preview with image, title, and price.

---

## Per-Page SEO

### Storefront Home

```html
<title>{storeName} — Fashion Rental</title>
<meta name="description" content="{storeDescription}" />
<meta property="og:title" content="{storeName}" />
<meta property="og:description" content="{storeDescription}" />
<meta property="og:image" content="{storeLogo or storeBanner}" />
<meta property="og:url" content="https://{subdomain}.closetrent.com" />
<meta property="og:type" content="website" />
```

### Shopping Page (Product Listing)

```html
<title>Shop — {storeName}</title>
<meta name="description" content="Browse {productCount}+ rental items at {storeName}" />
<link rel="canonical" href="https://{domain}/shop" />
```

### Product Detail Page

```html
<title>{productName} — Rent for {price} | {storeName}</title>
<meta name="description" content="{first 160 chars of product description}" />

<!-- OpenGraph -->
<meta property="og:title" content="{productName} — {storeName}" />
<meta property="og:description" content="Rent for {currencySymbol}{price}/{duration}" />
<meta property="og:image" content="{featuredImage URL}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="https://{domain}/product/{slug}" />
<meta property="og:type" content="product" />
<meta property="product:price:amount" content="{price}" />
<meta property="product:price:currency" content="{currencyCode}" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{productName}" />
<meta name="twitter:image" content="{featuredImage URL}" />
```

---

## Schema.org Structured Data

### Product Page

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Royal Banarasi Saree",
  "image": ["https://cdn.closetrent.com/tenant-xxx/product-1.webp"],
  "description": "Handcrafted Banarasi saree...",
  "brand": { "@type": "Brand", "name": "Hana's Boutique" },
  "offers": {
    "@type": "Offer",
    "price": "7500",
    "priceCurrency": "BDT",
    "availability": "https://schema.org/InStock",
    "priceValidUntil": "2027-12-31",
    "itemCondition": "https://schema.org/UsedCondition"
  }
}
```

### Storefront (Organization)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Hana's Boutique",
  "url": "https://hanasboutique.closetrent.com",
  "logo": "https://cdn.closetrent.com/tenant-xxx/logo.webp",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+8801712345678",
    "contactType": "customer service"
  }
}
```

---

## Sitemap Generation

Dynamic sitemap per tenant, generated on request:

```
GET /sitemap.xml → auto-generated

<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://hanasboutique.closetrent.com/</loc>
    <lastmod>2026-04-15</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://hanasboutique.closetrent.com/product/royal-banarasi-saree</loc>
    <lastmod>2026-04-14</lastmod>
    <priority>0.8</priority>
  </url>
  <!-- All published products -->
</urlset>
```

### robots.txt

```
GET /robots.txt

User-agent: *
Allow: /
Disallow: /owner/
Disallow: /admin/
Sitemap: https://{domain}/sitemap.xml
```

---

## Canonical URLs

For tenants with custom domains:

```html
<!-- On subdomain -->
<link rel="canonical" href="https://rentbyhana.com/product/royal-saree" />

<!-- On custom domain -->
<link rel="canonical" href="https://rentbyhana.com/product/royal-saree" />
```

Custom domain is always the canonical URL if configured. Otherwise, subdomain is canonical.

---

## Social Sharing Best Practices

- Featured image should be at least **1200×630px** for rich previews
- Image processing pipeline always generates an og-sized variant
- WhatsApp shares use og:image — ensure it's a direct URL (not behind auth)
- Facebook debugger: `https://developers.facebook.com/tools/debug/` — tenants can use to validate
