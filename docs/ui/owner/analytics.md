# UI Spec: Analytics Page

## Overview

Business performance dashboard with charts and exportable data.

**Route**: `/dashboard/analytics`

---

## Layout

```
┌────────────────────────────────────────────────────────────────┐
│ Analytics                    [Today ▾] [Last 7d] [30d] [Custom]│
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Summary Cards                                                 │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│ │ Revenue │ │ Orders  │ │ Avg Val │ │Customers│              │
│ │ ৳185K   │ │   22    │ │ ৳8,500  │ │  45     │              │
│ │ ↑ 12%   │ │ ↑ 3     │ │ ↑ 5%    │ │ 12 new  │              │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘              │
│                                                                │
│  Revenue Trend                                      [Export]   │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │                                                          │   │
│ │  ৳15K ─              ╱╲                                  │   │
│ │  ৳10K ─    ╱╲      ╱    ╲    ╱╲                          │   │
│ │   ৳5K ─  ╱    ╲  ╱        ╲╱    ╲                        │   │
│ │     ৳0 ─╱──────╲╱────────────────╲─────                  │   │
│ │        Mar 1    Mar 8    Mar 15   Mar 22   Mar 29         │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                │
│ ┌───────────────────────────┐ ┌────────────────────────────┐   │
│ │ Revenue by Category       │ │ Top Products               │   │
│ │ ┌───────────────────┐     │ │                            │   │
│ │ │   [Donut Chart]   │     │ │ 1. Royal Saree  ৳90K  12x │   │
│ │ │ Saree     46%     │     │ │ 2. Evening Gown ৳40K   8x │   │
│ │ │ Lehenga   27%     │     │ │ 3. Bridal Set   ৳35K   5x │   │
│ │ │ Sherwani  16%     │     │ │ 4. Sherwani     ৳20K   4x │   │
│ │ │ Gown      11%     │     │ │ 5. Casual Saree ৳15K   6x │   │
│ │ └───────────────────┘     │ │                            │   │
│ └───────────────────────────┘ └────────────────────────────┘   │
│                                                                │
│  Physical-item Cost Recovery                        [Export]   │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ Total Investment: ৳450,000                               │   │
│ │ Total Recovered:  ৳185,000 (41.1%)                       │   │
│ │ [============░░░░░░░░░░░░░░░░░░░░░] 41%                  │   │
│ │                                                          │   │
│ │ 8 products at target │ 77 products recovering            │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                │
│  Customer Insights                                             │
│ ┌─────────────────────────────┐                               │
│ │ New: 12 │ Returning: 33     │                               │
│ │ Retention: 73.3%            │                               │
│ │ Top: Fatima (5 orders)      │                               │
│ └─────────────────────────────┘                               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Chart Library

Use **Chart.js** or **Recharts** (if React) for:

- Line chart: Revenue trend
- Donut chart: Revenue by category
- Bar chart: Bookings per status (future)

---

## Time Period Selector

| Option       | Range                   |
| ------------ | ----------------------- |
| Today        | Current day             |
| Last 7 days  | Past week               |
| Last 30 days | Past month (default)    |
| This month   | Calendar month          |
| Last month   | Previous calendar month |
| Custom       | Date range picker       |

---

## Export

Each section has an "Export" button → downloads CSV file.
