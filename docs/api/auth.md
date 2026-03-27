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
  "password": "securePassword123"
}
```

`identifier` can be email or phone number.

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "fullName": "...", "role": "owner" },
    "tenants": [
      { "id": "...", "businessName": "Hana's Boutique", "subdomain": "hanasboutique", "role": "owner" }
    ],
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG..."
  }
}
```

If user belongs to multiple tenants, client shows a tenant selector.

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
    "refreshToken": "eyJhbG..."
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

Sends OTP via SMS (or email if email provided).

**Response** `200`:
```json
{
  "success": true,
  "data": { "message": "OTP sent", "expiresIn": 300 }
}
```

---

### POST `/api/v1/auth/reset-password`

**Auth**: None

**Request Body**:
```json
{
  "identifier": "01712345678",
  "otp": "123456",
  "newPassword": "newSecurePassword123"
}
```

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
    "currentTenant": {
      "id": "...",
      "businessName": "Hana's Boutique",
      "subdomain": "hanasboutique",
      "role": "owner"
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
