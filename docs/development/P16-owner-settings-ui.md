# P16 — Owner Portal: Settings & Staff UI

| | |
|---|---|
| **Phase** | 5 — Owner Portal Frontend |
| **Estimated Time** | 3–4 hours |
| **Requires** | P12 (owner layout), P06 (settings APIs) |
| **Unlocks** | P20 |
| **Agent Skills** | `nextjs-best-practices`, `vercel-react-best-practices`, `shadcn`, `tailwind-css-patterns` · Optional: `tailwindcss-mobile-first` |

---

## REFERENCE DOCS

- `docs/ui/owner/store-settings.md` — Settings page spec
- `docs/ui/owner/staff-management.md` — Staff management spec
- `docs/features/business-branding.md` — Branding settings
- `docs/features/custom-domain.md` — Domain management
- `docs/features/localization.md` — Locale settings
- `docs/features/session-management.md` — Session management UI

---

## SCOPE

### 1. Settings Page (`/settings`)

Tabbed interface with sections:

**General tab:**
- Store name, tagline, about text
- Contact info (phone, WhatsApp, email, address)

**Branding tab:**
- Logo upload with preview (current logo shown)
- Favicon upload with preview
- Primary + secondary color pickers
- Live preview of color scheme

**Locale tab:**
- Timezone select (IANA timezone list)
- Country select (ISO 3166-1)
- Currency (code, symbol, position)
- Date format, time format, number format, week start

**Payment tab:**
- bKash/Nagad number fields
- SSLCommerz credentials (masked inputs)
- Sandbox mode toggle
- Test payment button

**Delivery tab:**
- Default courier select
- Courier API key/secret (masked)
- Pickup address

**Domain tab:**
- Current subdomain (read-only)
- Custom domain input + save
- DNS instructions for CNAME setup
- Domain verification status

**Operational tab:**
- Max concurrent sessions slider
- Buffer days between bookings
- Auto-expire pending bookings after N hours

### 2. Staff Management Page (`/settings/staff`)

- Staff list: Name, Role, Email/Phone, Last Active, Status
- Invite staff dialog: name, phone/email, role select
- Edit staff role
- Remove staff (with confirmation)
- View staff sessions (from session management API)

### 3. Session Management Page (`/settings/sessions`)

- Active sessions list: Device, Browser, IP, Location, Last Active
- Current session highlighted
- Revoke individual session button
- "Revoke all other sessions" button
- Login history table (recent logins with success/fail status)

### 4. Subscription Page (`/settings/subscription`)

- Current plan display (name, features, limits)
- Usage meters (products used / limit, staff count / limit, storage)
- Upgrade button (links to plans page)

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | Settings page with all tabs | All sections load and save |
| 2 | Logo/favicon upload with preview | Upload, preview, save |
| 3 | Color picker with live preview | Branding colors update |
| 4 | Locale configuration | All locale fields settable |
| 5 | Staff management | Invite, edit role, remove |
| 6 | Session management | View, revoke sessions |
| 7 | Subscription display | Plan details and usage |
