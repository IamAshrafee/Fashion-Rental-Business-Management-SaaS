# UI Spec: Booking Confirmation Page

## Overview

Shown after successful booking placement. Confirms the order and provides next steps.

**Route**: `/booking/confirmation?number=ORD-2026-0045`

---

## Layout

```
┌────────────────────────────────────────────┐
│                                            │
│         ✅                                 │
│         Booking Confirmed!                 │
│                                            │
│         Your booking #ORD-2026-0045        │
│         has been placed successfully.      │
│                                            │
├────────────────────────────────────────────┤
│                                            │
│  What happens next?                        │
│  ──────────────────                       │
│                                            │
│  1️⃣ We'll review your booking and          │
│     confirm it shortly.                    │
│                                            │
│  2️⃣ You'll receive an SMS at              │
│     01712345678 with updates.              │
│                                            │
│  3️⃣ Your order will be delivered by       │
│     [estimated date].                      │
│                                            │
├────────────────────────────────────────────┤
│                                            │
│  Order Summary                             │
│  ──────────────────                       │
│  Booking: #ORD-2026-0045                  │
│  Status: Pending Confirmation              │
│  Payment: Cash on Delivery                 │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ [Img] Royal Banarasi Saree          │  │
│  │       White · M                      │  │
│  │       Apr 15 → Apr 17 (3 days)       │  │
│  │       Rental: ৳7,500                │  │
│  │       Deposit: ৳5,000               │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Delivery To:                              │
│  Fatima Rahman                             │
│  House 12, Road 5, Block C                 │
│  Dhanmondi, Dhaka                          │
│  📞 01712345678                            │
│                                            │
│  Grand Total: ৳22,700                     │
│                                            │
├────────────────────────────────────────────┤
│                                            │
│  Need help? Contact us:                    │
│  📞 01712345678  💬 WhatsApp               │
│                                            │
│  [Continue Shopping]                       │
│                                            │
└────────────────────────────────────────────┘
```

---

## Animations

- ✅ Checkmark: Animate in with scale + fade (Lottie or CSS)
- Order details: Slide up with staggered delay

---

## Share / Save

- **Screenshot-friendly**: The confirmation card is styled to look good as a screenshot
- Future: "Share on WhatsApp" button to send booking details
