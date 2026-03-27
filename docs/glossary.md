# Glossary — ClosetRent SaaS

Consistent terminology across all documentation, code, and UI. If a term is used differently anywhere, this document is the source of truth.

---

## Business Terms

| Term | Definition |
|---|---|
| **Tenant** | A business owner/company using the SaaS platform. Each tenant has their own isolated store, data, and branding. |
| **Store** | The public-facing rental shop belonging to one tenant. Accessible via subdomain or custom domain. |
| **Product** | A single fashion item available for rent (e.g., a specific wedding saree). A product can have multiple variants. |
| **Variant** | A specific color/style version of a product. Each variant has its own images and color attributes. |
| **Main Color** | The single dominant color of a variant. Used for display and variant switching. |
| **Identical Colors** | Additional colors present in a variant (e.g., red embroidery on a white dress). Used for search matching — a white dress with red embroidery appears when users search "red". |
| **Category** | Top-level product classification (e.g., Saree, Sherwani, Gown, Shoes). |
| **Subcategory** | Second-level classification under a category (e.g., under Saree → Banarasi, Jamdani). |
| **Event** | An occasion a product is suitable for (e.g., Wedding, Holud, Reception, Birthday). Products can have multiple events. |
| **Booking** | A customer's reservation to rent one or more products for a specific date range. This is the primary transaction type. |
| **Order** | A confirmed booking that has been accepted by the business owner and is being processed. |
| **Rental Duration** | The number of days a product is rented for. Calculated from pickup/delivery date to return date. |
| **Rental Price** | The amount charged to the customer for renting a product for the specified duration. |
| **Security Deposit** | A refundable amount collected before rental to cover potential damage or loss. Returned after successful return. |
| **Cleaning Fee** | A non-refundable flat fee charged per rental to cover professional cleaning after return. |
| **Late Fee** | A per-day charge applied when a customer returns a product after the agreed return date. |
| **Extended Rental** | Additional per-day charges for keeping a product beyond the base rental duration (agreed upon in advance, unlike late fees). |
| **Try-Before-You-Rent** | An optional feature where the customer pays a fee to try on the product for 24 hours before committing to rent. The fee may be credited toward the final rental cost. |
| **Backup Size** | An optional add-on allowing the customer to receive a second size of the same product for a discounted price, to ensure fit. |
| **Target** | The number of rentals needed for a product to recover its purchase cost. Can be manually set or auto-calculated. |
| **Purchase Price** | The cost the business owner paid to acquire the product. Internal field, can be optionally made public. |

---

## System Terms

| Term | Definition |
|---|---|
| **Guest** | An end customer browsing or shopping in a store. Guests do not need accounts to browse or book. |
| **Business Owner** | The tenant who manages their store through the Business Owner Portal. |
| **Staff** | Additional users added by the business owner to help manage the store (e.g., salesperson). |
| **SaaS Admin** | Platform-level administrator who manages all tenants, billing, and platform settings. |
| **Guest Portal** | The customer-facing storefront — product browsing, cart, checkout, booking confirmation. |
| **Owner Portal** | The business management dashboard — inventory, orders, customers, analytics, settings. |
| **Admin Portal** | The platform management interface — tenant management, billing, support. |
| **Tenant ID** | The unique identifier for each business. Every database query is scoped by this to ensure data isolation. |
| **Storefront** | Synonym for Guest Portal — the public shopping interface of one tenant's store. |

---

## Technical Terms

| Term | Definition |
|---|---|
| **Multi-Tenant** | Architecture where a single application instance serves multiple businesses, with data isolation via `tenant_id`. |
| **Subdomain Routing** | Each tenant gets a subdomain (e.g., `store1.closetrent.com.bd`). The system reads the hostname to determine which tenant's data to load. |
| **Custom Domain** | A tenant's own domain (e.g., `rentbysara.com`) pointing to our platform via DNS. |
| **Wildcard DNS** | DNS configuration where `*.closetrent.com.bd` points to our server, enabling automatic subdomain creation. |
| **MinIO** | Self-hosted, S3-compatible object storage. Used for product images and other file uploads. |
| **Prisma** | TypeScript ORM used to define database schema, run migrations, and query PostgreSQL. |
| **NestJS** | Node.js backend framework providing structured, enterprise-ready API architecture. |
| **Next.js** | React-based frontend framework supporting server-side rendering, static generation, and API routes. |
| **Tenant Context** | The resolved tenant information attached to every incoming request. Determines which business's data is accessed. |
| **Availability** | Whether a product is not booked for a requested date range. Checked in real-time during the booking flow. |

---

## Currency & Locale

| Symbol | Meaning |
|---|---|
| **৳** | Bangladeshi Taka (BDT) — the primary currency |
| **bKash** | Mobile financial service — primary digital payment method in Bangladesh |
| **Nagad** | Mobile financial service — second major digital payment method |
| **SSLCommerz** | Payment gateway aggregator supporting bKash, Nagad, cards |

---

## Status Terms

| Term | Context | Meaning |
|---|---|---|
| **Draft** | Product | Created but not visible to guests |
| **Published** | Product | Visible to guests in the store |
| **Available** | Product | Currently not booked, can be rented |
| **Not Available** | Product | Cannot be rented now (upcoming item, or temporarily unavailable). Optional availability date can be set. |
| **Booked** | Product (date-specific) | Reserved for a specific date range |
| **Pending** | Booking/Order | Submitted by guest, waiting for owner action |
| **Confirmed** | Booking/Order | Accepted by owner |
| **Shipped** | Order | Product dispatched to customer |
| **Delivered** | Order | Product received by customer |
| **Returned** | Order | Product returned by customer |
| **Inspected** | Order | Returned product checked for damage |
| **Completed** | Order | Rental cycle fully finished, deposit refunded |
| **Cancelled** | Booking/Order | Cancelled by guest or owner |
| **Overdue** | Order | Return date passed, product not yet returned |
