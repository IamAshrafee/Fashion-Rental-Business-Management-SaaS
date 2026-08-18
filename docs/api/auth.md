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
  "subdomain": "hanasboutique",
  "promoCode": "SUMMER50",
  "planSlug": "pro",
  "referralSource": "facebook"
}
```

**Validation**:
| Field | Rules |
|---|---|
| `fullName` | Required, 2-200 chars |
| `email` | Optional, valid email, unique |
| `phone` | Required, valid BD phone (01X-XXXX-XXXX), unique |
| `password` | Required, min 8 chars, 1 uppercase, 1 number |
| `businessName` | Required, 2-200 chars |
| `subdomain` | Required, 3-30 chars, lowercase + numbers + hyphens, unique |
| `promoCode` | Optional, max 50 chars |
| `planSlug` | Optional, max 50 chars |
| `referralSource` | Optional, max 200 chars |

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
- `409 CONFLICT` — Email, phone, or subdomain already taken
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
    "user": { 
      "id": "...", 
      "fullName": "...", 
      "email": "...", 
      "phone": "...",
      "role": "owner", 
      "tenantId": "...", 
      "permissions": [],
      "currentTenant": {
        "id": "...",
        "businessName": "Hana's Boutique",
        "subdomain": "hanasboutique",
        "customDomain": null,
        "status": "active",
        "logoUrl": null,
        "role": "owner",
        "permissions": []
      }
    },
    "tenants": [
      { "id": "...", "businessName": "Hana's Boutique", "subdomain": "hanasboutique", "role": "owner", "permissions": [] }
    ],
    "suspendedTenants": [
      { "id": "...", "businessName": "Suspended Store", "subdomain": "suspendedstore", "status": "suspended", "statusReason": "billing_failed" }
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
  "refreshToken": "eyJhbG..." // Optional if using HTTP-only cookie
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

### POST `/api/v1/auth/impersonation/logout`

**Auth**: Bearer token (Admin impersonation only)

**Response** `200`:
```json
{
  "success": true,
  "data": { "message": "Impersonation session ended" }
}
```

Revokes an access-only admin impersonation session without clearing the admin refresh cookie.

---

### POST `/api/v1/auth/forgot-password`

**Auth**: None

**Request Body**:
```json
{
  "identifier": "01712345678" // Email or phone
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
  "identifier": "01712345678", // Email or phone
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
    "lastLoginAt": "2023-10-25T10:00:00Z",
    "createdAt": "2023-10-01T10:00:00Z",
    "currentTenant": {
      "id": "...",
      "businessName": "Hana's Boutique",
      "subdomain": "hanasboutique",
      "customDomain": null,
      "status": "active",
      "logoUrl": null,
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

---

## Session Management Endpoints

---

### GET `/api/v1/sessions`

**Auth**: Bearer token

List all active sessions for the current user.

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "deviceName": "MacBook Pro",
      "deviceType": "desktop",
      "browser": "Chrome",
      "os": "macOS",
      "ipAddress": "192.168.1.1",
      "location": "Dhaka, BD",
      "lastActiveAt": "2023-10-25T10:00:00.000Z",
      "createdAt": "2023-10-01T10:00:00.000Z",
      "expiresAt": "2023-10-31T10:00:00.000Z",
      "isImpersonation": false,
      "impersonatorName": null,
      "isCurrent": true
    }
  ]
}
```

---

### DELETE `/api/v1/sessions/others`

**Auth**: Bearer token

Revoke all sessions except the current one.

**Response** `200`:
```json
{
  "success": true,
  "data": { "message": "Revoked 2 session(s)", "revokedCount": 2 }
}
```

---

### DELETE `/api/v1/sessions/:id`

**Auth**: Bearer token

Revoke a specific session.

**Response** `200`:
```json
{
  "success": true,
  "data": { "message": "Session revoked" }
}
```

---

### GET `/api/v1/sessions/history`

**Auth**: Bearer token

Get login history for the current user.

**Query Parameters**:
- `page` (optional) - Default 1
- `limit` (optional) - Default 20 (Max 100)

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "...",
        "eventType": "login",
        "browser": "Chrome",
        "os": "macOS",
        "ipAddress": "192.168.1.1",
        "location": "Dhaka, BD",
        "metadata": {},
        "createdAt": "2023-10-25T10:00:00.000Z"
      }
    ],
    "meta": {
      "total": 10,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### GET `/api/v1/sessions/tenant`

**Auth**: Bearer token
**Roles**: `owner`

List all sessions in the tenant (owner oversight).

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "userId": "...",
      "userName": "Hana Rahman",
      "deviceName": "iPhone 13",
      "deviceType": "mobile",
      "browser": "Safari",
      "os": "iOS",
      "ipAddress": "192.168.1.2",
      "location": "Dhaka, BD",
      "lastActiveAt": "2023-10-25T10:00:00.000Z",
      "createdAt": "2023-10-01T10:00:00.000Z",
      "isCurrent": false,
      "isImpersonation": false,
      "impersonatorName": null
    }
  ]
}
```

---

### DELETE `/api/v1/sessions/tenant/:id`

**Auth**: Bearer token
**Roles**: `owner`

Revoke a staff session (owner action).

**Response** `200`:
```json
{
  "success": true,
  "data": { "message": "Staff session revoked" }
}
```
