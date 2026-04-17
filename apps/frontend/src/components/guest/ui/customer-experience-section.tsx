'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Star } from 'lucide-react';

interface Review {
  id: string;
  name: string;
  occasion: string;
  quote: string;
  realImageUrl: string;
  studioImageUrl: string;
  productName: string;
  productSlug: string;
  featured?: boolean; // If featured, it might be larger
}

const REVIEWS: Review[] = [
  {
    id: '1',
    name: 'Ayesha Rahman',
    occasion: 'Sister\'s Holud',
    quote: "Finding a lehenga that fit perfectly and looked this vibrant was stressing me out until I found this emerald piece. I danced all night, didn't have to worry about the heavy embroidery, and felt absolutely flawless.",
    realImageUrl: 'https://images.unsplash.com/photo-1544457070-4cd773b4d71e?q=80&w=800&auto=format&fit=crop',
    studioImageUrl: 'https://images.unsplash.com/photo-1515347619362-e6fdcee1c56a?q=80&w=800&auto=format&fit=crop', // fallback studio image
    productName: 'Emerald Silk Lehenga',
    productSlug: 'emerald-silk-lehenga',
    featured: true,
  },
  {
    id: '2',
    name: 'Sarah Khan',
    occasion: 'Corporate Gala',
    quote: "I needed something elegant but not overly traditional. This saree draped beautifully and the silk was incredibly lightweight. The delivery and return process was completely seamless.",
    realImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800&auto=format&fit=crop',
    studioImageUrl: 'https://images.unsplash.com/photo-1550614000-4b95d4edfa22?q=80&w=800&auto=format&fit=crop',
    productName: 'Midnight Onyx Saree',
    productSlug: 'midnight-onyx-saree',
  },
  {
    id: '3',
    name: 'Zara Ahmed',
    occasion: 'Best Friend\'s Wedding',
    quote: "I got so many compliments! The fit was exactly as described, and it arrived beautifully packaged and perfectly pressed. I've recommended this to all my bridesmaids.",
    realImageUrl: 'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?q=80&w=800&auto=format&fit=crop',
    studioImageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=800&auto=format&fit=crop',
    productName: 'Blush Pink Anarkali',
    productSlug: 'blush-pink-anarkali',
  },
  {
    id: '4',
    name: 'Nadia Chowdhury',
    occasion: 'Engagement Photoshoot',
    quote: "The deep maroon color popped perfectly on camera. It was my dream dress for our special shoot, and renting it for a fraction of the cost made so much sense.",
    realImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=800&auto=format&fit=crop',
    studioImageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop',
    productName: 'Maroon Velvet Gown',
    productSlug: 'maroon-velvet-gown',
  },
  {
    id: '5',
    name: 'Tania Hassan',
    occasion: 'Anniversary Dinner',
    quote: "The tailoring was impeccable. I loved how easy it was to return the dress the next day. A truly premium service that actually lives up to its promise.",
    realImageUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=800&auto=format&fit=crop',
    studioImageUrl: 'https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?q=80&w=800&auto=format&fit=crop',
    productName: 'Ivory Satin Slip Dress',
    productSlug: 'ivory-satin-slip-dress',
    featured: true,
  }
];

export function CustomerExperienceSection() {
  return (
    <section className="bg-gray-50 py-20 sm:py-32 overflow-hidden">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Editorial Header */}
        <div className="mb-16 max-w-2xl">
          <div className="flex items-center gap-2 mb-6">
            <span className="h-px w-8 bg-brand-300"></span>
            <span className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Community
            </span>
          </div>
          <h2 className="font-editorial text-4xl leading-none tracking-tight text-gray-900 md:text-5xl lg:text-6xl">
            The Wardrobe Diaries
          </h2>
          <p className="mt-6 font-sans text-lg font-light leading-relaxed text-gray-600 max-w-xl">
            Real women, unforgettable moments. Explore our curated collection as worn by our community for their most special occasions.
          </p>
        </div>

        {/* Masonry Grid Layout */}
        {/* Using CSS columns for a true masonry feel without heavy JS */}
        <div className="columns-1 gap-6 sm:columns-2 lg:columns-3 xl:gap-8">
          {REVIEWS.map((review) => (
            <div 
              key={review.id} 
              className="break-inside-avoid mb-6 xl:mb-8 group cursor-pointer"
            >
              <div className="flex flex-col gap-5">
                
                {/* Image Container with Cross-fade interaction */}
                <div className="relative w-full overflow-hidden rounded-2xl bg-gray-200">
                  {/* Aspect ratio trick - height adjusts to content but we give a minimal aspect in case */}
                  <div className={`relative w-full ${review.featured ? 'aspect-[4/5]' : 'aspect-square'}`}>
                    
                    {/* The "Real Life" Photo */}
                    <img 
                      src={review.realImageUrl} 
                      alt={`Worn by ${review.name} at ${review.occasion}`}
                      className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out group-hover:opacity-0"
                      loading="lazy"
                    />

                    {/* The "Studio/Product" Photo that appears on hover */}
                    <img 
                      src={review.studioImageUrl} 
                      alt={`Product ${review.productName}`}
                      className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700 ease-in-out group-hover:opacity-100 scale-105 group-hover:scale-100 transition-transform"
                      loading="lazy"
                    />

                    {/* Hover Overlay "Rent this look" */}
                    <div className="absolute inset-0 bg-black/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    <div className="absolute bottom-4 left-1/2 flex w-[80%] -translate-x-1/2 translate-y-4 items-center justify-center rounded-full bg-white/95 px-4 py-3 opacity-0 shadow-xl backdrop-blur-sm transition-all duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100">
                      <Link 
                        href={`/products/${review.productSlug}`}
                        className="flex items-center gap-2 font-sans text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-black w-full justify-center"
                      >
                        Rent this look <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>

                    {/* Tag / Occasion Floating Pill (Hidden on hover) */}
                    <div className="absolute left-4 top-4 transition-opacity duration-300 group-hover:opacity-0">
                      <span className="flex items-center rounded-full bg-white/80 px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-widest text-black backdrop-blur-md shadow-sm">
                        {review.occasion}
                      </span>
                    </div>

                  </div>
                </div>

                {/* Content block */}
                <div className="flex flex-col gap-3 px-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="h-3 w-3 fill-gray-900 text-gray-900" />
                    ))}
                  </div>
                  
                  {/* Stylized Story Quote */}
                  <blockquote className="font-editorial text-xl italic leading-snug text-gray-900 sm:text-2xl">
                    "{review.quote}"
                  </blockquote>
                  
                  {/* Reviewer Details */}
                  <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-4">
                    <p className="font-sans text-sm font-medium uppercase tracking-wider text-gray-900">
                      {review.name}
                    </p>
                    <Link 
                      href={`/products/${review.productSlug}`}
                      className="font-sans text-xs text-brand-600 underline-offset-4 hover:underline"
                    >
                      {review.productName}
                    </Link>
                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>

        {/* Global CTA */}
        <div className="mt-16 flex justify-center">
          <Link
            href="/community"
            className="group inline-flex items-center gap-2 border-b border-black pb-1 font-sans text-sm font-medium uppercase tracking-widest text-black transition-all hover:text-gray-600 hover:border-gray-600"
          >
            Read More Stories <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

      </div>
    </section>
  );
}
