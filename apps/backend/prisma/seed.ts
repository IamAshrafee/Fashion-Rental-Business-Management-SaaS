import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { SYSTEM_COLORS } from '../src/modules/product/system-colors';

const prisma = new PrismaClient();

// ============================================================================
// Seed Data Constants
// ============================================================================

const DEVELOPMENT_ADMIN_PASSWORD = 'ClosetRent-Local-Admin-2026';

function resolveAdminUser() {
  const production = process.env.NODE_ENV === 'production';
  const email = process.env.SEED_ADMIN_EMAIL?.trim() || (production ? '' : 'admin@closetrent.com');
  const password =
    process.env.SEED_ADMIN_PASSWORD || (production ? '' : DEVELOPMENT_ADMIN_PASSWORD);
  if (!email) throw new Error('SEED_ADMIN_EMAIL is required when seeding production');
  if (!email.includes('@')) throw new Error('SEED_ADMIN_EMAIL must be a valid email address');
  if (password.length < 12)
    throw new Error('SEED_ADMIN_PASSWORD must contain at least 12 characters');
  if (production && password === DEVELOPMENT_ADMIN_PASSWORD) {
    throw new Error('The documented development admin password cannot be used in production');
  }
  return {
    fullName: process.env.SEED_ADMIN_NAME?.trim() || 'Platform Admin',
    email,
    phone: process.env.SEED_ADMIN_PHONE?.trim() || null,
    password,
    role: UserRole.saas_admin,
  };
}

const SUBSCRIPTION_PLANS = [
  {
    name: 'Free',
    slug: 'free',
    description: 'Get started with basics — perfect for trying out the platform.',
    features: ['Up to 20 products', 'Basic analytics', 'Standard support'],
    badge: null,
    priceMonthly: 0,
    priceAnnual: null,
    trialDays: 0,
    maxProducts: 20,
    maxOrders: 50,
    maxStaff: 0,
    maxApiCallsDaily: 10_000,
    maxStorageMb: 1_024,
    maxRpm: 60,
    customDomain: false,
    smsEnabled: false,
    analyticsFull: false,
    removeBranding: false,
    displayOrder: 0,
  },
  {
    name: 'Pro',
    slug: 'pro',
    description: 'For growing businesses — unlimited products and advanced features.',
    features: [
      'Unlimited products',
      'Up to 3 staff',
      'Custom domain',
      'SMS notifications',
      'Full analytics',
    ],
    badge: 'Most Popular',
    priceMonthly: 2500,
    priceAnnual: 25000,
    trialDays: 14,
    maxProducts: null, // unlimited
    maxOrders: null,
    maxStaff: 3,
    maxApiCallsDaily: 250_000,
    maxStorageMb: 10_240,
    maxRpm: 180,
    customDomain: true,
    smsEnabled: true,
    analyticsFull: true,
    removeBranding: false,
    displayOrder: 1,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'Full-featured plan for large operations and premium branding.',
    features: [
      'Unlimited products',
      'Up to 10 staff',
      'Custom domain',
      'SMS notifications',
      'Full analytics',
      'Remove branding',
    ],
    badge: 'Best Value',
    priceMonthly: 7500,
    priceAnnual: 75000,
    trialDays: 14,
    maxProducts: null, // unlimited
    maxOrders: null,
    maxStaff: 10,
    maxApiCallsDaily: null,
    maxStorageMb: 51_200,
    maxRpm: 600,
    customDomain: true,
    smsEnabled: true,
    analyticsFull: true,
    removeBranding: true,
    displayOrder: 2,
  },
];

const STARTER_TEMPLATE = {
  templateName: 'Fashion Rental',
  data: {
    categories: [
      {
        name: 'Saree',
        subcategories: ['Banarasi', 'Silk', 'Cotton', 'Designer'],
      },
      {
        name: 'Lehenga',
        subcategories: ['Bridal', 'Party', 'Designer'],
      },
      {
        name: 'Gown',
        subcategories: ['Evening', 'Ball', 'Cocktail'],
      },
      {
        name: 'Sherwani',
        subcategories: ['Wedding', 'Party'],
      },
      {
        name: 'Jewelry',
        subcategories: ['Necklace', 'Earrings', 'Bangles', 'Set'],
      },
      {
        name: 'Accessories',
        subcategories: ['Clutch', 'Shoes', 'Dupatta'],
      },
    ],
    events: [
      'Wedding',
      'Holud',
      'Reception',
      'Engagement',
      'Eid',
      'Birthday',
      'Anniversary',
      'Party',
      'Corporate Event',
      'Photoshoot',
      'Prom',
    ],
    storeSettings: {
      timezone: 'Asia/Dhaka',
      country: 'BD',
      currencyCode: 'BDT',
      currencySymbol: '৳',
      dateFormat: 'DD/MM/YYYY',
      weekStart: 'saturday',
      bufferDays: 1,
    },
  },
};

// ============================================================================
// Main Seed Function
// ============================================================================

async function main() {
  console.log('🌱 Seeding database...\n');

  const adminUser = resolveAdminUser();
  const saltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
  if (!Number.isInteger(saltRounds) || saltRounds < 10 || saltRounds > 14) {
    throw new Error('BCRYPT_SALT_ROUNDS must be an integer between 10 and 14');
  }

  // 1. Create SaaS admin user
  console.log('1. Creating SaaS admin user...');
  const passwordHash = await bcrypt.hash(adminUser.password, saltRounds);
  await prisma.user.upsert({
    where: { email: adminUser.email },
    update: {
      fullName: adminUser.fullName,
      phone: adminUser.phone,
      passwordHash,
      role: adminUser.role,
      isActive: true,
    },
    create: {
      fullName: adminUser.fullName,
      email: adminUser.email,
      phone: adminUser.phone,
      passwordHash,
      role: adminUser.role,
    },
  });
  console.log(`   ✅ Admin: ${adminUser.email}\n`);

  // 2. Create subscription plans
  console.log('2. Creating subscription plans...');
  for (const plan of SUBSCRIPTION_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        description: plan.description,
        features: plan.features,
        badge: plan.badge,
        priceMonthly: plan.priceMonthly,
        priceAnnual: plan.priceAnnual,
        trialDays: plan.trialDays,
        maxProducts: plan.maxProducts,
        maxOrders: plan.maxOrders,
        maxStaff: plan.maxStaff,
        maxApiCallsDaily: plan.maxApiCallsDaily,
        maxStorageMb: plan.maxStorageMb,
        maxRpm: plan.maxRpm,
        customDomain: plan.customDomain,
        smsEnabled: plan.smsEnabled,
        analyticsFull: plan.analyticsFull,
        removeBranding: plan.removeBranding,
        isActive: true,
        displayOrder: plan.displayOrder,
      },
      create: {
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        features: plan.features,
        badge: plan.badge,
        priceMonthly: plan.priceMonthly,
        priceAnnual: plan.priceAnnual,
        trialDays: plan.trialDays,
        maxProducts: plan.maxProducts,
        maxOrders: plan.maxOrders,
        maxStaff: plan.maxStaff,
        maxApiCallsDaily: plan.maxApiCallsDaily,
        maxStorageMb: plan.maxStorageMb,
        maxRpm: plan.maxRpm,
        customDomain: plan.customDomain,
        smsEnabled: plan.smsEnabled,
        analyticsFull: plan.analyticsFull,
        removeBranding: plan.removeBranding,
        displayOrder: plan.displayOrder,
      },
    });
    console.log(`   ✅ Plan: ${plan.name} (৳${plan.priceMonthly}/mo)`);
  }
  console.log('');

  // 3. Create system colors
  console.log('3. Creating system colors...');
  let colorCount = 0;
  for (const color of SYSTEM_COLORS) {
    await prisma.color.upsert({
      where: { systemKey: color.key },
      update: { name: color.name, hexCode: color.hexCode, isSystem: true },
      create: {
        systemKey: color.key,
        name: color.name,
        hexCode: color.hexCode,
        isSystem: true,
        tenantId: null,
      },
    });
    colorCount++;
  }
  console.log(`   ✅ ${colorCount} system colors seeded\n`);

  // 4. Create starter template
  console.log('4. Creating starter templates...');
  await prisma.starterTemplate.upsert({
    where: { templateName: STARTER_TEMPLATE.templateName },
    update: { data: STARTER_TEMPLATE.data, isActive: true },
    create: {
      templateName: STARTER_TEMPLATE.templateName,
      data: STARTER_TEMPLATE.data,
      isActive: true,
    },
  });
  console.log(`   ✅ Template: ${STARTER_TEMPLATE.templateName}\n`);

  console.log('🎉 Seed complete!');
}

// ============================================================================
// Execute
// ============================================================================

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
