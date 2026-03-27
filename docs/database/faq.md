# Database Schema: `product_faqs`

## Table: `product_faqs`

Per-product FAQ entries displayed in accordion style on the product detail page.

### Columns

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | UUID | No | `gen_random_uuid()` | Primary key |
| `tenant_id` | UUID | No | — | FK → `tenants.id` |
| `product_id` | UUID | No | — | FK → `products.id` |
| `question` | VARCHAR(300) | No | — | Question text |
| `answer` | VARCHAR(1000) | No | — | Answer text |
| `sequence` | INT | No | `0` | Display order |
| `created_at` | TIMESTAMP | No | `NOW()` | — |
| `updated_at` | TIMESTAMP | No | `NOW()` | — |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `product_faqs_product_id_idx` | `product_id` | INDEX |
| `product_faqs_tenant_id_idx` | `tenant_id` | INDEX |

---

## Prisma Model

```prisma
model ProductFaq {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenant_id")
  productId String   @map("product_id")
  question  String
  answer    String
  sequence  Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@index([tenantId])
  @@map("product_faqs")
}
```
