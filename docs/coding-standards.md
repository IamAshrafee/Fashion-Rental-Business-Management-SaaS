# Coding Standards — ClosetRent SaaS

Rules that every developer (human or AI) must follow when writing code for this project. These standards ensure consistency across the entire codebase regardless of who writes it.

---

## Language & Type Safety

### TypeScript Everywhere

- **Strict mode enabled**: `"strict": true` in `tsconfig.json`
- **No `any` type**: Every variable, parameter, and return value must be typed. Use `unknown` when the type is genuinely unknown.
- **No `@ts-ignore`**: Fix the type error, don't suppress it.
- **Explicit return types**: All functions must declare their return type.
- **Interface over Type**: Prefer `interface` for object shapes. Use `type` only for unions, intersections, and utility types.

```typescript
// ✅ Good
interface CreateProductDto {
  name: string;
  categoryId: string;
  tenantId: string;
}

async function createProduct(dto: CreateProductDto): Promise<Product> {
  // ...
}

// ❌ Bad
async function createProduct(dto: any) {
  // ...
}
```

---

## Naming Conventions

### Files & Directories

| Type | Convention | Example |
|---|---|---|
| Directories | kebab-case | `color-variant/`, `product-details/` |
| React components | PascalCase | `ProductCard.tsx`, `BookingCalendar.tsx` |
| Hooks | camelCase with `use` prefix | `useAvailability.ts`, `useTenantContext.ts` |
| Utilities | camelCase | `formatPrice.ts`, `calculateLateFee.ts` |
| Constants | camelCase file, UPPER_SNAKE in code | `constants.ts` → `MAX_IMAGE_SIZE` |
| Types/Interfaces | PascalCase file | `Product.ts`, `BookingStatus.ts` |
| NestJS Controllers | PascalCase + `.controller` | `product.controller.ts` |
| NestJS Services | PascalCase + `.service` | `product.service.ts` |
| NestJS Modules | PascalCase + `.module` | `product.module.ts` |
| NestJS DTOs | PascalCase + `.dto` | `create-product.dto.ts` |
| Prisma schema | PascalCase models | `model Product {}` |
| Database tables | snake_case (Prisma auto-maps) | `product_variants` |
| API endpoints | kebab-case | `/api/product-variants` |
| Environment variables | UPPER_SNAKE_CASE | `DATABASE_URL` |

### Variables & Functions

| Type | Convention | Example |
|---|---|---|
| Variables | camelCase | `productName`, `rentalDays` |
| Functions | camelCase, verb-first | `getProduct()`, `calculateTotal()`, `validateDates()` |
| Boolean variables | `is/has/can/should` prefix | `isAvailable`, `hasDeposit`, `canBook` |
| Event handlers | `handle` prefix | `handleSubmit()`, `handleDateChange()` |
| React components | PascalCase | `ProductCard`, `BookingModal` |
| Constants | UPPER_SNAKE_CASE | `MAX_UPLOAD_SIZE`, `DEFAULT_RENTAL_DAYS` |
| Enums | PascalCase name, UPPER_SNAKE values | `enum BookingStatus { PENDING, CONFIRMED }` |
| Interfaces | PascalCase, no `I` prefix | `Product` not `IProduct` |
| Type params | Single uppercase letter | `T`, `K`, `V` |

---

## Project Structure

### Backend (NestJS)

```
backend/
├── src/
│   ├── common/
│   │   ├── guards/
│   │   │   ├── auth.guard.ts
│   │   │   ├── tenant.guard.ts
│   │   │   └── role.guard.ts
│   │   ├── interceptors/
│   │   │   ├── response.interceptor.ts
│   │   │   └── logging.interceptor.ts
│   │   ├── decorators/
│   │   │   ├── tenant-id.decorator.ts
│   │   │   ├── current-user.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts
│   │   ├── constants/
│   │   │   └── index.ts
│   │   └── utils/
│   │       ├── format-price.ts
│   │       └── date-utils.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── login.dto.ts
│   │   │   │   └── register.dto.ts
│   │   │   ├── strategies/
│   │   │   │   └── jwt.strategy.ts
│   │   │   └── auth.service.spec.ts
│   │   │
│   │   ├── product/
│   │   │   ├── product.module.ts
│   │   │   ├── product.controller.ts
│   │   │   ├── product.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-product.dto.ts
│   │   │   │   ├── update-product.dto.ts
│   │   │   │   └── product-query.dto.ts
│   │   │   └── product.service.spec.ts
│   │   │
│   │   └── [other modules follow same pattern]
│   │
│   ├── config/
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   └── storage.config.ts
│   │
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   │
│   └── main.ts
│
├── test/
│   ├── e2e/
│   └── fixtures/
│
├── Dockerfile
├── .env.example
├── tsconfig.json
└── package.json
```

### Frontend (Next.js)

```
frontend/
├── src/
│   ├── app/
│   │   ├── (guest)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx              # Shopping page
│   │   │   ├── product/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx      # Product details
│   │   │   ├── cart/
│   │   │   │   └── page.tsx
│   │   │   └── checkout/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (owner)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── products/
│   │   │   │   ├── page.tsx          # Product list
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx      # Add product
│   │   │   │   └── [id]/
│   │   │   │       └── edit/
│   │   │   │           └── page.tsx  # Edit product
│   │   │   ├── orders/
│   │   │   └── settings/
│   │   │
│   │   └── (admin)/
│   │       ├── layout.tsx
│   │       └── tenants/
│   │
│   ├── components/
│   │   ├── guest/
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductGallery.tsx
│   │   │   ├── BookingCalendar.tsx
│   │   │   ├── CartItem.tsx
│   │   │   ├── FilterDrawer.tsx
│   │   │   └── SearchBar.tsx
│   │   ├── owner/
│   │   │   ├── ProductForm.tsx
│   │   │   ├── OrderTable.tsx
│   │   │   └── DashboardStats.tsx
│   │   └── shared/
│   │       ├── Button.tsx
│   │       ├── Modal.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── PriceDisplay.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useTenant.ts
│   │   ├── useCart.ts
│   │   └── useAvailability.ts
│   │
│   ├── lib/
│   │   ├── api-client.ts             # HTTP client for backend
│   │   ├── utils.ts                  # General utilities
│   │   └── format.ts                 # Price, date formatting
│   │
│   ├── types/
│   │   ├── product.ts
│   │   ├── booking.ts
│   │   ├── tenant.ts
│   │   └── api.ts
│   │
│   └── styles/
│       └── globals.css
│
├── public/
│   └── fonts/
│
├── Dockerfile
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Code Patterns

### Backend: Controller-Service-Repository Pattern

Controllers handle HTTP. Services handle business logic. Prisma handles data access.

```typescript
// ✅ Good — Controller is thin, Service has logic
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @UseGuards(AuthGuard, TenantGuard)
  async create(
    @TenantId() tenantId: string,
    @Body() dto: CreateProductDto,
  ): Promise<Product> {
    return this.productService.create(tenantId, dto);
  }
}

// ❌ Bad — business logic in controller
@Controller('products')
export class ProductController {
  @Post()
  async create(@Body() dto: CreateProductDto) {
    const product = await this.prisma.product.create({ data: dto });
    await this.prisma.variant.createMany({ ... });
    // 50 more lines of logic...
  }
}
```

### Backend: Always Scope by Tenant

```typescript
// ✅ Good — tenant_id in every query
async findAll(tenantId: string): Promise<Product[]> {
  return this.prisma.product.findMany({
    where: { tenantId },
  });
}

// ❌ Bad — no tenant scoping
async findAll(): Promise<Product[]> {
  return this.prisma.product.findMany();
}
```

### Backend: DTO Validation

Every incoming request body must have a DTO with validation decorators:

```typescript
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsNumber()
  @Min(0)
  rentalPrice: number;

  @IsOptional()
  @IsString()
  description?: string;
}
```

### Frontend: Component Pattern

```tsx
// ✅ Good — typed props, clean structure
interface ProductCardProps {
  product: Product;
  onBookNow: (productId: string) => void;
}

export function ProductCard({ product, onBookNow }: ProductCardProps): JSX.Element {
  return (
    <div className="product-card">
      {/* ... */}
    </div>
  );
}

// ❌ Bad — untyped, inline logic
export default function ProductCard(props: any) {
  // ...
}
```

### Frontend: API Calls via Centralized Client

```typescript
// ✅ Good — centralized API client
// lib/api-client.ts
const apiClient = {
  async getProducts(tenantId: string): Promise<Product[]> {
    const res = await fetch(`${API_URL}/products`, {
      headers: { 'x-tenant-id': tenantId },
    });
    if (!res.ok) throw new ApiError(res);
    return res.json();
  },
};

// ❌ Bad — raw fetch scattered everywhere
const res = await fetch('http://localhost:4000/api/products');
```

---

## Error Handling

### Backend

- Use NestJS exception filters for consistent error responses
- Throw typed exceptions: `NotFoundException`, `BadRequestException`, `ForbiddenException`
- Never expose internal errors to the client
- Log errors with context (tenant ID, user ID, request body)

```typescript
// ✅ Good
if (!product) {
  throw new NotFoundException(`Product with ID ${id} not found`);
}

// ❌ Bad
if (!product) {
  return res.status(404).json({ msg: 'not found' });
}
```

### Frontend

- Use error boundaries for component-level error recovery
- Show user-friendly error messages, not technical errors
- Retry failed API calls with exponential backoff for network errors
- Log errors to console in development, to error tracking in production

---

## Comments & Documentation

### When to Comment

- **Complex business logic**: Explain WHY, not WHAT
- **Workarounds**: Link to the issue or explain why the workaround is needed
- **Non-obvious decisions**: If a future developer would ask "why?", add a comment
- **TODO items**: Always include context: `// TODO(feature-name): description`

### When NOT to Comment

- Do not describe what the code does when it's self-explanatory
- Do not leave commented-out code — delete it (Git has history)
- Do not write JSDoc for every function — type signatures should be sufficient

```typescript
// ✅ Good comment — explains WHY
// We check identical colors (not just main color) because a white dress
// with red embroidery should appear when users search for "red"
const matchingVariants = variants.filter(v =>
  v.identicalColors.includes(searchedColor)
);

// ❌ Bad comment — describes WHAT (already obvious)
// Filter variants by color
const matchingVariants = variants.filter(v =>
  v.identicalColors.includes(searchedColor)
);
```

---

## Git Conventions

### Branch Naming

```
feature/add-product-form
feature/booking-calendar
fix/availability-check-bug
chore/update-dependencies
refactor/product-service
```

### Commit Messages

Format: `type(scope): description`

```
feat(product): add color variant image management
fix(booking): correct availability check for multi-day ranges
chore(deps): update prisma to v5.10
refactor(auth): extract token validation to separate service
style(guest): update product card responsive layout
docs(api): document booking endpoint error codes
test(product): add unit tests for pricing calculation
```

Types: `feat`, `fix`, `chore`, `refactor`, `style`, `docs`, `test`, `perf`

### Pull Requests

Even as a solo developer, use PRs for:
- Documentation of what changed and why
- AI agent code review before merging
- Clean git history

---

## Testing Standards

### What Must Be Tested

| Layer | What | How |
|---|---|---|
| Service methods | Business logic, calculations, validations | Unit tests (Jest) |
| API endpoints | Request/response contracts, auth, error cases | Integration tests (Supertest) |
| Critical flows | Booking → order → return → deposit refund | E2E tests |
| Utility functions | Price formatting, date calculations | Unit tests |

### Test File Location

- Unit tests: Next to the file they test (`product.service.spec.ts`)
- Integration tests: `test/integration/`
- E2E tests: `test/e2e/`

### Test Naming

```typescript
describe('ProductService', () => {
  describe('create', () => {
    it('should create a product with basic information', async () => { });
    it('should create product with color variants', async () => { });
    it('should throw if category does not exist', async () => { });
    it('should scope product to tenant', async () => { });
  });
});
```

---

## Performance Rules

1. **No N+1 queries**: Always use Prisma `include` or `select` to load relations in one query
2. **Paginate all list endpoints**: Default 20 items, max 100
3. **Optimize images on upload**: Compress, resize, convert to WebP
4. **Lazy load images on frontend**: Use Next.js `<Image>` with lazy loading
5. **Cache frequently read data**: Tenant info, categories, product lists
6. **Index database columns**: Any column used in `WHERE`, `ORDER BY`, or `JOIN`

---

## Security Rules

1. **Validate all inputs**: Use DTOs with class-validator on backend
2. **Sanitize user content**: Escape HTML in user-generated content
3. **Never trust client data**: Re-validate on server, even if validated on client
4. **Never expose secrets**: No API keys, passwords, or tokens in frontend code
5. **Scope every query**: Include `tenant_id` in every database query
6. **Use parameterized queries**: Prisma does this by default — never use raw string concatenation
7. **Rate limit**: Protect public endpoints from abuse
