# Development Roadmap — ClosetRent SaaS

Full production buildout. Not an MVP — every phase delivers production-quality, complete features.

---

## Phasing Strategy

The project is divided into phases based on **dependency order**, not priority. Every feature is important, but some features require others to exist first.

```
Phase 1: Foundation
    ↓
Phase 2: Core Inventory System
    ↓
Phase 3: Guest Storefront
    ↓
Phase 4: Booking & Commerce
    ↓
Phase 5: Business Owner Dashboard
    ↓
Phase 6: Multi-Tenant & Branding
    ↓
Phase 7: Payments & Courier
    ↓
Phase 8: Notifications & Communication
    ↓
Phase 9: Analytics & Reporting
    ↓
Phase 10: SaaS Admin Portal
    ↓
Phase 11: Polish, Security & Performance
    ↓
Phase 12: Deployment & Launch
```

---

## Phase 1 — Foundation

**Goal**: Set up the project, tools, and infrastructure so that feature development can begin immediately.

### Deliverables

| Task | Details |
|---|---|
| Initialize Next.js project | App Router, TypeScript, Tailwind CSS |
| Set up ShadCN/ui | Owner portal and admin portal components |
| Initialize NestJS project | TypeScript, class-validator, Swagger |
| Set up monorepo | npm workspaces, `packages/types` for shared TypeScript types |
| Set up Prisma | Schema, initial migration, seed script |
| Set up PostgreSQL | Docker container, database creation, connection |
| Set up Redis | Docker container, connection |
| Set up MinIO | Docker container, bucket creation, connection |
| Set up BullMQ | Job queues for background processing |
| Docker Compose | All services orchestrated, internal network |
| Nginx config | Reverse proxy, SSL (self-signed for dev) |
| Environment config | `.env` files, `@nestjs/config` validation |
| Auth system | JWT (15 min) + refresh token (7 day, httpOnly), session tracking |
| Tenant middleware | Host header parsing, tenant context injection |
| Role system | Guest, Owner, Manager, Staff, Admin roles with guards |
| Event system | NestJS EventEmitter2 setup |
| Base API structure | Error handling, response format, validation pipe |
| Base UI structure | Layout components, design tokens, fonts |

### Exit Criteria
- A developer can create a tenant, log in as owner, and hit authenticated API endpoints
- All Docker services running and communicating
- Database migrations working

---

## Phase 2 — Core Inventory System

**Goal**: Business owners can add, edit, and manage products with full variant/pricing support.

### Deliverables

| Task | Details |
|---|---|
| Category & subcategory CRUD | Dynamic categories, dependent subcategories |
| Event types management | Multi-select event tags |
| Color system | Main color, identical colors, color palette |
| Product CRUD | Create, read, update, delete products |
| Color variant system | Multiple variants per product, each with images and colors |
| Image upload system | Multi-image upload to MinIO, compression, WebP conversion |
| Image sequencing | Drag-to-reorder images, set featured image per variant |
| Size system | All 4 size modes (standard, measurement, multi-part, free) |
| Rental pricing | All pricing modes (one-time, per-day, retail percentage) |
| Internal pricing | Minimum price range (staff-visible only) |
| Service options | Security deposit, cleaning fee, backup size |
| Timing & logistics | Extended rental fees, late fees, shipping policy |
| Try-before-rent | Toggle, pricing, duration config |
| Purchase info | Purchase date, price, item country (with visibility toggles) |
| Target tracking | Manual target or auto-calculate from purchase price |
| FAQ section | Add/edit/delete FAQs per product |
| Product description | Rich text editor |
| Product details builder | Header → key-value structured details |
| Product status | Draft / Published / Available / Not Available |
| Availability date | Optional "available from" date for upcoming products |

### Exit Criteria
- Owner can add a complete product with all fields, variants, images, pricing
- Owner can edit and delete products
- Products have correct status management

---

## Phase 3 — Guest Storefront

**Goal**: Customers can browse, search, filter, and view products in a beautiful mobile-first experience.

### Deliverables

| Task | Details |
|---|---|
| Shopping page layout | Sticky header, two-column product grid |
| Product cards | Image, title, price, duration, size, availability badge |
| Smart thumbnail | Auto-switch featured image based on filter color |
| Search system | Search by name, category, event, color, size |
| Quick filter pills | Horizontal scroll pills for common filters |
| Advanced filter drawer | Full filter panel with all options |
| Sort options | Price, popularity, newest |
| Product details page | Image carousel, zoom, product info, trust section |
| Color variant switching | Click color → switch all images to that variant |
| Size selection | Select size with visual buttons |
| Date selection | Calendar with available/booked dates |
| Price calculation | Auto-calculate based on selected dates |
| Description section | Formatted product description |
| FAQ section | Expandable FAQ accordion |
| Product details section | Structured key-value display |
| Trust section | Store rating, cleaning badge, contact info |
| Responsive design | Perfect on mobile, good on tablet and desktop |
| SEO optimization | Meta tags, og:image, structured data |
| Social sharing | Correct preview when shared on Facebook/WhatsApp |
| Deep linking | Direct links to products work from social media |

### Exit Criteria
- A user landing from a Facebook link can see the product page correctly
- Search and filter work across all product attributes
- Color variant switching works with smart thumbnails
- Mobile experience is smooth and fast

---

## Phase 4 — Booking & Commerce

**Goal**: Complete booking flow from cart to confirmation.

### Deliverables

| Task | Details |
|---|---|
| Availability engine | Real-time date-range availability checking |
| Buffer days | Configurable gap between bookings (per-tenant + per-product override) |
| Date blocking | Booked dates auto-blocked for other customers |
| Cart system | Add to cart, update, remove, session-based |
| Cart page | Item list, rental details, price breakdown |
| Checkout page | Customer info form, payment selection, order summary |
| Customer info | Name, phone, alternative phone, delivery address |
| Address format | Tenant-configurable address fields (per-country templates) |
| Order creation | Create order from cart with validation |
| Booking confirmation | Success page with order ID, summary, next steps |
| Booking conflict handling | Prevent double-booking same dates |
| Price breakdown | Rental + deposit + cleaning fee + shipping clearly shown |
| Guest checkout | No account required to place a booking |
| Cart persistence | Local storage for guest cart (no login needed) |

### Exit Criteria
- Guest can browse → add to cart → checkout → confirm without creating an account
- Availability checking prevents double bookings
- Price breakdown is clear and correct

---

## Phase 5 — Business Owner Dashboard

**Goal**: Owners can manage their day-to-day operations — orders, customers, and business overview.

### Deliverables

| Task | Details |
|---|---|
| Dashboard home | Key metrics, recent orders, quick actions |
| Order management | List all orders with status filters |
| Order detail view | Full order info, customer details, timeline |
| Order status flow | Pending → Confirmed → Shipped → Delivered → Returned → Inspected → Completed |
| Customer list | All customers who have booked, with history |
| Customer detail | Booking history, contact info, notes |
| Deposit management | Track deposits, process refunds |
| Late return handling | Flag overdue orders, calculate late fees |
| Damage reporting | Mark items as damaged, calculate compensation |
| Product list view | Search, filter, status overview for all products |
| Quick actions | Mark as shipped, confirm return, refund deposit |
| Session management | View/revoke staff sessions, configure concurrent limits |

### Exit Criteria
- Owner can manage complete order lifecycle
- Customer history is accessible
- Deposit and late fee calculations work correctly

---

## Phase 6 — Multi-Tenant & Branding

**Goal**: Each business has its own branded storefront with subdomain routing.

### Deliverables

| Task | Details |
|---|---|
| Tenant onboarding | Signup flow → create store → choose subdomain |
| Subdomain routing | Wildcard DNS, Nginx config, tenant resolution |
| Store branding | Logo, primary/secondary colors, banner images |
| Business info | About section, contact number, social links |
| WhatsApp integration | Click-to-chat button with pre-filled message |
| Footer customization | Business info, social links, copyright |
| Dynamic theming | Apply tenant brand colors to storefront |
| Store settings page | Owner can update all branding from dashboard |
| Custom domain support | DNS verification, SSL provisioning |

### Exit Criteria
- New business can sign up and have a working store within 15 minutes
- Each store looks uniquely branded
- Subdomain routing works correctly

---

## Phase 7 — Payments & Courier

**Goal**: Enable digital payments and delivery tracking.

### Deliverables

| Task | Details |
|---|---|
| SSLCommerz integration | bKash, Nagad, card payments via gateway |
| Payment flow | Initiate → redirect → callback → verify → confirm |
| Payment webhook | Handle IPN for reliable payment confirmation |
| Cash on delivery | Support COD option |
| Advance payment | Partial upfront payment option |
| Payment records | Track all payment transactions per order |
| Courier abstraction | Generic courier service interface |
| Pathao integration | Create parcel, track delivery |
| Steadfast integration | Create consignment, track delivery |
| Delivery tracking | Show tracking status to customer |
| Shipping fee calculation | Fixed rate or area-based |

### Exit Criteria
- Customer can pay via bKash/Nagad and order is auto-confirmed
- Courier parcel creation works from owner dashboard
- Payment records are complete and accurate

---

## Phase 8 — Notifications & Communication

**Goal**: Keep customers and owners informed at every step.

### Deliverables

| Task | Details |
|---|---|
| SMS notifications | Order confirmation, shipping update, return reminder |
| SMS gateway integration | BulkSMS BD or similar provider |
| In-app notifications | Owner dashboard notification bell |
| Return reminders | Auto-send reminder 1 day before return date |
| Order status updates | Notify customer on status changes |
| Low stock alerts | Warn owner when popular items are frequently booked |

### Exit Criteria
- Customer receives SMS on booking confirmation
- Owner receives notification on new booking
- Return reminders send automatically

---

## Phase 9 — Analytics & Reporting

**Goal**: Give business owners visibility into their performance.

### Deliverables

| Task | Details |
|---|---|
| Revenue dashboard | Total revenue, revenue by period, trends |
| Booking analytics | Bookings per day/week/month, conversion rate |
| Popular products | Most booked items, revenue per product |
| Customer analytics | New vs returning, top customers |
| Target tracking | Cost recovery progress per product |
| Inventory utilization | How often each product is booked vs idle |
| Export | Download reports as CSV |

### Exit Criteria
- Owner can see clear revenue and booking trends
- Target recovery tracking shows per-product progress
- Data is accurate and updates in real-time

---

## Phase 10 — SaaS Admin Portal

**Goal**: Platform-level management for operating the SaaS business.

### Deliverables

| Task | Details |
|---|---|
| Tenant management | List all businesses, view details, suspend |
| Tenant metrics | Per-tenant stats (products, orders, revenue) |
| Subscription management | Plan tiers, billing status |
| Support system | View and respond to tenant support requests |
| Platform analytics | Total tenants, total orders, growth metrics |
| System health | Server status, error rates, performance |
| Feature flags | Enable/disable features per tenant or globally |
| Announcement system | Send announcements to all or specific tenants |

### Exit Criteria
- Admin can manage all tenants from a single dashboard
- Billing and subscription tracking works
- Platform-level metrics are visible

---

## Phase 11 — Polish, Security & Performance

**Goal**: Production-readiness — all edges smoothed, all vulnerabilities closed.

### Deliverables

| Task | Details |
|---|---|
| Security audit | Review all endpoints, fix vulnerabilities |
| Input sanitization | XSS protection, SQL injection prevention review |
| Rate limiting | All public endpoints rate-limited |
| Performance optimization | Query optimization, caching review, image optimization |
| Error handling review | All error cases covered with proper messages |
| Localization | Multi-language support preparation (i18n keys) |
| Accessibility | Keyboard navigation, screen reader basics |
| Browser testing | Chrome, Safari, Firefox on mobile and desktop |
| Load testing | Simulate concurrent users, identify bottlenecks |
| Documentation review | All docs up to date with final implementation |

### Exit Criteria
- No known security vulnerabilities
- Page load time < 2 seconds on 3G
- All critical paths tested across devices

---

## Phase 12 — Deployment & Launch

**Goal**: Go live.

### Deliverables

| Task | Details |
|---|---|
| Production VPS setup | Ubuntu, Docker, all services deployed |
| Domain setup | DNS configured via Cloudflare |
| SSL certificates | Wildcard + custom domain certificates |
| Production database | Seeded with initial data |
| Backup automation | Daily DB backup, MinIO sync |
| Monitoring | UptimeRobot, basic server monitoring |
| First tenant onboarding | Test with real business owner |
| Soft launch | 3-5 initial businesses |
| Feedback collection | Gather feedback, prioritize fixes |
| Marketing website | Landing page for attracting new tenants |

### Exit Criteria
- System is live and serving real customers
- At least 3 businesses actively using the platform
- Backup and monitoring are operational

---

## Timeline Estimate

This is a realistic estimate for a solo developer working with AI agents:

| Phase | Estimated Duration |
|---|---|
| Phase 1: Foundation | 2-3 weeks |
| Phase 2: Core Inventory | 3-4 weeks |
| Phase 3: Guest Storefront | 2-3 weeks |
| Phase 4: Booking & Commerce | 2-3 weeks |
| Phase 5: Owner Dashboard | 2-3 weeks |
| Phase 6: Multi-Tenant | 1-2 weeks |
| Phase 7: Payments & Courier | 2-3 weeks |
| Phase 8: Notifications | 1-2 weeks |
| Phase 9: Analytics | 1-2 weeks |
| Phase 10: Admin Portal | 2-3 weeks |
| Phase 11: Polish & Security | 2-3 weeks |
| Phase 12: Deployment & Launch | 1-2 weeks |
| **Total** | **~5-8 months** |

These estimates assume focused work with AI assistance. Actual timeline depends on daily hours invested and decision-making speed.
