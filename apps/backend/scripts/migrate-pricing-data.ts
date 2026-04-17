const { PrismaClient, Prisma } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Pricing Data Migration...');

  // 1. Get all published or unpublished products that have legacy pricing but NO pricing profile yet
  const products = await prisma.product.findMany({
    where: {
      pricingProfile: null,
      pricing: { isNot: null },
    },
    include: {
      pricing: true,
      services: true,
    },
  });

  console.log(`Found ${products.length} products to migrate.`);

  for (const product of products) {
    console.log(`Migrating product: ${product.name} (${product.id})`);

    const p = product.pricing;
    const s = product.services;

    if (!p) continue;

    // Build Rate Plan
    let ratePlanType = 'PER_DAY';
    let ratePlanConfig = {};

    if (p.mode === 'one_time') {
      ratePlanType = 'FLAT_PERIOD';
      ratePlanConfig = {
        flatPriceMinor: p.rentalPrice || 0,
        includedDays: p.includedDays || 3,
        extraDayRateMinor: p.extendedRentalRate || 0,
      };
    } else if (p.mode === 'percentage') {
      ratePlanType = 'PERCENT_RETAIL';
      ratePlanConfig = {
        percent: p.rentalPercentage || 10,
        minPriceMinor: null,
        maxPriceMinor: p.maxDiscountPrice || null,
      };
    } else {
      ratePlanType = 'PER_DAY';
      ratePlanConfig = {
        unitPriceMinor: p.pricePerDay || p.rentalPrice || 0,
        minimumDays: p.minimumDays || 1,
      };
    }

    // Build Late Fee Policy
    let lateFeePolicy = null;
    if (p.lateFeeType) {
      lateFeePolicy = {
        enabled: true,
        graceHours: 24, // default grace period
        mode: p.lateFeeType === 'percentage' ? 'PERCENT_BASE' : 'FLAT',
        amountMinor: p.lateFeeType === 'fixed' ? p.lateFeeAmount : undefined,
        percent: p.lateFeeType === 'percentage' ? p.lateFeePercentage : undefined,
        totalCapMinor: p.maxLateFee || null,
      };
    }

    // Build Components (Services)
    const components: any[] = [];
    if (s?.depositAmount) {
      components.push({
        id: uuidv4(),
        type: 'DEPOSIT',
        visibility: 'CUSTOMER',
        chargeTiming: 'AT_BOOKING',
        refundable: true,
        priority: 100,
        config: {
          label: 'Security Deposit',
          pricing: { mode: 'FLAT', amountMinor: s.depositAmount },
        },
      });
    }

    if (s?.cleaningFee) {
      components.push({
        id: uuidv4(),
        type: 'FEE',
        visibility: 'CUSTOMER',
        chargeTiming: 'AT_BOOKING',
        refundable: false,
        priority: 90,
        config: {
          label: 'Cleaning Fee',
          pricing: { mode: 'FLAT', amountMinor: s.cleaningFee },
        },
      });
    }

    if (s?.backupSizeEnabled && s?.backupSizeFee) {
      components.push({
        id: uuidv4(),
        type: 'ADDON',
        visibility: 'CUSTOMER',
        chargeTiming: 'AT_BOOKING',
        refundable: false,
        priority: 80,
        config: {
          label: 'Backup Size',
          pricing: { mode: 'FLAT', amountMinor: s.backupSizeFee },
        },
      });
    }

    if (s?.tryOnEnabled && s?.tryOnFee) {
      components.push({
        id: uuidv4(),
        type: 'ADDON',
        visibility: 'CUSTOMER',
        chargeTiming: 'AT_BOOKING',
        refundable: false,
        priority: 70,
        config: {
          label: 'Home Try-On',
          pricing: { mode: 'FLAT', amountMinor: s.tryOnFee },
        },
      });
    }

    // Create the pricing profile and initial policy version
    const profileId = uuidv4();
    const versionId = uuidv4();

    await prisma.$transaction(async (tx: any) => {
      // 1. Create Profile
      await tx.pricingProfile.create({
        data: {
          id: profileId,
          tenantId: product.tenantId,
          productId: product.id,
          currency: 'BDT',
          durationMode: 'CALENDAR_DAYS',
          billingRounding: 'CEIL',
          activePolicyVersionId: versionId,
        },
      });

      // 2. Create Policy Version
      const componentsData = components.map((c) => ({
        ...c,
        config: c.config, // handled by Prisma Json
      }));

      await tx.pricePolicyVersion.create({
        data: {
          id: versionId,
          pricingProfileId: profileId,
          version: 1,
          status: 'ACTIVE',
          publishedAt: new Date(),
          lateFeePolicy: lateFeePolicy || Prisma.DbNull,
          ratePlans: {
            create: {
              type: ratePlanType,
              config: ratePlanConfig,
              priority: 100,
            },
          },
          priceComponents: {
            create: componentsData,
          },
        },
      });
    });

    console.log(`✅ Successfully migrated product: ${product.name}`);
  }

  console.log('Migration complete.');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
