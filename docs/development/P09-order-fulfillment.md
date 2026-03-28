# P09 — Order Fulfillment & Logistics (Backend)

| | |
|---|---|
| **Phase** | 3 — Transaction Engine |
| **Estimated Time** | 3–4 hours |
| **Requires** | P07 (booking engine) |
| **Unlocks** | P14 |
| **Agent Skills** | `nestjs-best-practices`, `nestjs-expert` |

---

## REFERENCE DOCS

- `docs/features/order-management.md` — Order processing workflow
- `docs/features/courier-integration.md` — Courier adapter pattern
- `docs/integrations/pathao.md` — Pathao courier API
- `docs/integrations/steadfast.md` — Steadfast courier API
- `docs/flows/owner-fulfill-order-flow.md` — Fulfillment workflow

---

## SCOPE

### 1. Order Fulfillment Service

Processing a confirmed booking through delivery and return:

- **Prepare for shipment:** Assign courier, generate parcel
- **Mark shipped:** Record tracking number and courier provider
- **Track delivery:** Query courier API for status updates
- **Mark delivered:** Record delivery timestamp
- **Mark returned:** Record return timestamp
- **Inspection:** Record inspection result (links to P08 damage system)

### 2. Courier Integration (Adapter Pattern)

```typescript
interface CourierProvider {
  createParcel(data: CreateParcelDto): Promise<{ trackingId: string; ... }>;
  getTrackingStatus(trackingId: string): Promise<TrackingStatus>;
  calculateRate(data: RateCalcDto): Promise<{ cost: number }>;
  cancelParcel(trackingId: string): Promise<void>;
}

class PathaoCourier implements CourierProvider { ... }
class SteadfastCourier implements CourierProvider { ... }
class ManualCourier implements CourierProvider { ... } // No API, manual tracking
```

### 3. Tracking Webhook

- `POST /api/v1/webhooks/courier/:provider` — receive status updates from courier
- Auto-update booking status when courier reports delivery/return

### 4. Return Management

- Track expected return date
- Flag overdue returns (connects to P10 CRON job)
- Send return reminders (connects to P10 notification events)

---

## DELIVERABLES

| # | Deliverable | Verification |
|---|---|---|
| 1 | Courier adapter interface | Abstract provider pattern |
| 2 | Pathao integration | Create parcel, track, cancel |
| 3 | Steadfast integration | Create parcel, track |
| 4 | Manual courier option | Owner enters tracking manually |
| 5 | Tracking webhook | Auto status updates |
| 6 | Fulfillment API endpoints | Ship, deliver, return flow |

---

## OUTPUT CONTRACTS

| Contract | Used By |
|---|---|
| Courier service (create parcel, track) | P14 (Owner booking — ship action) |
| Tracking webhook endpoint | External courier services |
| Fulfillment status updates | P14 (Owner order management UI) |
