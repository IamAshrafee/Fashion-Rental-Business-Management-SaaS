# UI Spec: Store Settings

## Overview

Central settings page. Organized in tabs for different configuration areas.

**Route**: `/dashboard/settings`

---

## Layout

```
┌────────────────────────────────────────────────────────────────┐
│ Store Settings                                                  │
├────────────────────────────────────────────────────────────────┤
│ [Branding] [Business Info] [Social] [Payments] [Courier]       │
│ [Notifications] [Domain] [Subscription]                        │
├────────────────────────────────────────────────────────────────┤
```

---

## Tab: Branding

```
Logo                    [Upload]  [Preview: logo.png]
Favicon                 [Upload]  [Preview: fav.ico]

Primary Color           [■ #E91E63] [Color Picker]
Secondary Color         [■ #9C27B0] [Color Picker]

Banner Images
[Banner 1 ✕] [Banner 2 ✕] [+ Upload Banner]
Drag to reorder

[Save Changes]  [Preview Store →]
```

---

## Tab: Business Info

```
Business Name *         [Hana's Boutique                    ]
Tagline                 [Premium Wedding Dress Rentals      ]
Phone *                 [01712345678                         ]
Email                   [hana@boutique.com                   ]
Address                 [Dhanmondi, Dhaka                    ]
WhatsApp                [01712345678                         ]

About (Rich Text)
[Rich text editor with the about section content]

[Save Changes]
```

---

## Tab: Social Links

```
Facebook    [https://facebook.com/hanasboutique    ]
Instagram   [https://instagram.com/hanasboutique   ]
TikTok      [https://tiktok.com/@hanasboutique     ]
YouTube     [                                       ]

[Save Changes]
```

---

## Tab: Payments

```
Accepted Methods
  ✅ Cash on Delivery
  ✅ bKash (manual)
  ☐ Nagad (manual)
  ☐ Online Payment (SSLCommerz)

bKash Number:    [01712345678          ]
Nagad Number:    [                     ]

SSLCommerz (if enabled)
  Store ID:      [store_xxx            ]
  Password:      [••••••••             ]
  Mode: ○ Sandbox  ● Live
  [Test Connection]

[Save Changes]
```

---

## Tab: Courier

```
Default Courier:  [Pathao ▾]

Pathao
  API Key:     [api_xxx               ]
  Secret:      [••••••••              ]
  ✅ Enabled   [Test Connection]

Steadfast
  API Key:     [                      ]
  ☐ Enabled

Pickup Address:  [Dhanmondi, Dhaka    ]

[Save Changes]
```

---

## Tab: Notifications

```
SMS Notifications

Customer:
  ✅ Booking confirmation
  ✅ Shipping update
  ✅ Return reminder
  ✅ Completion notice

Owner:
  ✅ New booking alert
  ✅ Overdue alert

[Save Changes]
```

---

## Tab: Domain

```
🌐 Custom Domain

Current: hanasboutique.closetrent.com.bd

Custom Domain: [rentbyhana.com          ]
Status: ✅ Active · SSL Valid

[Remove Custom Domain]

── Or set up a new domain ──

[Set Up Custom Domain →]
```

---

## Tab: Subscription

```
Current Plan: Pro (৳2,499/month)
Next Billing: May 1, 2026

Features Included:
  ✅ Unlimited products
  ✅ Custom domain
  ✅ 10 staff members
  ✅ Full analytics
  ✅ SMS notifications
  ✅ "Powered by" removed

[Change Plan] [View Billing History]
```
