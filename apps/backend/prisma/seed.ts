import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ============================================================================
// Seed Data Constants
// ============================================================================

const ADMIN_USER = {
  fullName: 'Platform Admin',
  email: 'admin@closetrent.com',
  phone: '+8801700000000',
  password: 'ClosetRent@2026!',
  role: UserRole.saas_admin,
};

const SUBSCRIPTION_PLANS = [
  {
    name: 'Free',
    slug: 'free',
    priceMonthly: 0,
    priceAnnual: null,
    maxProducts: 20,
    maxStaff: 0,
    customDomain: false,
    smsEnabled: false,
    analyticsFull: false,
    removeBranding: false,
    displayOrder: 0,
  },
  {
    name: 'Pro',
    slug: 'pro',
    priceMonthly: 2500,
    priceAnnual: 25000,
    maxProducts: null, // unlimited
    maxStaff: 3,
    customDomain: true,
    smsEnabled: true,
    analyticsFull: true,
    removeBranding: false,
    displayOrder: 1,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    priceMonthly: 7500,
    priceAnnual: 75000,
    maxProducts: null, // unlimited
    maxStaff: 10,
    customDomain: true,
    smsEnabled: true,
    analyticsFull: true,
    removeBranding: true,
    displayOrder: 2,
  },
];

const SYSTEM_COLORS = [
  { name: 'Red', hex: '#EF4444' },
  { name: 'Maroon', hex: '#7F1D1D' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Rose', hex: '#F43F5E' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Gold', hex: '#EAB308' },
  { name: 'Yellow', hex: '#FACC15' },
  { name: 'Green', hex: '#22C55E' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Navy', hex: '#1E3A5F' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Violet', hex: '#8B5CF6' },
  { name: 'Magenta', hex: '#D946EF' },
  { name: 'Brown', hex: '#92400E' },
  { name: 'Beige', hex: '#D4A574' },
  { name: 'Cream', hex: '#FFFDD0' },
  { name: 'Ivory', hex: '#FFFFF0' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Off-White', hex: '#FAF9F6' },
  { name: 'Silver', hex: '#C0C0C0' },
  { name: 'Grey', hex: '#6B7280' },
  { name: 'Charcoal', hex: '#374151' },
  { name: 'Black', hex: '#000000' },
  { name: 'Peach', hex: '#FFDAB9' },
  { name: 'Coral', hex: '#FF7F50' },
  { name: 'Salmon', hex: '#FA8072' },
  { name: 'Burgundy', hex: '#800020' },
  { name: 'Wine', hex: '#722F37' },
  { name: 'Rust', hex: '#B7410E' },
  { name: 'Copper', hex: '#B87333' },
  { name: 'Bronze', hex: '#CD7F32' },
  { name: 'Olive', hex: '#808000' },
  { name: 'Mint', hex: '#98FF98' },
  { name: 'Lavender', hex: '#E6E6FA' },
  { name: 'Lilac', hex: '#C8A2C8' },
  { name: 'Sky Blue', hex: '#87CEEB' },
  { name: 'Baby Pink', hex: '#F4C2C2' },
  { name: 'Multi-Color', hex: '#GRADIENT' },
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
      defaultBufferDays: 1,
      bookingExpiryHours: 48,
      cancellationPolicy: 'free_before_shipped',
    },
  },
};

// ============================================================================
// Main Seed Function
// ============================================================================

async function main() {
  console.log('🌱 Seeding database...\n');

  // 1. Create SaaS admin user
  console.log('1. Creating SaaS admin user...');
  const passwordHash = await bcrypt.hash(ADMIN_USER.password, 10);
  await prisma.user.upsert({
    where: { email: ADMIN_USER.email },
    update: {},
    create: {
      fullName: ADMIN_USER.fullName,
      email: ADMIN_USER.email,
      phone: ADMIN_USER.phone,
      passwordHash,
      role: ADMIN_USER.role,
    },
  });
  console.log(`   ✅ Admin: ${ADMIN_USER.email}\n`);

  // 2. Create subscription plans
  console.log('2. Creating subscription plans...');
  for (const plan of SUBSCRIPTION_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        priceAnnual: plan.priceAnnual,
        maxProducts: plan.maxProducts,
        maxStaff: plan.maxStaff,
        customDomain: plan.customDomain,
        smsEnabled: plan.smsEnabled,
        analyticsFull: plan.analyticsFull,
        removeBranding: plan.removeBranding,
        displayOrder: plan.displayOrder,
      },
      create: {
        name: plan.name,
        slug: plan.slug,
        priceMonthly: plan.priceMonthly,
        priceAnnual: plan.priceAnnual,
        maxProducts: plan.maxProducts,
        maxStaff: plan.maxStaff,
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
      where: {
        name_tenantId: { name: color.name, tenantId: '' },
      },
      update: { hexCode: color.hex },
      create: {
        name: color.name,
        hexCode: color.hex,
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
    update: { data: STARTER_TEMPLATE.data },
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
