# API Design: Auth Module

## Endpoints

---

### POST `/api/v1/auth/register`

Register a new business owner + create tenant.

**Auth**: None

**Request Body**:
```json
{
  "fullName": "Hana Rahman",
  "email": "hana@example.com",
  "phone": "01712345678",
  "password": "securePassword123",
  "businessName": "Hana's Boutique",
  "subdomain": "hanasboutique"
}
```

**Validation**:
| Field | Rules |
|---|---|
| `fullName` | Required, 2-200 chars |
| `email` | Optional, valid email, unique |
| `phone` | Required, valid BD phone (01X-XXXX-XXXX) |
| `password` | Required, min 8 chars, 1 uppercase, 1 number |
| `businessName` | Required, 2-200 chars |
| `subdomain` | Required, 3-30 chars, lowercase + numbers + hyphens, unique |

**Response** `201`:
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "fullName": "Hana Rahman", "email": "...", "phone": "..." },
    "tenant": { "id": "...", "businessName": "Hana's Boutique", "subdomain": "hanasboutique" },
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG..."
  }
}
```

**Errors**:
- `409 CONFLICT` — Email or subdomain already taken
- `400 VALIDATION_ERROR` — Invalid phone format, password too weak

---

### POST `/api/v1/auth/login`

**Auth**: None

**Request Body**:
```json
{
  "identifier": "hana@example.com",
  "password": "securePassword123",
  "tenantSlug": "hanasboutique"
}
```

`identifier` can be an email or the account's unique phone number. `tenantSlug` optionally selects a specific active store membership.

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "fullName": "...", "role": "owner", "tenantId": "...", "permissions": [] },
    "tenants": [
      { "id": "...", "businessName": "Hana's Boutique", "subdomain": "hanasboutique", "role": "owner" }
    ],
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "tenantId": "...",
    "expiresIn": 900
  }
}
```

The returned `tenantId` and `currentTenant` are the authoritative selected context. A supplied `tenantSlug` is rejected unless the user has active access to that store.

**Errors**:
- `401 UNAUTHORIZED` — Invalid credentials
- `403 FORBIDDEN` — Account deactivated

---

### POST `/api/v1/auth/refresh`

**Auth**: None (uses refresh token in body)

**Request Body**:
```json
{
  "refreshToken": "eyJhbG..."
}
```

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "tenantId": "...",
    "role": "owner",
    "expiresIn": 900
  }
}
```

**Errors**:
- `401 UNAUTHORIZED` — Invalid or expired refresh token

---

### POST `/api/v1/auth/logout`

**Auth**: Bearer token

**Response** `200`:
```json
{
  "success": true,
  "data": { "message": "Logged out successfully" }
}
```

Invalidates the refresh token.

---

### POST `/api/v1/auth/forgot-password`

**Auth**: None

**Request Body**:
```json
{
  "identifier": "01712345678"
}
```

Creates a random, one-hour, single-use reset token and stores only its digest. The current delivery integration sends a reset link by SMS. The response does not reveal whether the account exists.

**Response** `200`:
```json
{
  "success": true,
    "data": { "message": "If an account exists, a reset link has been sent", "expiresIn": 3600 }
}
```

---

### POST `/api/v1/auth/reset-password`

**Auth**: None

**Request Body**:
```json
{
  "identifier": "01712345678",
  "token": "opaque-one-time-token",
  "newPassword": "newSecurePassword123"
}
```

A successful reset consumes the token atomically and revokes every active session for the account.

**Response** `200`:
```json
{
  "success": true,
  "data": { "message": "Password reset successful" }
}
```

---

### GET `/api/v1/auth/me`

**Auth**: Bearer token

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "fullName": "Hana Rahman",
    "email": "hana@example.com",
    "phone": "01712345678",
    "role": "owner",
    "tenantId": "...",
    "permissions": [],
    "currentTenant": {
      "id": "...",
      "businessName": "Hana's Boutique",
      "subdomain": "hanasboutique",
      "role": "owner",
      "permissions": []
    }
  }
}
```

---

### POST `/api/v1/auth/check-subdomain`

Check if a subdomain is available (used during registration).

**Auth**: None

**Request Body**:
```json
{
  "subdomain": "hanasboutique"
}
```

**Response** `200`:
```json
{
  "success": true,
  "data": { "available": true }
}
```
