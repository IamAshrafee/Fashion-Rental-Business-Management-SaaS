# Integrations — Overview

## Architecture Pattern

All third-party integrations follow the **Provider Adapter Pattern** — an abstraction layer that allows swapping implementations without changing business logic.

```
Business Logic (Services)
       │
       ▼
Provider Interface (Abstract)
       │
       ├── bKashProvider
       ├── NagadProvider
       ├── SSLCommerzProvider
       ├── PathaoProvider
       ├── SteadfastProvider
       ├── SMSProvider
       └── CloudflareProvider
```

---

## Integration Categories

### Payments

| Provider | Type | Usage |
|---|---|---|
| [bKash](./bkash.md) | Manual transfer | Customer sends to owner's bKash |
| [Nagad](./nagad.md) | Manual transfer | Customer sends to owner's Nagad |
| [SSLCommerz](./sslcommerz.md) | Payment gateway | Online card/mobile banking |

### Courier / Delivery

| Provider | Type | Usage |
|---|---|---|
| [Pathao](./pathao.md) | API integration | Create parcels, track deliveries |
| [Steadfast](./steadfast.md) | API integration | Create parcels, track deliveries |

### Communication

| Provider | Type | Usage |
|---|---|---|
| [SMS Provider](./sms-provider.md) | API integration | OTP, notifications, reminders |

### Infrastructure

| Provider | Type | Usage |
|---|---|---|
| [Cloudflare](./cloudflare.md) | DNS + CDN | Custom domains, SSL, caching |

---

## Configuration Pattern

Each integration is configured per-tenant via `store_settings`:

```typescript
interface ProviderConfig {
  enabled: boolean;
  credentials: Record<string, string>;
  settings: Record<string, any>;
}
```

---

## Error Handling

All provider calls follow:

```typescript
try {
  const result = await provider.execute(payload);
  return { success: true, data: result };
} catch (error) {
  logger.error(`Provider ${name} failed`, { error, payload });
  // Never expose provider errors to end user
  throw new ServiceUnavailableException('Service temporarily unavailable');
}
```

---

## Testing Strategy

- **Unit tests**: Mock provider responses
- **Integration tests**: Use sandbox/test environments
- **No live API calls in CI/CD**: All external calls mocked
