# PRD: Manual Tenant Subscription, Billing & Limits Management

## 1. Executive Summary & Vision
This module represents the revenue engine for the early-stage Fashion Rental SaaS. The core philosophy is **"White-Glove Onboarding, Professional Execution."** 

Because early validation requires high-touch sales, all monetary transactions and plan upgrades are handled off-platform (via manual negotiation). However, the software must act as a precise, automated "Headless Billing System." The system tracks limits dynamically, injects contextual upgrade nudges into the UI, provides grace periods, and generates professional tracking data. 

**The Goal:** The tenant feels like they are using a $100M valuation Enterprise SaaS, while the Admin (System Owner) routes payments directly to their bank account with zero platform fees, managing subscriptions via a 5-second admin modal.

---

## 2. Deep-Dive: The Subscription Lifecycle & States

To prevent business disruption during manual billing (e.g., waiting for a bank transfer to clear), the system relies on highly specific status states.

### 2.1 The States (`SubscriptionStatus`)
1. **`FREE_TIER`**: Assigned instantly upon registration. Has strict `Plan` limits (e.g., 50 products, 50 orders/month).
2. **`ACTIVE`**: A paid plan activated by the Admin. Limits are elevated based on the negotiated plan.
3. **`GRACE_PERIOD`**: (Crucial for Manual Billing). If a monthly paid plan expires on the 1st, it enters a 3-5 day Grace Period. The tenant's storefront and operations continue running perfectly, but the tenant dashboard shows a critical warning: *"Your manual payment is due. Service will pause in X days."* This prevents angry customers whose bank transfers are pending.
4. **`SUSPENDED`**: Grace period ended without Admin activating renewal. Tenant storefront goes offline (shows "Maintenance" or custom error). Tenant dashboard is locked to a single screen: "Your account is suspended. Contact Admin to resume."

### 2.2 The Limit Enforcement Logic (Soft vs. Hard Limits)
- **Soft Limits (80% Usage):** When a tenant reaches 80% usage of their plan quota.
  - **UX:** Gentle UI nudges appear. Progress bars turn warning orange. 
  - **Goal:** Start the negotiation conversation *before* they are blocked.
- **Hard Limits (100% Usage):** 
  - **UX:** The tenant's business is **not** broken. Existing active orders/products are untouched. However, the exact action that breaches the limit (e.g., clicking "Add New Product") is intercepted by a beautifully animated modal: *"You've hit your plan's maximum capacity! Your business is growing fast. Message Admin to unlock the next tier."*

---

## 3. World-Class UI/UX Constraints

### 3.1 Tenant Dashboard (Zero Duplication & Distraction)
- **Unified Location:** The Billing interface exists **only** at `Settings -> Billing`. The main sidebar must remain completely clean for daily operations.
- **The "Premium Lock" Component (`<PremiumLock>`):** A global frontend wrapper component. If a Free tier user tries to access a premium feature (e.g., Advanced Analytics), the feature is visibly locked. Clicking it triggers the `<PremiumLock>` modal, which instantly deep-links to WhatsApp/Admin-Email with pre-filled context: *"Hi, I want to upgrade to unlock Advanced Analytics."*
- **No Broken UI/Payment Errors:** Because there is no Stripe integration yet, the UI will **never** display generic automated error states like "Card Declined." Every "blocker" must be framed positively as an invitation to chat with the Admin.

### 3.2 The Single-View "Billing Tab" (Tenant View)
1. **Current Plan Card:** A sleek, gradient background. Displays `Plan Name`, `Days Remaining`, and visually satisfying progress bars for `Products`, `Orders`, and `Storage (if applicable)`.
2. **Concierge Hook:** A primary "Message Admin to Scale/Upgrade" button right beneath the limits.
3. **Purchase History & Invoices:** 
   - A minimalist, paginated data table showing all past manual payments.
   - Columns: `Date`, `Plan Mode`, `Amount Paid`, `Payment Method`, and `Status (Paid)`.
   - **Download Invoice Action:** A sleek "PDF" or "Eye" icon that dynamically opens a beautiful, professional UI Invoice/Receipt combining system logo, company details, amount paid, and the reference ID registered by the admin. *This guarantees trust.*

### 3.3 The Super Admin "Command Center" (Speed & Accuracy)
- **The 5-Second Upgrade Modal:** The Super Admin must not dig through complex accounting screens. From the main `Tenants List`, clicking an "Update Plan" icon opens a modal:
  1. **Select Plan:** (Dropdown).
  2. **Negotiated Amount Received:** (Number input - exactly what hit your bank account).
  3. **Duration/Expiry:** (Date picker, defaults to +30 Days or +1 Year).
  4. **Payment Reference (Optional):** (e.g., "Bkash TxID 99321").
  5. **Admin Internal Note (CRM):** (e.g., "Gave him a $10 discount this month").
- **Admin Transaction Tracker & Invoice Vault:** In the Super Admin panel, under a dedicated `Revenue & Global Transactions` tab:
  - You see a master list of **all** payments processed manually across the platform.
  - You have full access to view, edit (in case of a typo), or download the exact same dynamically generated **Tax Invoices/Receipts** the tenants see.
  - **Revenue Dashboard Widget:** The Admin homepage features a "Cashflow Chart" that simply aggregates the `amountPaid` from the manually logged `Transaction` records. It acts as an instant health check on the business.

---

## 4. Deep Data Architecture (Prisma Schema Blueprint)

This schema guarantees that when the system transitions to Stripe, the structural core (Limits & Subscriptions) requires **zero** migrations. Future Webhooks will simply automate the creation of `PaymentTransaction` records.

```prisma
// Represents the tier capabilities (Template)
model SubscriptionPlan {
  id               String   @id @default(cuid())
  name             String   // "Free Validation", "Growth Plan", "Enterprise"
  stickerPrice     Decimal  // Used for marketing display, actual price is negotiated
  maxProducts      Int      
  maxMonthlyOrders Int      
  includedFeatures String[] // e.g. ["CUSTOM_DOMAIN", "ADVANCED_REPORTS"]
  isArchived       Boolean  @default(false)
  
  subscriptions    TenantSubscription[]
}

// The living state of a Tenant's access
model TenantSubscription {
  id               String   @id @default(cuid())
  tenantId         String   @unique
  planId           String
  
  status           SubscriptionStatus @default(FREE_TIER)
  
  // Timestamps for time-based access
  startDate        DateTime @default(now())
  endDate          DateTime? // Null if Lifetime/Free
  lastRenewedAt    DateTime?
  
  // Relations
  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  plan             SubscriptionPlan @relation(fields: [planId], references: [id])
}

// Immutable ledger of all money manually collected. 
// Enables automated PDF generation for the tenant.
model PaymentTransaction {
  id               String   @id @default(cuid())
  tenantId         String
  
  amountPaid       Decimal  // The actual negotiated cash received
  currency         String   @default("USD")
  paymentMethod    String   // "BANK_TRANSFER", "CASH", "PAYPAL_MANUAL". Future: "STRIPE_AUTO"
  
  // Auditing and Receipts
  referenceInfo    String?  // E.g., transaction ID from the bank
  adminNote        String?  // Internal CRM note explaining a discount
  createdByAdminId String   // Audit trail: Which admin clicked the trigger?
  
  createdAt        DateTime @default(now())
  
  // Relations
  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)
}

enum SubscriptionStatus {
  FREE_TIER
  ACTIVE
  GRACE_PERIOD
  SUSPENDED
  CANCELLED
}
```

---

## 5. Execution & Future-Proofing Strategy

### 5.1 The Transition to Automation (Phase 2)
Because we have heavily separated the `PaymentTransaction` (the capturing of money) from `TenantSubscription` (the provisioning of limits), Phase 2 (Stripe integration) is trivial:
1. The Tenant clicks "Upgrade".
2. Instead of "Message Admin", it opens a Stripe Checkout Session.
3. Upon payment, Stripe sends a webhook.
4. The Webhook executes the **exact same code block** that the Super Admin's "5-Second Modal" executes today.
5. `PaymentTransaction` is logged with method `STRIPE_AUTO`.
6. Nothing on the Tenant's historical invoice view breaks.

### 5.2 Middleware Protection
To ensure security, a NestJS `SubscriptionGuard` (or Next.js Middleware) will intercept all requests. 
- It checks the `TenantSubscription.status` and `TenantSubscription.endDate`.
- If `status === SUSPENDED`, it returns an HTTP 402 Payment Required, and the frontend instantly redirects the user to the `Settings -> Billing` lockscreen.
- Limit checks (e.g., `maxProducts`) will be queried dynamically or cached in Redis upon Tenant login to ensure instant, latency-free verification every time they create a resource.
