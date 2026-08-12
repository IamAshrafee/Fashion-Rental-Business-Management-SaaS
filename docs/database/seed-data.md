# Database Seed Data

The Prisma seed installs global platform prerequisites. It is safe to run repeatedly and deliberately does not create fake tenants, products, bookings, customers, shipments, or payments.

## Managed platform records

The seed upserts:

- the environment-configured SaaS administrator;
- Free, Pro, and Enterprise subscription plans and current resource-governance limits;
- the shared system color catalogue;
- the active Fashion Rental starter template.

Managed fields are updated on every run so a deployment can repair stale platform configuration. The administrator password is hashed with `BCRYPT_SALT_ROUNDS` and synchronized from `SEED_ADMIN_PASSWORD`.

## Credential safety

Local development uses the credentials documented in `.env.example`. Production seeding requires explicit `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, requires a password of at least 12 characters, and rejects the documented local password.

Seed output includes the administrator email but never prints its password or hash.

## Tenant onboarding

Tenant registration—not the global seed—creates the complete tenant foundation in one transaction:

- owner and tenant membership;
- store settings and manual delivery connection;
- subscription;
- default inventory location and tenant availability policy;
- apparel, free-size, and footwear size systems;
- core fashion product types;
- categories, subcategories, events, and locale settings from the active starter template.

This separation keeps platform installation deterministic while ensuring every real tenant is created through the same production onboarding path.

## Commands

```bash
npm run db:seed
```

Normal local startup runs the seed automatically through `npm run dev:prepare`. A full local reset runs migrations and the seed after recreating the verified development resources:

```bash
npm run dev:reset
```

Running `npm run db:seed` twice must produce the same logical platform records.
