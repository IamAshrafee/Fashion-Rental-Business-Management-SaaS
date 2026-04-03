import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Store,
  Package,
  Calendar,
  BarChart3,
  Users,
  Truck,
  Shield,
  Globe,
  ArrowRight,
  Star,
  Sparkles,
  CheckCircle2,
  Zap,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'ClosetRent — Launch Your Fashion Rental Business',
  description:
    'The all-in-one SaaS platform to launch, manage, and scale your fashion rental business. Product catalogs, booking management, customer tracking, courier integration, and more.',
};

// ─────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Package,
    title: 'Product Catalog',
    description:
      'Rich product listings with multiple variants, colour swatches, size charts, and professional image galleries.',
  },
  {
    icon: Calendar,
    title: 'Smart Booking System',
    description:
      'Real-time availability calendar, automatic date blocking, buffer days, and conflict-free booking management.',
  },
  {
    icon: Users,
    title: 'Customer Management',
    description:
      'Complete customer profiles with booking history, spend tracking, tags, and communication preferences.',
  },
  {
    icon: Truck,
    title: 'Courier Integration',
    description:
      'Automated pickup scheduling, real-time tracking, and seamless delivery management with Pathao and more.',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description:
      'Revenue insights, popular product tracking, customer analytics, and actionable business intelligence.',
  },
  {
    icon: Shield,
    title: 'Damage & Deposit',
    description:
      'Systematic return inspection, damage reporting with photo evidence, and automated deposit management.',
  },
  {
    icon: Globe,
    title: 'Your Own Storefront',
    description:
      'Branded storefront on your subdomain or custom domain. Your customers see YOUR brand, not ours.',
  },
  {
    icon: Store,
    title: 'Multi-Store Ready',
    description:
      'Complete tenant isolation — every store has its own data, branding, settings, and customer base.',
  },
];

const pricingPlans = [
  {
    name: 'Starter',
    price: 'Free',
    period: 'forever',
    description: 'Perfect for getting started',
    features: [
      'Up to 20 products',
      'Your own subdomain',
      'Basic booking management',
      'Customer management',
      'Mobile-responsive storefront',
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '৳999',
    period: '/month',
    description: 'For growing rental businesses',
    badge: 'Most Popular',
    features: [
      'Up to 200 products',
      'Custom domain support',
      'Advanced analytics',
      'Courier integration',
      'Staff accounts (up to 3)',
      'SMS notifications',
      'Priority support',
    ],
    cta: 'Start 14-Day Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '৳2,499',
    period: '/month',
    description: 'For established businesses',
    features: [
      'Unlimited products',
      'Custom domain',
      'Full analytics suite',
      'All courier integrations',
      'Unlimited staff accounts',
      'Remove ClosetRent branding',
      'Dedicated support',
      'API access',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

const testimonials = [
  {
    name: 'Sara Rahman',
    business: 'Rent by Sara',
    quote:
      'ClosetRent transformed my rental business. I went from managing everything on spreadsheets to a fully automated system in one afternoon.',
    rating: 5,
  },
  {
    name: 'Fahim Ahmed',
    business: 'DressUp BD',
    quote:
      'The booking calendar alone saved me hours every week. No more double bookings, no more missed returns. My customers love the storefront.',
    rating: 5,
  },
  {
    name: 'Nadia Islam',
    business: 'Nadia\'s Closet',
    quote:
      'The courier integration is a game-changer. Automated pickup scheduling and real-time tracking — my customers are always happy.',
    rating: 5,
  },
];

const stats = [
  { value: '500+', label: 'Active Stores' },
  { value: '50K+', label: 'Bookings Processed' },
  { value: '99.9%', label: 'Uptime' },
  { value: '4.9/5', label: 'Store Rating' },
];

// ─────────────────────────────────────────────────────────────────────
// No-Store Error Banner (shown when redirected from tenant-only paths)
// ─────────────────────────────────────────────────────────────────────

import { NoStoreBanner } from './no-store-banner';

// ─────────────────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white" style={{ colorScheme: 'light' }}>
      {/* Error banner — shown when user tried to access tenant-only routes on bare domain */}
      <NoStoreBanner />
      {/* ────────────────────────────────────────────────────────────────
          NAVIGATION
          ──────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-gray-900">
              ClosetRent
            </span>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
              Features
            </a>
            <a href="#pricing" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
              Pricing
            </a>
            <a href="#testimonials" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
              Testimonials
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow-md"
            >
              Get Started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ────────────────────────────────────────────────────────────────
          HERO SECTION
          ──────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-indigo-50/30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100/40 via-transparent to-transparent" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke='rgb(15 23 42)'%3e%3cpath d='M0 .5H31.5V32'/%3e%3c/svg%3e")`,
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:px-8 lg:pb-36 lg:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
              <Zap className="h-3.5 w-3.5" />
              Launch your rental store in minutes
            </div>

            <h1 className="font-display text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl xl:text-7xl">
              The Platform for{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                Fashion Rental
              </span>{' '}
              Businesses
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl">
              Everything you need to run a professional fashion rental business —
              product catalog, booking system, customer management, courier
              integration, and a beautiful storefront. All under your own brand.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-8 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-gray-900/20 transition-all hover:bg-gray-800 hover:shadow-xl hover:shadow-gray-900/25"
              >
                Create Your Store <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-8 py-4 text-sm font-bold uppercase tracking-wider text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
              >
                See How It Works
              </a>
            </div>

            {/* Social proof */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              {stats.map((stat) => (
                <div key={stat.label} className="flex items-center gap-1.5">
                  <span className="font-bold text-gray-900">{stat.value}</span>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────
          FEATURES SECTION
          ──────────────────────────────────────────────────────────────── */}
      <section id="features" className="border-t border-gray-100 bg-gray-50/50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
              Everything You Need
            </p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Built for Fashion Rental Businesses
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              From product listing to order delivery — every tool you need in one platform.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-gray-200 hover:shadow-lg"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white transition-colors group-hover:bg-indigo-600">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-bold text-gray-900">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-500">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────
          HOW IT WORKS
          ──────────────────────────────────────────────────────────────── */}
      <section className="border-t border-gray-100 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
              Simple Setup
            </p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Launch in 3 Steps
            </h2>
          </div>

          <div className="mx-auto mt-16 grid max-w-4xl gap-8 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Create Your Store',
                description:
                  'Pick your subdomain, set up your brand colors and logo, and your professional storefront is live instantly.',
              },
              {
                step: '02',
                title: 'Add Your Products',
                description:
                  'Upload your fashion items with variants, sizes, pricing tiers, and beautiful photo galleries.',
              },
              {
                step: '03',
                title: 'Start Renting',
                description:
                  'Share your store link. Customers browse, book, and pay. You manage everything from your dashboard.',
              },
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 font-display text-xl font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-bold text-gray-900">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────
          PRICING SECTION
          ──────────────────────────────────────────────────────────────── */}
      <section id="pricing" className="border-t border-gray-100 bg-gray-50/50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
              Pricing
            </p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Plans That Grow With You
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Start free. Upgrade when you&apos;re ready. No surprises.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-6 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-300 ${
                  plan.highlighted
                    ? 'z-10 scale-[1.02] border-indigo-200 bg-white shadow-xl shadow-indigo-100/50 ring-1 ring-indigo-100 lg:scale-105'
                    : 'border-gray-100 bg-white shadow-sm hover:shadow-md'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">{plan.description}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold tracking-tight text-gray-900">
                      {plan.price}
                    </span>
                    <span className="text-sm text-gray-500">{plan.period}</span>
                  </div>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-sm text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={`inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-bold transition-all ${
                    plan.highlighted
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 hover:shadow-lg'
                      : 'border border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────
          TESTIMONIALS
          ──────────────────────────────────────────────────────────────── */}
      <section id="testimonials" className="border-t border-gray-100 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
              Testimonials
            </p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Loved by Rental Businesses
            </h2>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <div className="mb-3 flex gap-0.5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
                <blockquote className="mb-4 flex-1 text-sm leading-relaxed text-gray-600">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div>
                  <p className="text-sm font-bold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.business}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────
          CTA SECTION
          ──────────────────────────────────────────────────────────────── */}
      <section className="border-t border-gray-100">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gray-900 px-8 py-16 text-center shadow-2xl sm:px-16 sm:py-20">
            {/* Background accents */}
            <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-indigo-600/20 blur-3xl" />
            <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl" />

            <div className="relative">
              <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Ready to Launch Your Rental Business?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-gray-300">
                Join hundreds of fashion rental entrepreneurs who chose ClosetRent
                to power their business. Start free, no credit card required.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-sm font-bold uppercase tracking-wider text-gray-900 shadow-lg transition-all hover:bg-gray-100 hover:shadow-xl"
                >
                  Create Free Store <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────
          FOOTER
          ──────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-900">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-display text-lg font-bold text-gray-900">
                ClosetRent
              </span>
            </div>

            <div className="flex gap-6 text-sm text-gray-500">
              <a href="#features" className="transition-colors hover:text-gray-700">
                Features
              </a>
              <a href="#pricing" className="transition-colors hover:text-gray-700">
                Pricing
              </a>
              <Link href="/login" className="transition-colors hover:text-gray-700">
                Sign In
              </Link>
            </div>

            <p className="text-xs text-gray-400">
              © {new Date().getFullYear()} ClosetRent. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
