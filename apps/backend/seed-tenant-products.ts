import { PrismaClient, PricingMode, SizeMode, FreeSizeType, LateFeeType, ShippingMode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to DB via Prisma to seed massive data...');
  const tenant = await prisma.tenant.findFirst({
    where: { owner: { email: 'dev.ashrafee@gmail.com' } }
  });
  if (!tenant) {
    throw new Error('Tenant for user not found');
  }
  const tenantId = tenant.id;

  // Find some colors
  let colors = await prisma.color.findMany();
  if (colors.length === 0) {
    const c1 = await prisma.color.create({ data: { name: 'Black', hexCode: '#000000', isSystem: true, tenantId: '' } });
    const c2 = await prisma.color.create({ data: { name: 'Red', hexCode: '#FF0000', isSystem: true, tenantId: '' } });
    colors = [c1, c2];
  }

  // Find a category
  let category = await prisma.category.findFirst({ where: { tenantId } });
  if (!category) {
    category = await prisma.category.create({
      data: { name: 'Bridal Collection', slug: 'bridal-collection', tenantId }
    });
  }

  console.log('Generating 20 highly detailed products...');

  const images = [
    'C:\\Users\\devas\\.gemini\\antigravity\\brain\\69cd8356-8ef8-42d4-9dad-27b079b2d177\\red_evening_gown_1775231388000.png',
    'C:\\Users\\devas\\.gemini\\antigravity\\brain\\69cd8356-8ef8-42d4-9dad-27b079b2d177\\navy_blue_suit_1775231409803.png',
    'C:\\Users\\devas\\.gemini\\antigravity\\brain\\69cd8356-8ef8-42d4-9dad-27b079b2d177\\leather_jacket_1775231432589.png'
  ];

  const prefixes = ['Majestic', 'Elegant', 'Vintage', 'Modern', 'Sleek', 'Premium', 'Exclusive', 'Royal', 'Opulent', 'Bespoke'];
  const types = ['Gown', 'Suit', 'Jacket', 'Lehenga', 'Saree', 'Tuxedo', 'Sherwani', 'Cocktail Dress', 'Blazer'];
  const suffixes = ['Collection', 'Edition', 'Line', 'Series', 'Vibe'];

  for (let i = 1; i <= 20; i++) {
    const name = `${prefixes[i % prefixes.length]} ${types[i % types.length]} ${suffixes[i % suffixes.length]} Vol ${i}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const imagePath = images[i % images.length];
    const color = colors[i % colors.length];

    try {
      const p = await prisma.product.upsert({
        where: { tenantId_slug: { tenantId, slug } },
        update: {},
        create: {
          tenantId,
          categoryId: category.id,
          name: name,
          slug: slug,
          status: 'published',
          description: `This is an extremely detailed description for ${name}. It features luxurious fabrics, hand-crafted details, and breathtaking aesthetics perfectly tailored for the most special occasions. Made with premium materials sourced globally, ensuring maximum comfort while maintaining a sleek, modern silhouette.`,
          isAvailable: i % 3 !== 0,
          purchaseDate: new Date(),
          purchasePrice: 15000 + (i * 1000),
          purchasePricePublic: true,
          itemCountry: i % 2 === 0 ? 'Italy' : 'India',
          itemCountryPublic: true,
          targetRentals: 50,
          totalBookings: i * 5,
          totalRevenue: i * 5000,
          
          pricing: {
            create: {
              mode: PricingMode.one_time,
              rentalPrice: 5000 + (i * 100),
              includedDays: 4,
              pricePerDay: 1500,
              minimumDays: 3,
              retailPrice: 20000 + (i * 1000),
              rentalPercentage: 25.5,
              calculatedPrice: 5100,
              priceOverride: 4999,
              minInternalPrice: 2000,
              maxDiscountPrice: 4000,
              extendedRentalRate: 1000,
              lateFeeType: LateFeeType.fixed,
              lateFeeAmount: 500,
              lateFeePercentage: 10.0,
              maxLateFee: 2500,
              shippingMode: ShippingMode.flat,
              shippingFee: 150,
              tenantId
            }
          },

          productSize: {
            create: {
              mode: SizeMode.standard,
              mainDisplaySize: 'Medium',
              availableSizes: ['S', 'M', 'L', 'XL', 'XXL'],
              freeSizeType: FreeSizeType.adjustable,
              sizeChartUrl: 'https://example.com/size-chart.png',
              tenantId,
              measurements: {
                create: [
                  { label: 'Chest', value: '40', unit: 'inch', sequence: 0 },
                  { label: 'Waist', value: '34', unit: 'inch', sequence: 1 },
                  { label: 'Length', value: '60', unit: 'inch', sequence: 2 },
                  { label: 'Shoulder', value: '18', unit: 'inch', sequence: 3 },
                ]
              }
            }
          },

          services: {
            create: {
              depositAmount: 2000,
              cleaningFee: 300,
              backupSizeEnabled: true,
              backupSizeFee: 500,
              tryOnEnabled: true,
              tryOnFee: 200,
              tryOnDurationHours: 48,
              tryOnCreditToRental: true,
              tenantId
            }
          },

          variants: {
            create: [{
              mainColorId: color.id,
              variantName: `Signature ${color.name}`,
              sequence: 0,
              tenantId,
              images: {
                create: [{
                  url: imagePath,
                  thumbnailUrl: imagePath,
                  isFeatured: true,
                  sequence: 0,
                  tenantId,
                  originalName: `image_${i}.png`,
                  fileSize: 1024000 + (i * 1000)
                }]
              }
            }]
          },

          faqs: {
            create: [
              { question: 'What is the rental period?', answer: 'The standard rental period is 4 days including transit.', sequence: 0, tenantId },
              { question: 'Is cleaning included?', answer: 'Yes, professional dry cleaning is handled by our team.', sequence: 1, tenantId },
              { question: 'Can I alter the item?', answer: 'Temporary minor alterations are allowed using safety pins only.', sequence: 2, tenantId },
              { question: 'What if it gets damaged?', answer: 'Minor drops and spills are covered, but severe tears may incur penalties.', sequence: 3, tenantId }
            ]
          },

          detailHeaders: {
            create: [
              {
                headerName: 'Fabric & Care',
                sequence: 0,
                tenantId,
                entries: {
                  create: [
                    { key: 'Material', value: '100% Premium Silk', sequence: 0 },
                    { key: 'Lining', value: 'Soft Cotton blend', sequence: 1 },
                    { key: 'Care', value: 'Dry Clean Only', sequence: 2 },
                  ]
                }
              },
              {
                headerName: 'Styling Notes',
                sequence: 1,
                tenantId,
                entries: {
                  create: [
                    { key: 'Best for', value: 'Evening Galas, Receptions', sequence: 0 },
                    { key: 'Accessories', value: 'Pairs perfectly with gold jewelry', sequence: 1 },
                  ]
                }
              }
            ]
          }
        }
      });
      console.log(`Created massive product: ${name} (ID: ${p.id})`);
    } catch (err) {
      console.error(`Failed to create ${name}:`, err);
    }
  }

  console.log('Massive product seeding complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
