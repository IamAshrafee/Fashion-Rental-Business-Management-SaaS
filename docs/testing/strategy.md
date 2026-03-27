# Testing: Strategy

## Overview

Comprehensive testing strategy to ensure reliability, security, and correctness of the multi-tenant platform.

---

## Testing Pyramid

```
          ╱ ╲
         ╱ E2E╲          Few, high-value critical paths
        ╱───────╲
       ╱ Integr. ╲       API + DB tests per module
      ╱─────────────╲
     ╱   Unit Tests   ╲   Business logic, utilities, validators
    ╱───────────────────╲
```

---

## Coverage Targets

| Layer | Target | Focus |
|---|---|---|
| Unit | 80%+ | Services, validators, utilities, calculations |
| Integration | All endpoints | API routes, DB queries, auth flows |
| E2E | Critical paths | Booking flow, checkout, payment, tenant isolation |

---

## Tools

| Tool | Purpose |
|---|---|
| **Jest** | Unit + integration test runner |
| **Supertest** | HTTP testing for NestJS endpoints |
| **Prisma** | Test database with migrations |
| **Docker** | Isolated test database (PostgreSQL + Redis) |
| **Playwright** | E2E browser testing |
| **Faker.js** | Realistic test data generation |

---

## Test Environment

```
Test Suite → Docker PostgreSQL (test DB)
           → Docker Redis (test cache)
           → Docker MinIO (test storage)
           → NestJS app (test mode)
```

- Separate test database, wiped between test suites
- Environment: `NODE_ENV=test`
- External services (SMS, courier, SSLCommerz) always mocked

---

## CI/CD Integration

```
Push → Lint → Unit Tests → Integration Tests → Build → Deploy
```

All tests must pass before deployment. See [CI/CD](../devops/ci-cd.md).

---

## Multi-Tenant Testing

Every test suite must verify:
1. Data created by Tenant A is invisible to Tenant B
2. API calls with Tenant A's token cannot access Tenant B data
3. Cross-tenant operations are rejected with 403/404
