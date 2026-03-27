# Security: Input Validation

## Strategy

Validate everything at the API boundary using DTOs + class-validator. Never trust client input.

---

## Validation Pipeline (NestJS)

```
Request Body
    │
    ▼
ValidationPipe (global)
    │
    ├── Transform: plainToInstance(DTO, body)
    ├── Validate: class-validator decorators
    ├── Whitelist: strip unknown properties
    │
    ├── Valid? → Continue to controller
    └── Invalid? → 400 VALIDATION_ERROR with field-level errors
```

### Global Setup

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,          // Strip unknown properties
  forbidNonWhitelisted: true, // Error on unknown properties
  transform: true,          // Auto-transform types
  transformOptions: { enableImplicitConversion: true }
}));
```

---

## Validation Rules by Entity

### Phone Number (Tenant-Configurable)

```typescript
// Validation pattern determined by tenant's country setting
const PHONE_PATTERNS: Record<string, RegExp> = {
  BD: /^01[3-9]\d{8}$/,           // Bangladesh: 11 digits
  TH: /^0[689]\d{7,8}$/,          // Thailand: 9-10 digits
  US: /^\d{10}$/,                  // USA: 10 digits
  DEFAULT: /^\+?\d{7,15}$/,        // International fallback
};

@Matches(tenantPhonePattern, { message: 'Invalid phone number for this region' })
phone: string;
```

### Price / Currency (Integer)

```typescript
@IsInt()
@Min(0)
@Max(99999999)
amount: number;
// All amounts stored as integers — no decimals (ADR-04)
// Rounding: always round UP (Math.ceil)
```

### Slug

```typescript
@Matches(/^[a-z0-9-]+$/)
@MaxLength(120)
slug: string;
```

### Date Range

```typescript
@IsDateString()
startDate: string;

@IsDateString()
@IsAfterDate('startDate') // Custom validator
endDate: string;
```

### Rich Text / HTML

```typescript
// Sanitize HTML to prevent XSS
import DOMPurify from 'isomorphic-dompurify';

const clean = DOMPurify.sanitize(rawHtml, {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h3', 'h4'],
  ALLOWED_ATTR: []
});
```

---

## SQL Injection Prevention

- **Prisma ORM** parameterizes all queries by default
- No raw SQL queries permitted (enforced via ESLint rule)
- If raw query ever needed: `prisma.$queryRaw` with tagged template literals

---

## XSS Prevention

| Source | Protection |
|---|---|
| Product descriptions | HTML sanitization (DOMPurify) on save |
| Customer notes | Plain text only, HTML-escaped on render |
| Search queries | URL-encoded, never rendered as HTML |
| Filenames | Sanitized, UUID-renamed on upload |

---

## CSRF Prevention

- API is stateless (JWT), no cookies for auth → CSRF not applicable for API
- SSLCommerz redirect forms use unique session tokens

---

## Rate Limiting Implementation

```typescript
// NestJS Throttler
@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 3 },   // 3 req/sec
      { name: 'medium', ttl: 60000, limit: 60 }, // 60 req/min
      { name: 'long', ttl: 3600000, limit: 500 } // 500 req/hour
    ])
  ]
})
```

Specific limits per endpoint category (see [API overview](../api/_overview.md)).
