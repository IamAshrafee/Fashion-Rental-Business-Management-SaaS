'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles, Package, ShieldCheck } from 'lucide-react';

export function ExclusiveInvitationCTA() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gray-950 px-6 py-16 sm:px-12 sm:py-24 lg:px-16 text-center text-white shadow-2xl">
          {/* Subtle Background Glow/Texture */}
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-brand-500/20 opacity-50 blur-[100px]" />
          
          <div className="relative z-10 flex flex-col items-center">
            {/* Sub-heading / Social Proof */}
            <div className="mb-6 flex items-center justify-center gap-3">
              <span className="h-px w-6 bg-white/30 sm:w-10"></span>
              <span className="font-sans text-[10px] sm:text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
                Join 10,000+ women redefining their wardrobe
              </span>
              <span className="h-px w-6 bg-white/30 sm:w-10"></span>
            </div>

            {/* Headline */}
            <h2 className="font-editorial mb-8 max-w-2xl text-[clamp(2.25rem,5vw,4rem)] leading-[1.05] tracking-tight">
              Your Dream Closet, Unlocked.
            </h2>

            {/* Primary CTA */}
            <Link
              href="/products"
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-8 py-4 font-sans text-sm sm:text-base font-bold uppercase tracking-widest text-black transition-all hover:bg-gray-100 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:scale-105 duration-300"
            >
              <span className="relative z-10">Explore the Collection</span>
              <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>

            {/* Trust Markers */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 font-sans text-xs sm:text-sm font-medium tracking-wide text-white/70">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-white/90" />
                <span>Dry Cleaning Included</span>
              </div>
              <span className="hidden h-1 w-1 rounded-full bg-white/20 sm:block"></span>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-white/90" />
                <span>Doorstep Delivery</span>
              </div>
              <span className="hidden h-1 w-1 rounded-full bg-white/20 sm:block"></span>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-white/90" />
                <span>Perfect Fit Guarantee</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
