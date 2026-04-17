'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const steps = [
  {
    id: 1,
    title: 'Discover & Book',
    description: 'Find your dream look for the big day. Book it for your dates directly from our curated collections.',
    image: 'https://images.unsplash.com/photo-1542488858-a5d6f1ba0f77?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 2,
    title: 'Fresh & Ready',
    description: 'Delivered to your door, perfectly dry-cleaned, ironed, and ready to wear. We guarantee pristine condition.',
    image: 'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 3,
    title: 'Own the Moment',
    description: 'Look stunning and make memories. The spotlight is yours. No stress about outfit repeating.',
    image: 'https://images.unsplash.com/photo-1510832198440-a52376950479?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 4,
    title: 'Effortless Return',
    description: 'We pick it up. No washing or dry-cleaning required. Just pack it back in our premium garment bag.',
    image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=800&auto=format&fit=crop',
  },
];

function DesktopRentalJourney() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  return (
    <div 
      ref={containerRef} 
      className="hidden w-full lg:block"
    >
      <div className="mx-auto flex max-w-7xl flex-row">
        
        {/* Sticky Visual Side */}
        <div className="sticky top-0 z-0 flex h-screen w-1/2 items-center justify-center p-8">
          <div className="relative h-full w-full overflow-hidden rounded-[24px] bg-gray-200 shadow-2xl">
            {steps.map((step, index) => {
              const start = index * 0.25;
              const end = (index + 1) * 0.25;
              
              let input, output;
              if (index === 0) {
                input = [0, end, end + 0.05];
                output = [1, 1, 0];
              } else if (index === steps.length - 1) {
                input = [start - 0.05, start, 1];
                output = [0, 1, 1];
              } else {
                input = [start - 0.05, start, end, end + 0.05];
                output = [0, 1, 1, 0];
              }

              const opacity = useTransform(scrollYProgress, input, output);

              return (
                <motion.div
                  key={step.id}
                  style={{ opacity }}
                  className="absolute inset-0 h-full w-full"
                >
                  <img
                    src={step.image}
                    alt={step.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Scrollable Text Side */}
        <div className="relative z-10 w-1/2">
          <div className="pb-[25vh] pt-[25vh]">
            {steps.map((step, index) => {
              const start = index * 0.25;
              const end = (index + 1) * 0.25;
              const mid = start + 0.125;
              
              const inputOpacity = 
                index === 0 ? [0, mid, end, end + 0.1] : 
                index === steps.length - 1 ? [start - 0.1, start, mid, 1] : 
                [start - 0.1, start, mid, end, end + 0.1];
                
              const outputOpacity = 
                index === 0 ? [1, 1, 0.15, 0.15] : 
                index === steps.length - 1 ? [0.15, 1, 1, 1] : 
                [0.15, 1, 1, 0.15, 0.15];

              const opacity = useTransform(scrollYProgress, inputOpacity, outputOpacity);
              
              const inputY = 
                index === 0 ? [0, mid, end] : 
                index === steps.length - 1 ? [start - 0.1, start, 1] :
                [start - 0.1, start, mid, end];
                
              const outputY = 
                index === 0 ? [0, 0, -40] : 
                index === steps.length - 1 ? [40, 0, 0] :
                [40, 0, 0, -40];

              const y = useTransform(scrollYProgress, inputY, outputY);

              return (
                <div 
                  key={step.id} 
                  className="flex min-h-[75vh] flex-col justify-center px-16"
                >
                  <motion.div style={{ opacity, y }} className="max-w-md">
                    <span className="mb-4 inline-block rounded-full bg-brand-100 px-4 py-1.5 font-sans text-xs font-semibold uppercase tracking-widest text-[#937B69]">
                      Step 0{step.id}
                    </span>
                    <h3 className="font-editorial mb-4 text-5xl leading-tight text-gray-900">
                      {step.title}
                    </h3>
                    <p className="font-sans text-lg font-light leading-relaxed text-gray-600">
                      {step.description}
                    </p>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

function MobileRentalJourney() {
  return (
    <div className="flex w-full flex-col gap-16 py-16 lg:hidden">
      {/* Optional Top Intro specific for Mobile */}
      <div className="px-6 text-center">
        <h2 className="font-editorial text-4xl text-gray-900">How it Works</h2>
        <p className="mt-2 font-sans text-sm font-light text-gray-500">Your seamless rental experience</p>
      </div>

      <div className="flex flex-col gap-12">
        {steps.map((step, index) => (
          <div key={step.id} className="relative w-full px-4 sm:px-8">
            
            {/* Visual Top Area */}
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl shadow-xl bg-gray-100">
              <img 
                src={step.image} 
                className="h-full w-full object-cover" 
                alt={step.title} 
                loading="lazy" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
            </div>
            
            {/* Context Bottom Area */}
            <div className="mt-6 flex flex-col px-2">
              <span className="mb-3 w-fit rounded-full bg-[#937B69]/10 px-3 py-1 font-sans text-[10px] font-bold uppercase tracking-widest text-[#937B69]">
                Step 0{step.id} / 0{steps.length}
              </span>
              <h3 className="font-editorial mb-3 text-3xl leading-tight text-gray-900">
                {step.title}
              </h3>
              <p className="font-sans text-[15px] font-light leading-relaxed text-gray-600">
                {step.description}
              </p>
            </div>

            {/* Connecting Line (except on last) */}
            {index < steps.length - 1 && (
              <div className="absolute -bottom-8 left-10 hidden h-8 w-px border-l-2 border-dashed border-gray-200 sm:block"></div>
            )}
            
          </div>
        ))}
      </div>
    </div>
  );
}

export function RentalJourneySection() {
  return (
    <section className="relative w-full bg-[#F9F8F6]">
      <DesktopRentalJourney />
      <MobileRentalJourney />
    </section>
  );
}
