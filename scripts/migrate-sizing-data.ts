import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting sizing data seed...');

  // Get all tenants
  const tenants = await prisma.tenant.findMany();
  
  if (tenants.length === 0) {
    console.log('No tenants found. Skipping seed.');
    return;
  }

  for (const tenant of tenants) {
    console.log(`Processing tenant: ${tenant.id}`);

    // Create a base "General Apparel" size schema
    const schema = await prisma.sizeSchema.upsert({
      where: {
        id: `schema_alpha_${tenant.id}`, // We won't use this as where since it isn't unique, but we will findFirst
      },
      create: {
        id: `schema_alpha_${tenant.id}`,
        tenantId: tenant.id,
        name: 'Standard Apparel (S, M, L)',
        code: 'APPAREL_ALPHA',
        status: 'active',
        definition: {
          dimensions: [
            { code: 'chest', label: 'Chest', type: 'number', required: false },
            { code: 'length', label: 'Length', type: 'number', required: false }
          ],
          ui: {
            selectorType: 'grid',
            displayTemplate: '',
            dimensionOrder: ['chest', 'length']
          },
          normalization: {
            normalizedKeyTemplate: ''
          }
        }
      },
      update: {}
    }).catch(async (e) => {
       // if ID exists or error, try finding it instead
       return await prisma.sizeSchema.findFirst({ where: { tenantId: tenant.id, code: 'APPAREL_ALPHA' }})
       || await prisma.sizeSchema.create({
         data: {
          tenantId: tenant.id,
          name: 'Standard Apparel (S, M, L)',
          code: 'APPAREL_ALPHA',
          status: 'active',
          definition: {
            dimensions: [
              { code: 'chest', label: 'Chest', type: 'number', required: false },
              { code: 'length', label: 'Length', type: 'number', required: false }
            ],
            ui: {
              selectorType: 'grid',
              displayTemplate: '',
              dimensionOrder: ['chest', 'length']
            },
            normalization: {
              normalizedKeyTemplate: ''
            }
          }
         }
       });
    });

    // Create base instances for S, M, L
    const instancesToCreate = ['XS', 'S', 'M', 'L', 'XL'];
    for (const size of instancesToCreate) {
      await prisma.sizeInstance.upsert({
        where: {
          sizeSchemaId_normalizedKey: {
            sizeSchemaId: schema.id,
            normalizedKey: size.toUpperCase(),
          }
        },
        create: {
          sizeSchemaId: schema.id,
          normalizedKey: size.toUpperCase(),
          displayLabel: size,
          payload: {}
        },
        update: {}
      });
    }

    // Create a base "General" product type
    const productType = await prisma.productType.findFirst({
      where: {
        tenantId: tenant.id,
        name: 'General',
      }
    }) || await prisma.productType.create({
      data: {
        tenantId: tenant.id,
        name: 'General',
        slug: 'general',
        defaultSizeSchemaId: schema.id,
      }
    });

    // Assign existing products to this general type
    await prisma.product.updateMany({
      where: {
        tenantId: tenant.id,
        productTypeId: null,
      },
      data: {
        productTypeId: productType.id,
      }
    });
    
    console.log(`✅ Tenant ${tenant.id} seeded successfully.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
