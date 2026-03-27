# UI Spec: Staff Management

## Overview

Manage staff accounts and their permissions.

**Route**: `/dashboard/staff`

---

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Staff Members (3)                            [+ Add Staff]       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ 👤 Hana Rahman              Owner         You              │  │
│ │    hana@boutique.com · 01712345678       ● Active          │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ 👤 Rashid Ahmed             Manager                        │  │
│ │    rashid@email.com · 01812345678        ● Active          │  │
│ │    [Edit] [Deactivate] [Reset Password] [Remove]           │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ 👤 Ayesha Khan              Staff                          │  │
│ │    01912345678               ○ Inactive                    │  │
│ │    [Edit] [Activate] [Reset Password] [Remove]             │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Add Staff Modal

```
Add Staff Member
────────────────
Full Name *     [                              ]
Phone *         [                              ]
Email           [                              ]
Role *          [Manager ▾]
Password *      [                              ] [Generate]

Role Permissions:
Manager — Full access except billing & staff management
Staff — Orders, products (view), customers, internal prices

[Cancel]  [Add Staff Member]
```

---

## Edit Staff Modal

```
Edit Staff Member
─────────────────
Full Name       [Rashid Ahmed                   ]
Phone           [01812345678                     ]
Email           [rashid@email.com                ]
Role            [Manager ▾]

[Cancel]  [Save Changes]
```

---

## Activity Log (per staff member)

Accessible via "View Activity" link:

```
Rashid Ahmed — Recent Activity
──────────────────────────────
Apr 15, 11:00  —  Confirmed booking #ORD-0045
Apr 15, 09:30  —  Marked #ORD-0042 as shipped
Apr 14, 16:00  —  Recorded payment ৳8,500 for #ORD-0040
Apr 14, 10:00  —  Updated product "Evening Gown" price
```
