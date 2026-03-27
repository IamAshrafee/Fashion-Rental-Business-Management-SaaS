# Database Schema: `orders` — Decision Note

## No Separate `orders` Table

In the original documentation structure, both `booking.md` and `order.md` were planned. After designing the feature specs, we established that **"Booking" and "Order" are the same entity at different lifecycle stages** (see [booking-system.md](../features/booking-system.md)).

Therefore:

- The `bookings` table (see [booking.md](./booking.md)) serves as the unified entity for both bookings and orders
- Status progression (`pending` → `confirmed` → `shipped` → ... → `completed`) represents the transition from "booking" to "order"
- No separate `orders` table is needed

Similarly, the originally planned `cart.md` database schema is not needed because the cart is stored in **browser localStorage** on the client side (see [cart-system.md](../features/cart-system.md)).

---

## Summary of Consolidated Decisions

| Planned File | Decision | Reason |
|---|---|---|
| `order.md` | **Merged into `booking.md`** | Booking and Order are the same entity |
| `cart.md` | **Not needed** | Cart is client-side localStorage |
