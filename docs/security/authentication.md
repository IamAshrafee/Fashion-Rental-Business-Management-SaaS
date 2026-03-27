# Security: Authentication

## Strategy

JWT-based stateless authentication with refresh token rotation.

---

## Token Design

### Access Token (Short-lived)

```json
{
  "sub": "user-uuid",
  "tenantId": "tenant-uuid",
  "role": "owner",
  "iat": 1711519200,
  "exp": 1711605600
}
```

| Property | Value |
|---|---|
| Algorithm | HS256 (HMAC SHA-256) |
| TTL | 24 hours |
| Storage | Client memory (NOT localStorage) |
| Refresh | Automatic via refresh token |

### Refresh Token (Long-lived)

| Property | Value |
|---|---|
| TTL | 30 days |
| Storage | httpOnly, Secure, SameSite=Strict cookie |
| Rotation | New refresh token issued on each use |
| Revocation | Stored in DB; deleted on logout |

---

## Auth Flow

```
[Login] → Server validates credentials
       → Generate access token + refresh token
       → Store refresh token hash in DB
       → Return access token in body, refresh token in httpOnly cookie

[API Request] → Client sends: Authorization: Bearer <accessToken>
             → JWT Guard validates token
             → Extract user + tenantId
             → Attach to request context

[Token Expired] → Client gets 401
              → Client calls POST /auth/refresh
              → Server validates refresh token from cookie
              → Issue new access + refresh tokens (rotation)
              → Invalidate old refresh token

[Logout] → Delete refresh token from DB
        → Clear httpOnly cookie
```

---

## Password Security

| Policy | Rule |
|---|---|
| Minimum length | 8 characters |
| Complexity | At least 1 uppercase + 1 number |
| Hashing | bcrypt with cost factor 12 |
| Password reset | OTP via SMS (6-digit, 5-min expiry) |
| Brute force | Lock after 5 failed attempts for 15 minutes |

---

## NestJS Guards

```typescript
// JWT Auth Guard — validates access token
@UseGuards(JwtAuthGuard)

// Roles Guard — checks user role
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'manager')

// Combined with Tenant Guard
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
```

---

## Security Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```
