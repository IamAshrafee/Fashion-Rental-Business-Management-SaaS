# Database Schema: `tenants` + `store_settings`

## Table: `tenants`

The root entity. Every tenant-scoped record references this table.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `business_name` | VARCHAR(200) | No | — | Display name |
| `subdomain` | VARCHAR(30) | No | — | Unique subdomain slug |
| `custom_domain` | VARCHAR(255) | Yes | `NULL` | Custom domain (e.g., rentbysara.com) |
| `owner_user_id` | UUID | No | — | FK → `users.id` |
| `status` | ENUM | No | `'active'` | active, suspended, cancelled |
| `plan_id` | UUID | Yes | `NULL` | FK → `subscription_plans.id` |
| `logo_url` | VARCHAR(500) | Yes | `NULL` | Logo image URL (MinIO) |
| `favicon_url` | VARCHAR(500) | Yes | `NULL` | Favicon URL |
| `created_at` | TIMESTAMP | No | `NOW()` | Created timestamp |
| `updated_at` | TIMESTAMP | No | `NOW()` | Last updated |

### Enums

```prisma
enum TenantStatus {
  active
  suspended
  cancelled
}
```

### Indexes

| Index | Columns | Type | Purpose |
|---|---|---|---|
| `tenants_subdomain_key` | `subdomain` | UNIQUE | Subdomain lookup |
| `tenants_custom_domain_key` | `custom_domain` | UNIQUE (where not null) | Custom domain lookup |
| `tenants_owner_user_id_idx` | `owner_user_id` | INDEX | Find tenants by owner |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `owner` | belongs-to | `users` |
| `plan` | belongs-to | `subscription_plans` |
| `storeSettings` | has-one | `store_settings` |
| `products` | has-many | `products` |
| `categories` | has-many | `categories` |
| `bookings` | has-many | `bookings` |
| `customers` | has-many | `customers` |
| `users` (staff) | has-many | `users` (via junction) |

---

## Table: `store_settings`

One-to-one with tenant. Stores all branding and configuration settings.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` (unique) |
| `primary_color` | VARCHAR(7) | No | `'#6366F1'` | Hex color code |
| `secondary_color` | VARCHAR(7) | Yes | `'#EC4899'` | Hex color code |
| `tagline` | VARCHAR(300) | Yes | `NULL` | Business tagline |
| `about` | TEXT | Yes | `NULL` | About the business (rich text) |
| `phone` | VARCHAR(20) | Yes | `NULL` | Business phone |
| `whatsapp` | VARCHAR(20) | Yes | `NULL` | WhatsApp number |
| `email` | VARCHAR(255) | Yes | `NULL` | Business email |
| `address` | TEXT | Yes | `NULL` | Physical address |
| `facebook_url` | VARCHAR(500) | Yes | `NULL` | Facebook page URL |
| `instagram_url` | VARCHAR(500) | Yes | `NULL` | Instagram URL |
| `tiktok_url` | VARCHAR(500) | Yes | `NULL` | TikTok URL |
| `youtube_url` | VARCHAR(500) | Yes | `NULL` | YouTube URL |
| `default_language` | VARCHAR(5) | No | `'en'` | Default storefront language |
| `timezone` | VARCHAR(50) | No | `'UTC'` | IANA timezone (e.g., Asia/Dhaka) |
| `country` | VARCHAR(2) | No | `'BD'` | ISO 3166-1 country code |
| `currency_code` | VARCHAR(3) | No | `'BDT'` | ISO 4217 currency code |
| `currency_symbol` | VARCHAR(5) | No | `'৳'` | Currency display symbol |
| `currency_position` | VARCHAR(10) | No | `'before'` | before or after number |
| `number_format` | VARCHAR(20) | No | `'south_asian'` | south_asian or international |
| `date_format` | VARCHAR(20) | No | `'DD/MM/YYYY'` | Date display format |
| `time_format` | VARCHAR(5) | No | `'12h'` | 12h or 24h |
| `week_start` | VARCHAR(10) | No | `'saturday'` | saturday, sunday, or monday |
| `sms_enabled` | BOOLEAN | No | `true` | SMS notifications enabled |
| `bkash_number` | VARCHAR(20) | Yes | `NULL` | bKash payment number |
| `nagad_number` | VARCHAR(20) | Yes | `NULL` | Nagad payment number |
| `sslcommerz_store_id` | VARCHAR(100) | Yes | `NULL` | SSLCommerz store ID |
| `sslcommerz_store_pass` | VARCHAR(255) | Yes | `NULL` | SSLCommerz password (encrypted) |
| `sslcommerz_sandbox` | BOOLEAN | No | `true` | SSLCommerz sandbox mode |
| `default_courier` | VARCHAR(50) | Yes | `NULL` | Default courier provider |
| `courier_api_key` | VARCHAR(255) | Yes | `NULL` | Courier API key (encrypted) |
| `courier_secret_key` | VARCHAR(255) | Yes | `NULL` | Courier secret (encrypted) |
| `pickup_address` | TEXT | Yes | `NULL` | Default pickup address for courier |
| `max_concurrent_sessions` | INT | No | `5` | Max active login sessions per staff user |
| `buffer_days` | INT | No | `0` | Default gap days between bookings |
| `created_at` | TIMESTAMP | No | `NOW()` | Created timestamp |
| `updated_at` | TIMESTAMP | No | `NOW()` | Last updated |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `store_settings_tenant_id_key` | `tenant_id` | UNIQUE |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `tenant` | belongs-to | `tenants` |

---

## Prisma Models

```prisma
model Tenant {
  id            String       @id @default(uuid())
  businessName  String       @map("business_name")
  subdomain     String       @unique
  customDomain  String?      @unique @map("custom_domain")
  ownerUserId   String       @map("owner_user_id")
  status        TenantStatus @default(active)
  planId        String?      @map("plan_id")
  logoUrl       String?      @map("logo_url")
  faviconUrl    String?      @map("favicon_url")
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")

  owner         User         @relation(fields: [ownerUserId], references: [id])
  plan          SubscriptionPlan? @relation(fields: [planId], references: [id])
  storeSettings StoreSettings?
  products      Product[]
  categories    Category[]
  events        Event[]
  bookings      Booking[]
  customers     Customer[]

  @@map("tenants")
}

model StoreSettings {
  id                  String   @id @default(uuid())
  tenantId            String   @unique @map("tenant_id")
  primaryColor        String   @default("#6366F1") @map("primary_color")
  secondaryColor      String?  @map("secondary_color")
  tagline             String?
  about               String?
  phone               String?
  whatsapp            String?
  email               String?
  address             String?
  facebookUrl         String?  @map("facebook_url")
  instagramUrl        String?  @map("instagram_url")
  tiktokUrl           String?  @map("tiktok_url")
  youtubeUrl          String?  @map("youtube_url")
  defaultLanguage     String   @default("en") @map("default_language")
  timezone            String   @default("UTC")
  country             String   @default("BD")
  currencyCode        String   @default("BDT") @map("currency_code")
  currencySymbol      String   @default("৳") @map("currency_symbol")
  currencyPosition    String   @default("before") @map("currency_position")
  numberFormat        String   @default("south_asian") @map("number_format")
  dateFormat          String   @default("DD/MM/YYYY") @map("date_format")
  timeFormat          String   @default("12h") @map("time_format")
  weekStart           String   @default("saturday") @map("week_start")
  smsEnabled          Boolean  @default(true) @map("sms_enabled")
  bkashNumber         String?  @map("bkash_number")
  nagadNumber         String?  @map("nagad_number")
  sslcommerzStoreId   String?  @map("sslcommerz_store_id")
  sslcommerzStorePass String?  @map("sslcommerz_store_pass")
  sslcommerzSandbox   Boolean  @default(true) @map("sslcommerz_sandbox")
  defaultCourier      String?  @map("default_courier")
  courierApiKey       String?  @map("courier_api_key")
  courierSecretKey    String?  @map("courier_secret_key")
  pickupAddress       String?  @map("pickup_address")
  maxConcurrentSessions Int    @default(5) @map("max_concurrent_sessions")
  bufferDays          Int      @default(0) @map("buffer_days")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  tenant              Tenant   @relation(fields: [tenantId], references: [id])

  @@map("store_settings")
}
```
