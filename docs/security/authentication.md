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
  "sessionId": "session-uuid",
  "iat": 1711519200,
  "exp": 1711520100
}
```

| Property | Value |
|---|---|
| Algorithm | HS256 (HMAC SHA-256) |
| TTL | **15 minutes** |
| Storage | Client memory (NOT localStorage) |
| Refresh | Automatic via refresh token on 401 |

### Refresh Token (Long-lived)

| Property | Value |
|---|---|
| TTL | **7 days** |
| Storage | httpOnly, Secure, SameSite=Strict cookie |
| Rotation | New refresh token issued on each use |
| Revocation | Hashed in sessions table; deleted on logout/revoke |

> **See also**: [session-management.md](../features/session-management.md) for full session tracking, device info, concurrent limits, and login history.

---

## Auth Flow

```
[Login] → Server validates credentials
       → Create session record (device info, IP, location)
       → Generate access token (with sessionId) + refresh token
       → Store refresh token hash in sessions table
       → Return access token in body, refresh token in httpOnly cookie

[API Request] → Client sends: Authorization: Bearer <accessToken>
             → JWT Guard validates token (stateless, no DB check)
             → Extract user + tenantId + sessionId
             → Attach to request context
             → Update session lastActiveAt (debounced, every 5 min)

[Token Expired] → Client gets 401
              → Client calls POST /auth/refresh
              → Server validates refresh token from cookie against sessions table
              → If session valid → Issue new access + refresh tokens (rotation)
              → If session revoked/expired → Return 401 → redirect to login
              → Invalidate old refresh token

[Logout] → Delete session record from DB
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
