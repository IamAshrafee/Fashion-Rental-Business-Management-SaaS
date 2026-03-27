# Feature: Session Management

| | |
|---|---|
| **Scope** | Login Sessions, Device Tracking, Session History, Session Revocation |
| **Status** | 📋 Specified |
| **Last Updated** | 2026-03-27 |
| **Related Docs** | [authentication.md](../security/authentication.md), [authorization.md](../security/authorization.md), [event-system.md](../event-system.md) |

---

## TL;DR

All authenticated users (owner, manager, staff, SaaS admin) can view their active login sessions, see which devices/browsers are logged in, review login history, and remotely revoke any session. Owners can also view and revoke staff sessions within their tenant. This gives full visibility and control over account security across the multi-tenant platform.

---

## 1. What & Why

When a user logs into the owner portal or admin portal, the system tracks the session along with device information. Users can then:

- **See active sessions** — know where they're currently logged in
- **Review login history** — see past logins for security awareness
- **Revoke sessions** — log out of specific devices remotely
- **Owner oversight** — owners can view/revoke staff sessions in their tenant

**Why this matters:**
- A staff member might forget to log out on a shared computer — owner can revoke remotely
- If someone detects a login from an unfamiliar device, they can revoke it immediately
- Standard security feature expected in any modern SaaS admin panel
- Provides an audit trail for all tenant operations
- Multi-tenant isolation — each tenant's sessions are completely separate

**Scope:** Owner portal (owner, manager, staff) and SaaS admin portal only. Guest portal has no login — no sessions.

---

## 2. Core Capabilities

| Capability | Description |
|---|---|
| **View active sessions** | See all currently logged-in sessions with device and location info |
| **View login history** | See past login events (successful, failed, revoked) |
| **Identify current session** | Clearly mark which session belongs to the current browser |
| **Revoke a session** | Log out a specific session — target device loses access immediately |
| **Revoke all other sessions** | One-click to log out everywhere except the current device |
| **Device info display** | Browser name, OS, approximate location for each session |
| **Concurrent session limits** | Owner sets max active sessions for their tenant — enforced on login |
| **Owner staff oversight** | Owner can view and revoke sessions of staff/managers in their tenant |

---

## 3. Session Data Model

### Active Sessions Table

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Unique session identifier |
| `tenantId` | FK → Tenants | Tenant this session belongs to (null for SaaS admin) |
| `userId` | FK → Users | Which user this session belongs to |
| `refreshTokenHash` | string | Hashed refresh token for this session |
| `deviceName` | string | Parsed from User-Agent (e.g., "Chrome on Windows") |
| `deviceType` | enum | `desktop`, `mobile`, `tablet` |
| `browser` | string | Browser name (e.g., "Chrome", "Firefox", "Safari") |
| `os` | string | Operating system (e.g., "Windows 11", "macOS", "Android 14") |
| `ipAddress` | string | IP address at time of login |
| `location` | string | Approximate location from IP (optional) |
| `lastActiveAt` | timestamptz | Last time this session made a request (debounced) |
| `createdAt` | timestamptz | When the login occurred |
| `expiresAt` | timestamptz | When this session expires if inactive |

**Indexes:**
- `(userId)` — find all sessions for a user
- `(tenantId)` — find all sessions for a tenant (owner oversight)
- `(refreshTokenHash)` — token lookup on refresh

### Login History Table

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Unique event identifier |
| `tenantId` | FK → Tenants | Tenant context (null for SaaS admin) |
| `userId` | FK → Users | Which user this event relates to |
| `eventType` | enum | `login_success`, `login_failed`, `session_revoked`, `logout`, `token_refreshed` |
| `browser` | string | Browser name |
| `os` | string | Operating system |
| `ipAddress` | string | IP address |
| `location` | string | Approximate location (optional) |
| `createdAt` | timestamptz | When the event occurred |
| `metadata` | JSONB | Extra context (failure reason, who revoked, new device alert, etc.) |

---

## 4. User Interface

### Active Sessions View

Accessible from: **Settings → Sessions** (owner portal) or **Profile → Sessions**

```
┌──────────────────────────────────────────────────────────┐
│  Active Sessions                             [Revoke All] │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  🟢 Chrome on Windows                  ← THIS DEVICE     │
│     IP: 103.xx.xx.xx · Dhaka, Bangladesh                  │
│     Last active: Just now                                 │
│     Logged in: March 27, 2026 at 10:30 PM                │
│                                                           │
│  ─────────────────────────────────────────────────────    │
│                                                           │
│  🟢 Safari on macOS                          [Revoke]     │
│     IP: 103.xx.xx.xx · Dhaka, Bangladesh                  │
│     Last active: 2 hours ago                              │
│     Logged in: March 27, 2026 at 8:15 PM                 │
│                                                           │
│  ─────────────────────────────────────────────────────    │
│                                                           │
│  🟡 Firefox on Android                      [Revoke]      │
│     IP: 37.xx.xx.xx · Chittagong, Bangladesh              │
│     Last active: 3 days ago                               │
│     Logged in: March 24, 2026 at 6:00 PM                 │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

**UI Requirements:**
- Current session clearly labeled "THIS DEVICE" — cannot be revoked from this view
- Each session shows: browser + OS, IP (partially masked), location, last active time, login time
- "Revoke" button on each non-current session
- "Revoke All Other Sessions" button at the top
- Confirmation dialog before revoking
- Session indicators: 🟢 active (< 1 hour), 🟡 idle (> 1 hour), 🔴 stale (> 24 hours)

### Login History View

```
┌──────────────────────────────────────────────────────────┐
│  Login History                                            │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ✅ Successful login                                      │
│     Chrome on Windows · 103.xx.xx.xx · Dhaka              │
│     March 27, 2026 at 10:30 PM                           │
│                                                           │
│  🔴 Session revoked                                       │
│     Chrome on Windows · 103.xx.xx.xx · Dhaka              │
│     March 26, 2026 at 5:00 PM                            │
│     Revoked by: Store Owner (self)                        │
│                                                           │
│  ❌ Failed login attempt                                  │
│     Unknown browser · 45.xx.xx.xx · Unknown               │
│     March 25, 2026 at 3:12 AM                            │
│                                                           │
│                           [Load More]                     │
└──────────────────────────────────────────────────────────┘
```

**UI Requirements:**
- Chronological list (newest first)
- Color-coded event types (✅ success, 🔴 revoked, ❌ failed)
- Paginated (20 per page)
- Shows who revoked a session (self, owner, or SaaS admin)

### Owner Staff Session View

Owners can see and manage staff sessions within their tenant:

**Settings → Staff Sessions**

```
┌──────────────────────────────────────────────────────────┐
│  Staff Sessions                                           │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Fatima Rahman (Manager) — 2 active sessions              │
│  ├── Chrome on Windows · Last active: 10 min ago          │
│  └── Safari on iPhone · Last active: 1 day ago   [Revoke] │
│                                                           │
│  Karim Uddin (Staff) — 1 active session                   │
│  └── Chrome on Android · Last active: 3 hours ago [Revoke]│
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Behavior & Rules

### Session Creation

| Trigger | Action |
|---|---|
| User logs in successfully | Create new session record, log `login_success` event |
| Parse User-Agent header | Extract browser name, OS, device type |
| Capture IP address | Use `X-Forwarded-For` or Nginx `X-Real-IP` header |
| Geo-lookup (optional) | Resolve IP to location via MaxMind GeoLite2 or Cloudflare `CF-IPCountry` |
| Check concurrent limits | If over limit, revoke oldest session |

### Session Activity Tracking

| Trigger | Action |
|---|---|
| Any authenticated API request | Update `lastActiveAt` on the session |
| Debounce frequency | Update at most once per 5 minutes to reduce DB writes |

### Session Revocation

| Trigger | Action |
|---|---|
| User clicks "Revoke" on a session | Delete session record, invalidate refresh token, log `session_revoked` |
| User clicks "Revoke All Others" | Delete all sessions except current, log events for each |
| Owner revokes a staff session | Same as above, metadata records `revokedBy: ownerId` |
| SaaS admin revokes any session | Same, metadata records `revokedBy: adminId` |
| Effect on revoked session | Next request returns 401, next refresh fails → redirected to login |

### Session Expiration

| Rule | Detail |
|---|---|
| Inactivity expiry | Configurable per tenant (default: 7 days) |
| Absolute expiry | 30 days regardless of activity (force re-login) |
| Expired sessions | Cleaned up by CRON job (`session.cleanExpired`, daily) |
| Grace period | None — expired means expired |

### Integration with Existing Auth Flow

The existing JWT + refresh token auth (from `security/authentication.md`) is extended:

```
[Existing Flow]
Login → Issue access token (15 min) + refresh token (7 days, httpOnly cookie)

[Extended with Session Management]
Login → Create session record → Link refresh token to session
      → Issue access token with sessionId claim
      → Refresh token stored as hash in sessions table

Token Refresh → Look up session by refreshTokenHash
             → If session exists and not expired → issue new tokens
             → If session revoked/expired → return 401
             → Update lastActiveAt (debounced)
```

---

## 6. Concurrent Session Limits

### Configuration

Owner configures in **Settings → Security**:

```
┌──────────────────────────────────────────────────────────┐
│  Concurrent Session Limit                                 │
│  ┌────────────────────────────────────────────────┐      │
│  │  ○ 1 device only                               │      │
│  │  ○ 2 devices (any type)                         │      │
│  │  ◉ 1 PC + 1 mobile device                      │      │
│  │  ○ 3 devices                                    │      │
│  │  ○ Unlimited                                    │      │
│  └────────────────────────────────────────────────┘      │
│                                                           │
│  ℹ️  When a user exceeds this limit, their oldest          │
│     session is automatically logged out.                  │
│                                                           │
│  ⚠️  This does not apply to the store owner account.       │
└──────────────────────────────────────────────────────────┘
```

### Rules

| Rule | Detail |
|---|---|
| Who can configure | Owner (for their tenant), SaaS admin (global override) |
| Applies to | Manager and staff roles within the tenant |
| Exempt | Owner is never subject to session limits within their tenant |
| SaaS admin | Never subject to any session limits |
| Default | Unlimited (no restriction) |
| Enforcement | On login — oldest session revoked if limit exceeded |
| Limit lowered | Existing excess sessions revoked on the user's next login |

### Device Type Detection

| Device Type | Detected From | Examples |
|---|---|---|
| `desktop` | User-Agent | Windows, macOS, Linux (non-mobile) |
| `mobile` | User-Agent | Android, iOS phones |
| `tablet` | User-Agent | iPad, Android tablets |

### Enforcement Flow

```
User logs in on a new device
    ↓
Check: How many active sessions does this user have?
    ↓
Under limit → Login proceeds normally
    ↓
At/over limit → Revoke oldest session(s) to make room
    ↓
Log revocation event with reason: "session_limit_exceeded"
    ↓
For "1 PC + 1 mobile" mode:
  - New desktop login → revoke oldest desktop session
  - New mobile login → revoke oldest mobile session
  - Cross-type sessions are independent
```

---

## 7. Role-Based Permissions

| Action | SaaS Admin | Owner | Manager | Staff |
|---|---|---|---|---|
| View own sessions | ✅ | ✅ | ✅ | ✅ |
| Revoke own sessions | ✅ | ✅ | ✅ | ✅ |
| View own login history | ✅ | ✅ | ✅ | ✅ |
| View tenant staff sessions | ✅ (all tenants) | ✅ (own tenant) | ❌ | ❌ |
| Revoke tenant staff sessions | ✅ (all tenants) | ✅ (own tenant) | ❌ | ❌ |
| Configure session limits | ✅ (global) | ✅ (own tenant) | ❌ | ❌ |
| View tenant login history | ✅ (all tenants) | ✅ (own tenant) | ❌ | ❌ |

---

## 8. Multi-Tenant Considerations

| Concern | Solution |
|---|---|
| Session isolation | All session queries include `WHERE tenant_id = ?` |
| Cross-tenant access | SaaS admin queries omit tenant filter |
| Session data in Redis | Cache key: `session:{tenantId}:{sessionId}` |
| Staff leaves tenant | Owner revokes all their sessions → staff record soft deleted |
| Tenant suspended | All tenant sessions bulk-revoked by SaaS admin |
| Tenant timezone | Login history timestamps displayed in tenant's timezone |

---

## 9. Technical Notes

### User-Agent Parsing

Use `ua-parser-js` (Node.js) to parse User-Agent into readable device info:

| Raw User-Agent | Parsed Display |
|---|---|
| `Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0` | Chrome on Windows |
| `Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15` | Safari on macOS |
| `Mozilla/5.0 (Linux; Android 14) Chrome/120.0` | Chrome on Android |
| `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1` | Safari on iOS |

### IP and Location

- Use `X-Real-IP` (set by Nginx) or `X-Forwarded-For` for real client IP
- If behind Cloudflare: use `CF-Connecting-IP` for IP, `CF-IPCountry` for country
- Optional: MaxMind GeoLite2 for city-level geolocation
- IP display: partially mask for privacy (e.g., `103.xx.xx.42`)

### Token Invalidation

Sessions are **database-backed** (not JWT blocklist):

```
Access token (15 min, stateless JWT)
  → Contains: userId, tenantId, role, sessionId
  → NOT checked against DB on every request (performance)
  → Short-lived — even if session revoked, access expires in ≤15 min

Refresh token (7 days, httpOnly cookie)
  → Hashed and stored in sessions table
  → Checked against DB on every refresh
  → If session revoked → refresh fails → user must re-login
  → Maximum exposure window: 15 minutes (access token lifetime)
```

### Event Integration

Session events feed into the event system:

```typescript
this.eventEmitter.emit('auth.login', { user, tenant, session, ip });
this.eventEmitter.emit('auth.sessionRevoked', { session, revokedBy, reason });
this.eventEmitter.emit('auth.loginFailed', { phone, ip, attempts });
```

### CRON Job

Add to background jobs registry:

| Job | Schedule | Description |
|---|---|---|
| `session.cleanExpired` | Daily 01:00 UTC | Delete sessions where `lastActiveAt` > inactivity expiry or `createdAt` > absolute expiry |

---

## 10. API Endpoints

### Session Management

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/sessions` | Owner, Manager, Staff | List own active sessions |
| `DELETE` | `/api/v1/sessions/:id` | Owner, Manager, Staff | Revoke a specific session |
| `DELETE` | `/api/v1/sessions/others` | Owner, Manager, Staff | Revoke all sessions except current |
| `GET` | `/api/v1/sessions/history` | Owner, Manager, Staff | View own login history (paginated) |

### Owner Staff Oversight

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/tenant/sessions` | Owner | List all active sessions in tenant |
| `DELETE` | `/api/v1/tenant/sessions/:id` | Owner | Revoke a staff session |
| `GET` | `/api/v1/tenant/sessions/history` | Owner | View tenant-wide login history |

### SaaS Admin

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/admin/sessions` | SaaS Admin | List all sessions across all tenants |
| `DELETE` | `/api/v1/admin/sessions/:id` | SaaS Admin | Revoke any session |
| `DELETE` | `/api/v1/admin/tenants/:id/sessions` | SaaS Admin | Revoke all sessions for a tenant |

---

## 11. Decisions & Rationale

| Decision | Options Considered | Chosen | Why |
|---|---|---|---|
| Session storage | JWT-only vs DB-backed | Database-backed | Required for listing, revocation, and device tracking |
| Location tracking | IP geo-lookup vs Cloudflare header | Cloudflare header + optional GeoLite2 | Low effort, no external API calls |
| Activity tracking | Every request vs debounced | Debounced (5-min interval) | Reduces DB write load |
| Login history scope | Success only vs all events | All events | Complete audit trail |
| Session limit enforcement | Block login vs revoke oldest | Revoke oldest | User can always log in — never locked out |
| Limit configuration scope | Global vs per-tenant | Per-tenant (owner configures) | Each business has different security needs |
| Token invalidation window | Immediate (check DB every request) vs delayed (access token expiry) | Delayed (≤15 min) | Performance — DB check only on refresh, not every API call |
