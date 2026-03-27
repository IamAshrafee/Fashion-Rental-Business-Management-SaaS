# Integration: Steadfast Courier

## Overview

Steadfast is a Bangladeshi courier service. Same adapter pattern as Pathao.

---

## API Integration

### Authentication

```
API Key + Secret Key in headers:
Api-Key: {api_key}
Secret-Key: {secret_key}
```

### Create Parcel

```
POST https://portal.packzy.com/api/v1/create_order
{
  "invoice": "ORD-2026-0045",
  "recipient_name": "Fatima Rahman",
  "recipient_phone": "01712345678",
  "recipient_address": "House 12, Road 5, Block C, Dhanmondi, Dhaka",
  "cod_amount": 22700,
  "note": "Handle with care - rental dress"
}
→ { consignment_id, tracking_code, status }
```

### Track Parcel

```
GET https://portal.packzy.com/api/v1/status_by_cid/{consignment_id}
→ { delivery_status, updated_at }
```

---

## Status Mapping

| Steadfast Status | System Action |
|---|---|
| `in_review` | Booking stays "Confirmed" |
| `in_transit` | — |
| `delivered` | Auto-update → "Delivered" |
| `partial_delivered` | Alert owner |
| `cancelled` | Alert owner |
| `hold` | Alert owner |

---

## Configuration (Per-Tenant)

```json
{
  "courier": {
    "steadfast": {
      "enabled": true,
      "apiKey": "...",
      "secretKey": "..."
    }
  }
}
```

---

## Adapter Implementation

```typescript
class SteadfastAdapter implements CourierProvider {
  async createParcel(order: OrderData): Promise<ParcelResult> { ... }
  async trackParcel(trackingId: string): Promise<TrackingResult> { ... }
  async cancelParcel(trackingId: string): Promise<void> { ... }
}
```
