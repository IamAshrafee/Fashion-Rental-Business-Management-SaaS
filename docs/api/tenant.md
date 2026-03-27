# API Design: Tenant Module

## Endpoints

---

### GET `/api/v1/tenant/info`

Get public tenant info for storefront rendering (branding, contact, social links).

**Auth**: None (guest-facing)

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "businessName": "Hana's Boutique",
    "subdomain": "hanasboutique",
    "customDomain": "rentbyhana.com",
    "logoUrl": "https://...",
    "faviconUrl": "https://...",
    "primaryColor": "#E91E63",
    "secondaryColor": "#9C27B0",
    "tagline": "Premium Wedding Dress Rentals",
    "phone": "01712345678",
    "whatsapp": "01712345678",
    "email": "hana@boutique.com",
    "address": "Dhanmondi, Dhaka",
    "facebookUrl": "https://facebook.com/...",
    "instagramUrl": "https://instagram.com/...",
    "tiktokUrl": null,
    "youtubeUrl": null,
    "banners": [
      { "id": "...", "url": "https://...", "sequence": 0 }
    ]
  }
}
```

Cached in Redis (5 min TTL). Invalidated on settings update.

---

### PATCH `/api/v1/tenant/settings`

Update store settings (branding, contact, social links).

**Auth**: Bearer token — Owner only

**Request Body** (all fields optional):
```json
{
  "businessName": "Hana's Premium Boutique",
  "tagline": "Premium Wedding Dress Rentals in Dhaka",
  "primaryColor": "#E91E63",
  "secondaryColor": "#9C27B0",
  "phone": "01712345678",
  "whatsapp": "01712345678",
  "email": "hana@boutique.com",
  "address": "Dhanmondi, Dhaka",
  "facebookUrl": "https://facebook.com/...",
  "instagramUrl": "https://instagram.com/...",
  "defaultLanguage": "en"
}
```

**Response** `200`: Updated settings object

---

### PATCH `/api/v1/tenant/payment-settings`

Update payment configuration.

**Auth**: Bearer token — Owner only

**Request Body**:
```json
{
  "bkashNumber": "01712345678",
  "nagadNumber": "01812345678",
  "sslcommerzStoreId": "store_xxx",
  "sslcommerzStorePass": "pass_xxx",
  "sslcommerzSandbox": false
}
```

**Response** `200`: Updated payment settings

---

### PATCH `/api/v1/tenant/courier-settings`

Update courier configuration.

**Auth**: Bearer token — Owner only

**Request Body**:
```json
{
  "defaultCourier": "pathao",
  "courierApiKey": "api_xxx",
  "courierSecretKey": "secret_xxx",
  "pickupAddress": "Dhanmondi, Dhaka"
}
```

**Response** `200`: Updated courier settings

---

### POST `/api/v1/tenant/custom-domain`

Request custom domain setup.

**Auth**: Bearer token — Owner only

**Request Body**:
```json
{
  "domain": "rentbyhana.com"
}
```

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "domain": "rentbyhana.com",
    "status": "pending_verification",
    "dnsInstructions": {
      "aRecord": { "type": "A", "host": "@", "value": "103.xxx.xxx.xxx" },
      "cnameRecord": { "type": "CNAME", "host": "@", "value": "closetrent.com" }
    }
  }
}
```

---

### POST `/api/v1/tenant/custom-domain/verify`

Verify DNS configuration for custom domain.

**Auth**: Bearer token — Owner only

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "domain": "rentbyhana.com",
    "verified": true,
    "sslStatus": "provisioning"
  }
}
```

**Errors**:
- `422 UNPROCESSABLE` — DNS not yet propagated

---

### DELETE `/api/v1/tenant/custom-domain`

Remove custom domain.

**Auth**: Bearer token — Owner only

**Response** `200`:
```json
{
  "success": true,
  "data": { "message": "Custom domain removed" }
}
```

---

### PATCH `/api/v1/tenant/notification-settings`

Update SMS notification toggles.

**Auth**: Bearer token — Owner only

**Request Body**:
```json
{
  "smsEnabled": true,
  "smsBookingConfirmation": true,
  "smsShippingUpdate": true,
  "smsReturnReminder": true,
  "smsNewBookingAlert": true
}
```

**Response** `200`: Updated notification settings
