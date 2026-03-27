# API Design: Analytics Module

## Owner Endpoints

---

### GET `/api/v1/owner/analytics/summary`

Full analytics summary for the dashboard.

**Auth**: Bearer token — Owner, Manager

**Query Params**:
| Param | Type | Default | Description |
|---|---|---|---|
| `from` | date | 30 days ago | Period start |
| `to` | date | today | Period end |

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "revenue": {
      "total": 185000,
      "previousPeriod": 165000,
      "growthPercentage": 12.1,
      "averageOrderValue": 8500
    },
    "bookings": {
      "total": 22,
      "completed": 18,
      "active": 3,
      "cancelled": 1,
      "cancellationRate": 4.5
    },
    "customers": {
      "total": 45,
      "new": 12,
      "returning": 33,
      "retentionRate": 73.3
    },
    "products": {
      "totalActive": 85,
      "idle": 5,
      "averageUtilization": 34.2
    }
  }
}
```

---

### GET `/api/v1/owner/analytics/revenue`

Revenue time series chart data.

**Auth**: Bearer token — Owner, Manager

**Query Params**: `from`, `to`, `groupBy` (`day`, `week`, `month`)

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "series": [
      { "date": "2026-03-01", "revenue": 12500 },
      { "date": "2026-03-02", "revenue": 8000 },
      { "date": "2026-03-03", "revenue": 0 }
    ],
    "total": 185000
  }
}
```

---

### GET `/api/v1/owner/analytics/revenue-by-category`

Revenue breakdown by category.

**Auth**: Bearer token — Owner, Manager

**Response** `200`:
```json
{
  "success": true,
  "data": [
    { "category": "Saree", "revenue": 85000, "percentage": 45.9 },
    { "category": "Lehenga", "revenue": 50000, "percentage": 27.0 },
    { "category": "Sherwani", "revenue": 30000, "percentage": 16.2 },
    { "category": "Gown", "revenue": 20000, "percentage": 10.8 }
  ]
}
```

---

### GET `/api/v1/owner/analytics/top-products`

Most booked and highest revenue products.

**Auth**: Bearer token — Owner, Manager

**Query Params**: `sortBy` (`bookings` or `revenue`), `limit` (default 10)

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "productId": "...",
      "name": "Royal Banarasi Saree",
      "totalBookings": 12,
      "totalRevenue": 90000,
      "utilizationRate": 45.2,
      "thumbnailUrl": "..."
    }
  ]
}
```

---

### GET `/api/v1/owner/analytics/target-recovery`

Cost recovery tracking.

**Auth**: Bearer token — Owner, Manager

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "totalInvestment": 450000,
    "totalRecovered": 185000,
    "overallRecoveryPercentage": 41.1,
    "productsAtTarget": 8,
    "productsBelowTarget": 77,
    "products": [
      {
        "productId": "...",
        "name": "Royal Banarasi Saree",
        "purchasePrice": 15000,
        "recovered": 90000,
        "recoveryPercentage": 600,
        "status": "exceeded"
      }
    ]
  }
}
```

---

### GET `/api/v1/owner/analytics/export/:type`

Export analytics data as CSV.

**Auth**: Bearer token — Owner, Manager

**Path Params**: `type` = `revenue` | `bookings` | `products` | `customers`

**Query Params**: `from`, `to`

**Response**: CSV file download

```
Content-Type: text/csv
Content-Disposition: attachment; filename="revenue-2026-03.csv"
```
