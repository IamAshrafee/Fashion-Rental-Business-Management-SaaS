# Testing: Integration Tests

## Scope

Test API endpoints end-to-end against a real test database. Validate request → service → database → response.

---

## Setup

```typescript
beforeAll(async () => {
  // Start test app
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication();
  await app.init();

  // Seed test tenant + user
  await seedTestTenant();
});

afterAll(async () => {
  await cleanDatabase();
  await app.close();
});
```

---

## Test Suites

### Auth Module

```typescript
describe('POST /auth/register', () => {
  it('should create user, tenant, and store settings', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Test Owner',
        phone: '01711111111',
        password: 'Test1234',
        businessName: 'Test Boutique',
        subdomain: 'testboutique',
      })
      .expect(201);

    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.tenant.subdomain).toBe('testboutique');
  });

  it('should reject duplicate subdomain', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...validPayload, subdomain: 'testboutique' })
      .expect(409);
  });
});
```

### Product Module

```typescript
describe('Products API', () => {
  it('should create a product', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/owner/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(productPayload)
      .expect(201);

    productId = res.body.data.id;
  });

  it('should not allow Tenant B to access Tenant A product', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/owner/products/${productId}`)
      .set('Authorization', `Bearer ${tenantBToken}`)
      .expect(404);
  });
});
```

### Booking Module

```typescript
describe('Booking Flow', () => {
  it('should create booking and block dates', async () => { ... });
  it('should reject overlapping dates', async () => { ... });
  it('should recalculate prices server-side', async () => { ... });
  it('should transition statuses correctly', async () => { ... });
});
```

---

## Tenant Isolation Tests

Every module must include:

```typescript
describe('Tenant Isolation', () => {
  it('Tenant A data invisible to Tenant B', async () => { ... });
  it('Cross-tenant update rejected', async () => { ... });
  it('List endpoints only return own data', async () => { ... });
});
```

---

## Running

```bash
# Integration tests
npm run test:e2e

# With test database
docker compose -f docker-compose.test.yml up -d
npm run test:e2e
docker compose -f docker-compose.test.yml down
```
