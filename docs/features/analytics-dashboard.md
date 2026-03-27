# Feature Spec: Analytics Dashboard

## Overview

The analytics dashboard gives business owners visibility into their store's performance. It answers: "How is my business doing?" with clear metrics, trends, and actionable insights.

---

## Dashboard Home (Owner Portal Landing Page)

### Quick Stats Row

The first thing the owner sees on login:

```
Today's Snapshot
──────────────────────────────────────────────
📋 New Bookings     💰 Revenue Today     📦 Active Rentals     ⚠️ Overdue
      3                ৳22,500                 12                    1
     (+2 vs yesterday)  (+15%)
```

### Recent Activity Feed

```
Recent Activity
──────────────────
📋 New booking from Fatima Rahman — ৳13,000          5 min ago
✅ Order #ORD-0042 marked as Completed                 1 hour ago
↩️ Return received for Evening Gown                    2 hours ago
📦 Shipped Royal Saree to Anika Hasan                  3 hours ago
```

---

## Analytics Sections

### Revenue Analytics

| Metric | Description |
|---|---|
| Total Revenue | Sum of all completed order amounts (excl. deposits) |
| Revenue by Period | Daily / Weekly / Monthly chart |
| Revenue Trend | Month-over-month growth percentage |
| Average Order Value | Total revenue ÷ total completed orders |
| Revenue by Category | Which product categories earn most |

**Chart**: Line chart showing revenue over time (default: last 30 days).

### Booking Analytics

| Metric | Description |
|---|---|
| Total Bookings | Count of all bookings in period |
| Bookings by Status | Breakdown: completed, active, cancelled |
| Booking Trend | Daily/weekly booking count chart |
| Conversion Rate | Bookings placed ÷ product page views (future) |
| Cancellation Rate | Cancelled ÷ total bookings |

### Product Analytics

| Metric | Description |
|---|---|
| Most Booked Products | Top 10 products by booking count |
| Revenue per Product | Which products earn the most |
| Utilization Rate | Booked days ÷ available days per product |
| Least Booked Products | Products that need attention |
| Idle Products | Products with 0 bookings in last 30 days |

### Customer Analytics

| Metric | Description |
|---|---|
| Total Customers | Unique customers who have booked |
| New vs Returning | First-time vs repeat customers |
| Top Customers | Customers with most bookings or highest spend |
| Customer Retention Rate | Percentage of customers who book again |

### Target Recovery (Aggregated)

| Metric | Description |
|---|---|
| Total Investment | Sum of all purchase prices |
| Total Recovered | Sum of rental revenue from those products |
| Overall Recovery % | Recovered ÷ Investment |
| Products at Target | How many products have reached their rental target |
| Products Below Target | Products still recovering cost |

---

## Time Period Selection

All analytics support:
- Today
- Last 7 days
- Last 30 days
- This month
- Last month
- Custom date range

---

## Export

### CSV Export

Each analytics section has an "Export CSV" button:
- Revenue report
- Booking list (with details)
- Product performance
- Customer list

Format: Standard CSV compatible with Excel.

---

## Analytics API

```
GET /api/analytics/summary?from=2026-03-01&to=2026-03-31

Response:
{
  "revenue": {
    "total": 185000,
    "trend": "+12%",
    "averageOrderValue": 8500,
    "byCategory": [
      { "category": "Saree", "revenue": 85000 },
      { "category": "Lehenga", "revenue": 50000 }
    ]
  },
  "bookings": {
    "total": 22,
    "completed": 18,
    "active": 3,
    "cancelled": 1,
    "cancellationRate": "4.5%"
  },
  "customers": {
    "total": 45,
    "new": 12,
    "returning": 33
  },
  "products": {
    "totalActive": 85,
    "mostBooked": [...],
    "idle": 5
  }
}
```

---

## Business Rules Summary

1. Dashboard is the owner's landing page
2. Quick stats provide at-a-glance health check
3. All metrics are tenant-scoped
4. Time period selectable for all analytics
5. Revenue calculations exclude deposits (deposits are not revenue until forfeited)
6. Export available for all major reports
7. Analytics accessible to Owner and Manager roles only
