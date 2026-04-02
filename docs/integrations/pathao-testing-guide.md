# Pathao Courier Integration: End-to-End Testing Guide

This document outlines the detailed, end-to-end user flow for testing the Pathao Courier API integration within the Fashion Rental SaaS application. It is based strictly on the current codebase implementation (`PathaoAdapter`, `FulfillmentService`, and the Frontend interfaces).

---

## Prerequisites & Sandbox Credentials

To test Pathao functionality without creating real delivery orders, you must use their sandbox environment credentials.

**Sandbox Environment URL:** `https://courier-api-sandbox.pathao.com/aladdin/api/v1`

| Credential Type      | Value                                      | Database / Form Field     |
| :------------------- | :----------------------------------------- | :------------------------ |
| **Client ID**        | `7N1aMJQbWm`                               | `pathaoClientId`          |
| **Client Secret**    | `wRcaibZkUdSNz2EI9ZyuXLlNrnAv0TdPUPXMnD39` | `pathaoClientSecret`      |
| **Username (Email)**| `test@pathao.com`                          | `pathaoUsername`          |
| **Password**         | `lovePathao`                               | `pathaoPassword`          |
| **Store ID**         | *(e.g. `150139` or fetch dynamically)*     | `pathaoStoreId`           |

---

## Phase 1: Application Setup (Tenant Configuration)

Before the system can interact with Pathao, the tenant must store their integration settings.

### Step 1: Navigating to Delivery Settings
1. Launch the Next.js frontend and log in as a **Store Owner (Tenant)**.
2. In the left-hand sidebar, navigate to **Settings → Delivery & Couriers** (`/dashboard/settings/delivery`).

### Step 2: Configuring Pathao Credentials
1. In the "Default Courier Partner" dropdown, ensure **Pathao Delivery** is selected.
2. Enter the Sandbox credentials provided above into the respective input fields (Client ID, Client Secret, Merchant Email, Merchant Password, and Store ID).
3. Toggle the **Sandbox / Test Mode** switch to `ON` (`pathaoSandbox = true`).
4. Click **Save Courier Settings**.
5. **Backend Verification:** The values are persisted in the `TenantSettings` table. Moving forward, the `PathaoAdapter` will use these credentials and route requests to `PATHAO_SANDBOX_URL`.

---

## Phase 2: Order Fulfillment & Consignment Creation

When an order is confirmed, it needs to be shipped out via Pathao. Based on the business logic in `FulfillmentService.ts`, this can happen automatically via delayed jobs or manually.

### Option A: Manual Shipment Trigger
1. Navigate to **Bookings → Active Bookings** and locate a booking with the `confirmed` status.
2. Open the **Booking Details** and click the **Ship Order** button to open the "Ship Order Modal" (`ship-order-modal.tsx`).
3. Select **Pathao** as the Courier Provider. *(Notice the Tracking Number input disappears because the system creates the consignment automatically via `useApi = true`)*.
4. Click **Ship & Notify Customer**.
5. **Backend Execution:**
   - The `FulfillmentService.shipOrder` method verifies the Pathao configuration.
   - It issues a `POST /orders` via `PathaoAdapter.createParcel`, sending recipient details and the item weight. Pathao will auto-resolve the city and zone based on the `recipient_address` text.
   - A `consignment_id` (tracking ID) is returned.
   - The booking's `courierConsignmentId` is updated.
   - The initial `courierStatus` is set to `pickup_pending`.
   - The Booking state is transitioned from `confirmed` to `shipped`.

### Option B: Auto-Scheduled Pickup
1. The backend natively listens to the `booking.confirmed` event.
2. If Pathao is fully configured (with API credentials), the system automatically calculates the ideal pickup date based on the items' rental start date (`calculatePickupDate`).
3. A BullMQ delayed job (`fulfillment.schedulePickup`) requests the pickup at the exact needed time, calling `PathaoAdapter.createParcel` automatically.

---

## Phase 3: Real-Time Tracking & Synchronization

Once the consignment exists in Pathao, the SaaS platform automatically tracks delivery progress via polling.

### Step 1: Viewing Order Tracking UI
1. Navigate back to the booking details page. 
2. The courier and tracking number (e.g., `PTH-...`) will be displayed, and the delivery status will initially show **Pickup Pending**.

### Step 2: The Polling CRON Job
1. The backend runs a CRON job every 15 minutes (`pollAllCourierStatuses()`).
2. It queries all active shipments that do not have terminal statuses (`delivered`, `returned_to_sender`, or `cancelled`).
3. The job calls the `PathaoAdapter.getOrderInfo` utilizing Pathao's `GET /orders/{consignment_id}/info` endpoint.
4. The system compares the raw status from Pathao and maps it to our internal slugs (e.g., `pickup_assigned`, `at_hub`, `in_transit`, `out_for_delivery`).

### Step 3: Triggering Sub-State Transitions
If the polling detects a specific status change, the booking state machine reacts automatically:
- **`picked_up` detected:** Booking automatically transitions its core status to `shipped` (if not already handled manually).
- **`delivered` detected:** Booking automatically transitions to the `delivered` state. The rental is now officially active globally.
- **`returned_to_sender` detected:** The system emits a `fulfillment.courier.return_alert` event to warn the store owner.
- **`pickup_failed` state:** The backend injects a failure record into the CourierStatusHistory so the owner knows the physical pickup couldn't happen.

---

## Step 4: Tracking Dashboard Analysis

To view business-wide order logistics:
1. The backend provides a `getDeliveryDashboard` endpoint.
2. Owners can see grouped counts by Pathao/courier statuses (e.g., "5 In Transit, 2 Delivery Pending").
3. Ensure that after a manual test or auto-CRON trigger, these analytics numbers accurately reflect the Pathao Sandbox responses.

## Summary

This testing flow ensures every layer of the integration works properly:
1. **Frontend UI** correctly encrypts tracking payload config.
2. **Pathao Adapter** successfully negotiates API tokens via Password Grant.
3. **Consignment Creation** issues a real request omitting Pathao's complex City IDs for address-auto-resolution.
4. **CRON Polling** successfully manages the booking state transition through to Delivered.
