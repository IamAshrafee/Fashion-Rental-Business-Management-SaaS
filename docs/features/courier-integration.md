# Feature Spec: Courier Integration

## Overview

Courier integration automates parcel creation and tracking for product delivery and return. Designed with an abstraction layer so multiple courier providers can be supported without changing core order logic.

---

## Supported Couriers (Bangladesh)

| Courier | Priority | API Status |
|---|---|---|
| Pathao | Primary | Well-documented API |
| Steadfast | Secondary | API available |
| RedX | Future | API available |
| eCourier | Future | API available |
| Paperfly | Future | API available |

---

## Architecture

```
Order Management → Courier Service → Provider Adapter → Courier API
                                           │
                                     ┌─────┴──────┐
                                     │   Pathao    │
                                     │ Steadfast   │
                                     │   RedX      │
                                     └─────────────┘
```

### Courier Service Interface

```typescript
interface CourierProvider {
  createParcel(params: CreateParcelParams): Promise<ParcelResult>;
  trackParcel(trackingId: string): Promise<TrackingResult>;
  cancelParcel(trackingId: string): Promise<CancelResult>;
  calculateShipping(params: ShippingCalcParams): Promise<ShippingRate>;
}
```

---

## Core Features

### Create Parcel

When owner marks order as "Shipped":

1. Owner selects courier provider (or default is pre-selected)
2. System sends parcel creation request:
   - Pickup address: Tenant's business address
   - Delivery address: Customer's address from order
   - Package details: Weight (estimated), item description
   - COD amount: If cash on delivery
3. Courier returns: Tracking ID, estimated delivery date
4. Tracking ID stored in order record
5. SMS sent to customer with tracking link

### Track Delivery

- Tracking info embedded in order detail page
- Owner can see: current status, location, estimated delivery
- Customer receives tracking link via SMS
- Tracking status auto-synced via courier API polling or webhook

### Calculate Shipping

Before checkout completion:
- If shipping is area-based, query courier API for rate
- Based on: pickup district → delivery district
- Return estimated shipping cost to display at checkout

---

## Owner Portal — Courier Settings

```
🚚 Courier Settings

Default Courier: [Pathao ▾]

Pathao:
  API Key: [____________]
  Secret Key: [____________]
  Default Pickup Address: [Dhanmondi, Dhaka]
  ✅ Enabled

Steadfast:
  API Key: [____________]
  Secret Key: [____________]
  ☐ Enabled
```

---

## Shipping in Order Flow

### Option A: Owner Creates Parcel from Dashboard

1. Order confirmed → Owner clicks "Ship Order"
2. Select courier
3. Confirm pickup/delivery addresses
4. System creates parcel via courier API
5. Tracking number auto-saved
6. Order status → Shipped

### Option B: Manual Shipping (No API)

For businesses that handle delivery themselves:
1. Owner clicks "Mark as Shipped"
2. Optionally enters tracking number manually
3. No courier API call made
4. Order status → Shipped

---

## Business Rules Summary

1. Courier integration is optional — manual shipping always available
2. Provider adapter pattern for easy addition of new couriers
3. Each tenant configures their own courier credentials
4. Parcel creation triggered when owner ships an order
5. Tracking ID stored per order
6. Shipping cost can be calculated via courier API or set manually
7. SMS tracking link sent to customer on shipping
