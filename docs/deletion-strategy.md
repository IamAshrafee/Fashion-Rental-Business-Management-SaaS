# Deletion Strategy

## Principles

1. **Active booking protection** — entities linked to active bookings CANNOT be deleted (even soft)
2. **Soft delete first** — deleted items go to trash, restorable
3. **Reference integrity** — check all foreign key relationships before allowing deletion
4. **Historical preservation** — completed booking data must survive entity deletion

---

## Entity Deletion Rules

### Products

```
[Owner clicks "Delete Product"]
       │
       ▼
[Check active bookings]
       │
       ├── Has bookings with status IN (pending, confirmed, shipped, delivered, overdue)?
       │   ├── YES → ❌ Block deletion
       │   │   └── "Cannot delete: this product has X active booking(s)"
       │   │
       │   └── NO → ✅ Allow soft delete
       │       └── set deleted_at = NOW()
       │       └── Product hidden from storefront
       │       └── Product hidden from "Add to Cart"
       │       └── Product visible in booking history (past bookings)
       │       └── Available in "Trash" for restore
       │
       ▼
[Trash — restorable]
       │
       ├── Owner can restore from trash → deleted_at = NULL
       └── Permanent delete only via empty trash (future feature)
```

**Linked entities on soft delete:**
- Product variants → also soft deleted (cascade)
- Product images → kept in MinIO (needed for booking history)
- Product pricing, size, services, FAQs, details → also soft deleted (cascade)
- Date blocks → keep existing, no new ones created

### Product Variants

Cannot be deleted independently if:
- The variant has active bookings
- It's the last variant of the product

Can be soft deleted if no active bookings reference it.

### Categories

```
[Owner clicks "Delete Category"]
       │
       ├── Has products using this category?
       │   ├── YES → ❌ Block deletion
       │   │   └── "Cannot delete: X product(s) use this category. Reassign them first."
       │   │
       │   └── NO → ✅ Hard delete (no need for trash)
```

### Customers

```
[Owner clicks "Delete Customer"]
       │
       ├── Has active bookings?
       │   ├── YES → ❌ Block deletion
       │   │   └── "Cannot delete: customer has active booking(s)"
       │   │
       │   └── NO → ✅ Soft delete
       │       └── Customer hidden from customer list
       │       └── Customer data preserved in booking history
       │       └── If same phone books again → new customer record created
```

### Staff / Users

```
[Owner clicks "Remove Staff"]
       │
       ├── Soft delete the tenant_users record
       ├── Revoke access immediately (invalidate tokens)
       ├── User record remains (they might be on another tenant)
       └── Audit log entries preserved
```

### Tenants (SaaS Admin)

```
[Admin suspends/deletes tenant]
       │
       ├── Suspend → store goes offline, data preserved
       ├── Soft delete → same as suspend + hidden from admin lists
       └── Hard delete → only after data export + 90 day retention
```

---

## Database Implementation

Add to all soft-deletable tables:

```prisma
model Product {
  // ... existing fields
  deletedAt DateTime?  @map("deleted_at")
}
```

### Query Scoping

All queries must exclude soft-deleted records by default:

```typescript
// Prisma middleware or extension
prisma.$extends({
  query: {
    product: {
      async findMany({ args, query }) {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
    },
  },
});

// Explicit trash query
const trashedProducts = await prisma.product.findMany({
  where: { tenantId, deletedAt: { not: null } },
});
```

---

## Trash UI (Owner Portal)

```
Settings → Trash
├── Products (3 items)
│   ├── Royal Banarasi Saree — deleted 2 days ago [Restore] [Delete Forever]
│   ├── Evening Gown — deleted 5 days ago [Restore] [Delete Forever]
│   └── ...
├── Customers (1 item)
│   └── ...
└── [Empty All Trash]
```

---

## Edge Cases

| Scenario | Handling |
|---|---|
| Restore a product whose category was deleted | Product restored with category set to null. Owner must reassign. |
| Soft-deleted product appears in search | Excluded from search index on soft delete. Re-indexed on restore. |
| Booking created for a product during soft-delete race condition | Booking creation checks `deletedAt IS NULL` in the query |
| Product with 0 active but 500 historical bookings | Soft delete works — historical bookings still reference it via ID |
