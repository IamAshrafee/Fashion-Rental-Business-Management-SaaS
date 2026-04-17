'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Star, SlidersHorizontal } from 'lucide-react';

const CATEGORIES = ["All Stories", "Wedding Guest", "Bridal", "Gala & Black Tie", "Photoshoot", "Cocktail"];

const REVIEWS = [
  {
    id: '1',
    name: 'Ayesha Rahman',
    occasion: 'Wedding Guest',
    quote: "Finding a lehenga that fit perfectly and looked this vibrant was stressing me out until I found this emerald piece. I danced all night, didn't have to worry about the heavy embroidery, and felt absolutely flawless.",
    realImageUrl: 'https://images.unsplash.com/photo-1544457070-4cd773b4d71e?q=80&w=800&auto=format&fit=crop',
    studioImageUrl: 'https://images.unsplash.com/photo-1515347619362-e6fdcee1c56a?q=80&w=800&auto=format&fit=crop',
    productName: 'Emerald Silk Lehenga',
    productSlug: 'emerald-silk-lehenga',
    featured: true,
  },
  {
    id: '2',
    name: 'Sarah Khan',
    occasion: 'Gala & Black Tie',
    quote: "I needed something elegant but not overly traditional. This saree draped beautifully and the silk was incredibly lightweight. The delivery and return process was completely seamless.",
    realImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800&auto=format&fit=crop',
    studioImageUrl: 'https://images.unsplash.com/photo-1550614000-4b95d4edfa22?q=80&w=800&auto=format&fit=crop',
    productName: 'Midnight Onyx Saree',
    productSlug: 'midnight-onyx-saree',
  },
  {
    id: '3',
    name: 'Zara Ahmed',
    occasion: 'Wedding Guest',
    quote: "I got so many compliments! The fit was exactly as described, and it arrived beautifully packaged and perfectly pressed. I've recommended this to all my bridesmaids.",
    realImageUrl: 'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?q=80&w=800&auto=format&fit=crop',
    studioImageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=800&auto=format&fit=crop',
    productName: 'Blush Pink Anarkali',
    productSlug: 'blush-pink-anarkali',
  },
  {
    id: '4',
    name: 'Nadia Chowdhury',
    occasion: 'Photoshoot',
    quote: "The deep maroon color popped perfectly on camera. It was my dream dress for our special shoot, and renting it for a fraction of the cost made so much sense.",
    realImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=800&auto=format&fit=crop',
    studioImageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop',
    productName: 'Maroon Velvet Gown',
    productSlug: 'maroon-velvet-gown',
  },
  {
    id: '5',
    name: 'Tania Hassan',
    occasion: 'Cocktail',
    quote: "The tailoring was impeccable. I loved how easy it was to return the dress the next day. A truly premium service that actually lives up to its promise.",
    realImageUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=800&auto=format&fit=crop',
    studioImageUrl: 'https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?q=80&w=800&auto=format&fit=crop',
    productName: 'Ivory Satin Slip Dress',
    productSlug: 'ivory-satin-slip-dress',
    featured: true,
  },
  {
    id: '6',
    name: 'Farhana Haque',
    occasion: 'Bridal',
    quote: "I was so nervous to rent my actual reception lehenga, but it came looking brand new. It felt like walking out of a dream.",
    realImageUrl: 'https://images.unsplash.com/photo-1551402283-bc8efd559db2?q=80&w=800&auto=format&fit=crop',
    studioImageUrl: 'https://images.unsplash.com/photo-1520639891823-9529cc9b4ae9?q=80&w=800&auto=format&fit=crop',
    productName: 'Crimson Bridal Lehenga',
    productSlug: 'crimson-bridal-lehenga',
  },
  {
    id: '7',
    name: 'Safia Ali',
    occasion: 'Wedding Guest',
    quote: "I usually buy a new outfit for every major wedding, which is so unsustainable. Renting this gorgeous piece completely changed my mindset on occasion wear.",
    realImageUrl: 'https://images.unsplash.com/photo-1526323149755-e7a685cb68b8?q=80&w=800&auto=format&fit=crop',
    studioImageUrl: 'https://images.unsplash.com/photo-1550614000-4b95d4edfa22?q=80&w=800&auto=format&fit=crop',
    productName: 'Teal Embellished Saree',
    productSlug: 'teal-embellished-saree',
  },
  {
    id: '8',
    name: 'Riya K.',
    occasion: 'Gala & Black Tie',
    quote: "Stunning. Period. It fit like a glove and the delivery box itself felt like opening a high-end luxury gift.",
    realImageUrl: 'https://images.unsplash.com/photo-1510520434124-5bc7e642b61d?q=80&w=800&auto=format&fit=crop',
    studioImageUrl: 'https://images.unsplash.com/photo-1544457070-4cd773b4d71e?q=80&w=800&auto=format&fit=crop',
    productName: 'Navy Blue Gown',
    productSlug: 'navy-blue-gown',
  }
];

export default function CommunityPage() {
  const [activeCategory, setActiveCategory] = useState("All Stories");

  const filteredReviews = REVIEWS.filter(r => 
    activeCategory === "All Stories" || r.occasion === activeCategory
  );

  return (
    <div className="bg-gray-50 min-h-screen pb-32">
      
      {/* Editorial Header Section */}
      <section className="bg-white py-24 sm:py-32 relative overflow-hidden border-b border-gray-100">
        <div className="absolute top-0 right-0 h-full w-1/3 bg-brand-50/50 mix-blend-multiply blur-3xl opacity-60"></div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <span className="h-px w-8 bg-brand-300"></span>
              <span className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Community
              </span>
              <span className="h-px w-8 bg-brand-300"></span>
            </div>
            
            <h1 className="font-editorial text-5xl leading-none tracking-tight text-gray-900 md:text-6xl lg:text-7xl">
              The Wardrobe <br/> Diaries
            </h1>
            
            <p className="mt-8 font-sans text-lg md:text-xl font-light leading-relaxed text-gray-600">
              Thousands of rentals. Countless unforgettable nights. 
              Explore the stories and experiences of women who choose to own the moment, not the dress.
            </p>
          </div>
        </div>
      </section>

      {/* Filter / Layout Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-12 mb-16">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          
          {/* Categories Pill list */}
          <div className="flex overflow-x-auto pb-2 scrollbar-hide gap-2 sm:gap-3 w-full md:w-auto">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-5 py-2.5 rounded-full font-sans text-xs font-medium tracking-wide transition-all ${
                  activeCategory === cat 
                  ? 'bg-black text-white shadow-md' 
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-transparent'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 font-medium">
            <SlidersHorizontal className="h-4 w-4" /> Filter
          </div>
        </div>
      </section>

      {/* Masonry Grid Gallery */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {filteredReviews.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500">No stories found for this category yet.</p>
            <button 
              onClick={() => setActiveCategory("All Stories")}
              className="mt-4 underline text-brand-600"
            >
              View all stories
            </button>
          </div>
        ) : (
          <div className="columns-1 gap-6 sm:columns-2 lg:columns-3 xl:gap-8 transition-all">
            {filteredReviews.map((review) => (
              <div 
                key={review.id} 
                className="break-inside-avoid mb-6 xl:mb-8 group cursor-pointer animate-fade-in"
              >
                <div className="flex flex-col gap-5 bg-white p-4 rounded-3xl shadow-sm hover:shadow-xl transition-shadow duration-500">
                  
                  {/* Image Container with Cross-fade interaction */}
                  <div className="relative w-full overflow-hidden rounded-2xl bg-gray-200">
                    <div className={`relative w-full ${review.featured ? 'aspect-[4/5]' : 'aspect-square'}`}>
                      
                      <img 
                        src={review.realImageUrl} 
                        alt={`Worn by ${review.name} at ${review.occasion}`}
                        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out group-hover:opacity-0"
                        loading="lazy"
                      />

                      <img 
                        src={review.studioImageUrl} 
                        alt={`Product ${review.productName}`}
                        className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700 ease-in-out group-hover:opacity-100 scale-105 group-hover:scale-100 transition-transform"
                        loading="lazy"
                      />

                      <div className="absolute inset-0 bg-black/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                      <div className="absolute bottom-4 left-1/2 flex w-[80%] -translate-x-1/2 translate-y-4 items-center justify-center rounded-full bg-white/95 px-4 py-3 opacity-0 shadow-xl backdrop-blur-sm transition-all duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100">
                        <Link 
                          href={`/products/${review.productSlug}`}
                          className="flex items-center gap-2 font-sans text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-black w-full justify-center"
                        >
                          Rent this look <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>

                      <div className="absolute left-4 top-4 transition-opacity duration-300 group-hover:opacity-0">
                        <span className="flex items-center rounded-full bg-white/80 px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-widest text-black backdrop-blur-md shadow-sm">
                          {review.occasion}
                        </span>
                      </div>

                    </div>
                  </div>

                  {/* Content block */}
                  <div className="flex flex-col gap-3 px-2 pb-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className="h-3 w-3 fill-gray-900 text-gray-900" />
                      ))}
                    </div>
                    
                    <blockquote className="font-editorial text-xl italic leading-snug text-gray-900 sm:text-2xl pt-1">
                      "{review.quote}"
                    </blockquote>
                    
                    <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-4">
                      <p className="font-sans text-xs font-medium uppercase tracking-wider text-gray-500">
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
        )}
      </section>

      {/* Footer CTA specifically for Community Page */}
      <section className="mx-auto max-w-4xl px-4 mt-32 mb-16 text-center">
        <h2 className="font-editorial text-4xl text-gray-900">Have a story to share?</h2>
        <p className="mt-4 text-gray-500">Tag us on Instagram to be featured in the Wardrobe Diaries.</p>
        <button className="mt-8 px-8 py-4 bg-black text-white rounded-full font-sans text-sm tracking-widest uppercase hover:bg-gray-800 transition-colors">
          @YourBrandName
        </button>
      </section>

    </div>
  );
}
