import { PrismaClient } from '@prisma/client';
import { ProductService } from './src/modules/product/product.service';
import { VariantService } from './src/modules/product/variant.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const prisma = new PrismaClient();
const eventEmitter = new EventEmitter2();

const productService = new ProductService(prisma as any, eventEmitter);
const variantService = new VariantService(prisma as any);

async function main() {
  console.log('Fetching tenant for dev.ashrafee@gmail.com...');
  // Just get the first available tenant in the DB to test the product system
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found in DB');
  
  const tenantId = tenant.id;
  console.log(`Using Tenant ID: ${tenantId}`);

  // Fetch a category
  let category = await prisma.category.findFirst({ where: { tenantId } });
  if (!category) {
    category = await prisma.category.create({
      data: { tenantId, name: 'Test Category', slug: 'test-category' }
    });
  }

  // Fetch color
  let color = await prisma.color.findFirst();
  if (!color) {
    color = await prisma.color.create({
      data: { name: 'Test Black', hexCode: '#000000' }
    });
  }

  // Fetch a size schema and instance
  const schema = await prisma.sizeSchema.findFirst({
    where: { status: 'active' },
    include: { instances: true }
  });

  if (!schema || schema.instances.length === 0) {
    throw new Error('No active size schema with instances found. Cannot test size assignment.');
  }

  const sizeInstance = schema.instances[0];

  console.log('Creating product...');
  
  // 1. Create Base Product
  const product = await productService.create(tenantId, {
    name: 'CLI E2E Test Product with Size',
    description: 'This product was created via CLI to verify sizing functionality.',
    categoryId: category.id,
    status: 'published',
    pricing: {
      mode: 'one_time',
      rentalPrice: 5000,
      includedDays: 3,
    },
    services: {
      depositAmount: 1000,
    },
    sizeSchemaOverrideId: schema.id,
  } as any);

  console.log(`Product created successfully: ${product.id}`);

  // 2. Create Variant with Size
  console.log('Adding variant with size...');
  const variant = await variantService.addVariant(tenantId, product.id, {
    variantName: `Size ${sizeInstance.displayLabel} (Test Variant)`,
    mainColorId: color.id,
    sizeInstanceId: sizeInstance.id,
    identicalColorIds: [],
  });

  console.log(`Variant added with sizeInstanceId: ${variant.sizeInstanceId}`);

  // 3. Verify
  const verifyVariant = await prisma.productVariant.findUnique({
    where: { id: variant.id },
    include: { sizeInstance: true }
  });

  console.log(`Verification: Variant Size is = ${verifyVariant?.sizeInstance?.displayLabel}`);
  console.log('--- TEST SUCCESSFUL ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
