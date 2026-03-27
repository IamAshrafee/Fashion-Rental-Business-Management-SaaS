# Integration: Pathao Courier

## Overview

Pathao is Bangladesh's leading delivery service. Integration enables creating parcels and tracking deliveries directly from the dashboard.

---

## API Integration

### Authentication

```
POST https://hermes-api.pathao.com/aladdin/api/v1/issue-token
{
  "client_id": "...",
  "client_secret": "...",
  "username": "...",
  "password": "...",
  "grant_type": "password"
}
→ { access_token, refresh_token, expires_in }
```

### Create Parcel

```
POST https://hermes-api.pathao.com/aladdin/api/v1/orders
Authorization: Bearer {access_token}
{
  "store_id": 12345,
  "merchant_order_id": "ORD-2026-0045",
  "recipient_name": "Fatima Rahman",
  "recipient_phone": "01712345678",
  "recipient_address": "House 12, Road 5, Block C, Dhanmondi",
  "recipient_city": 1,
  "recipient_zone": 1,
  "delivery_type": 48,
  "item_type": 2,
  "item_quantity": 1,
  "item_weight": 1,
  "amount_to_collect": 22700,
  "special_instruction": "Handle with care - rental dress"
}
→ { consignment_id, order_status, delivery_fee }
```

### Track Parcel

```
GET https://hermes-api.pathao.com/aladdin/api/v1/orders/{consignment_id}
→ { order_status, updated_at }
```

---

## Status Mapping

| Pathao Status | System Action |
|---|---|
| `Pickup Pending` | Booking stays "Confirmed" |
| `Picked Up` | — |
| `In Transit` | — |
| `Delivered` | Auto-update booking → "Delivered" |
| `Returned` | Alert owner, no auto-update |

---

## Configuration (Per-Tenant)

```json
{
  "courier": {
    "pathao": {
      "enabled": true,
      "clientId": "...",
      "clientSecret": "...",
      "username": "...",
      "password": "...",
      "defaultStoreId": 12345
    }
  }
}
```

---

## Adapter Implementation

```typescript
class PathaoAdapter implements CourierProvider {
  async createParcel(order: OrderData): Promise<ParcelResult> { ... }
  async trackParcel(trackingId: string): Promise<TrackingResult> { ... }
  async cancelParcel(trackingId: string): Promise<void> { ... }
  async getCities(): Promise<City[]> { ... }
  async getZones(cityId: number): Promise<Zone[]> { ... }
}
```
