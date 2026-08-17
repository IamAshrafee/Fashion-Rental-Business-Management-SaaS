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

The explicit prepare launcher (`prepare-dev.cmd` on Windows or `prepare-dev.command` on macOS) runs the seed before starting the applications. The normal start launcher never seeds. Double-clicking the reset launcher performs a confirmed full local reset, then runs migrations and the seed after recreating the verified development resources.

Running `npm run db:seed` twice must produce the same logical platform records.
