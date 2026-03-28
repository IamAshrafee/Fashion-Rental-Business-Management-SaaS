'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useCart } from '@/hooks/use-cart';
import { useLocale } from '@/hooks/use-locale';
import { ChevronRight, Heart, Share2, Plus, Minus, Info } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ProductCard } from '@/components/guest/ui/product-card';

// Dummy product for scaffolding the PDP
const product = {
  id: 'p_12345',
  slug: 'royal-banarasi-saree',
  name: 'Royal Banarasi Saree',
  category: 'Saree',
  subcategory: 'Banarasi',
  events: ['Wedding', 'Reception'],
  basePrice: 7500, // For 3 days standard
  extendedPrice: 500, // Per extra day
  deposit: 5000,
  description: 'Exquisite Banarasi silk saree with intricate zari work. Perfect for brides looking for a traditional yet regal appearance. Woven by master artisans in Varanasi.',
  fabricDetails: 'Pure Banarasi Silk, Zari woven',
  careInstructions: 'Dry clean only. Store in muslin cloth.',
  images: [
    '/placeholder-saree.jpg',
    '/placeholder-saree-red.jpg',
    '/placeholder-saree-gold.jpg',
    '/placeholder-lehenga.jpg',
  ],
  variants: [
    { id: 'v_red', name: 'Crimson Red', colorHex: '#ef4444', imageUrl: '/placeholder-saree-red.jpg' },
    { id: 'v_gold', name: 'Royal Gold', colorHex: '#fbbf24', imageUrl: '/placeholder-saree-gold.jpg' },
    { id: 'v_blue', name: 'Navy Blue', colorHex: '#1e3a8a', imageUrl: '/placeholder-saree.jpg' },
  ],
  sizeInfo: {
    chest: '38 inch',
    waist: '32 inch',
    length: '42 inch'
  },
  services: {
    tryOn: { available: true, price: 1000 },
    backupSize: { available: true, price: 300 },
  }
};

export default function GuestProductDetailPage() {
  const { slug } = useParams();
  const { formatPrice } = useLocale();
  const { addItem } = useCart();
  
  // State
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(product.variants[0]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [addTryOn, setAddTryOn] = useState(false);
  const [addBackup, setAddBackup] = useState(false);
  const [selectedBackupSize, setSelectedBackupSize] = useState('M');

  // Simple Accordion State
  const [openAccordion, setOpenAccordion] = useState<string | null>('fabric');

  const toggleAccordion = (id: string) => {
    setOpenAccordion(prev => prev === id ? null : id);
  };

  const handleVariantSelect = (variant: typeof product.variants[0]) => {
    setSelectedVariant(variant);
    const imgIndex = product.images.findIndex(img => img === variant.imageUrl);
    if (imgIndex !== -1) setActiveImage(imgIndex);
  };

  // Calculations
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const days = start && end && end > start ? Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) : 0;
  
  // Custom business logic: Base price covers 3 days, then it's extended price per day
  const rentalPrice = days > 3 
      ? product.basePrice + ((days - 3) * product.extendedPrice)
      : product.basePrice;

  const servicesPrice = (addTryOn ? product.services.tryOn.price : 0) + (addBackup ? product.services.backupSize.price : 0);
  const totalPrice = rentalPrice + product.deposit + servicesPrice;

  const isFormValid = startDate !== '' && endDate !== '' && days > 0;

  const handleAddToCart = () => {
    if (!isFormValid) return;
    
    addItem({
      productId: product.id,
      variantId: selectedVariant.id,
      productName: product.name,
      categoryName: product.category,
      featuredImage: product.images[activeImage],
      basePrice: rentalPrice,
      deposit: product.deposit,
      startDate,
      endDate,
      durationDays: days,
      serviceMap: {
        tryOn: addTryOn,
        backupSize: addBackup ? selectedBackupSize : null,
      },
      totalPrice,
    });
    
    // Smooth scroll to top or trigger toast (we don't have shadcn toasts locally available but could use a standard alert for now or let the useCart badge update indicate success)
    alert(`Added ${product.name} to cart! Total: ${formatPrice(totalPrice)}`);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      
      {/* Breadcrumbs */}
      <nav className="mb-6 flex items-center text-sm text-gray-500">
        <Link href="/products" className="hover:text-black">Products</Link>
        <ChevronRight className="mx-2 h-4 w-4" />
        <Link href={`/category/${product.category.toLowerCase()}`} className="hover:text-black">{product.category}</Link>
        <ChevronRight className="mx-2 h-4 w-4" />
        <span className="text-gray-900">{product.name}</span>
      </nav>

      <div className="flex flex-col gap-12 lg:flex-row">
        
        {/* Left Col: Images */}
        <div className="flex w-full flex-col gap-4 lg:w-[55%]">
          {/* Main Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-100">
            <img 
              src={product.images[activeImage]} 
              alt={product.name} 
              className="h-full w-full object-cover transition-all"
            />
            <div className="absolute right-4 top-4 flex flex-col gap-2">
              <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-black shadow-sm backdrop-blur hover:bg-white">
                <Heart className="h-5 w-5" />
              </button>
              <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-black shadow-sm backdrop-blur hover:bg-white">
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Thumbnails */}
          <div className="grid grid-cols-4 gap-2 sm:gap-4 flex-nowrap overflow-x-auto no-scrollbar pb-2">
            {product.images.map((img, idx) => (
              <button 
                key={idx}
                type="button"
                onClick={() => setActiveImage(idx)}
                className={cn(
                  "relative aspect-[3/4] w-full overflow-hidden bg-gray-100 border-[2px] transition-all flex-shrink-0 min-w-[70px]",
                  activeImage === idx ? "border-black" : "border-transparent hover:border-gray-300"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={`Thumbnail ${idx}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Right Col: Details Configuration */}
        <div className="flex w-full flex-col lg:w-[45%]">
          <div className="mb-2 flex flex-wrap gap-2">
             {product.events.map(event => (
               <span key={event} className="bg-gray-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-gray-700">{event}</span>
             ))}
          </div>
          
          <h1 className="font-display text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">{product.name}</h1>
          <p className="mt-2 text-sm text-gray-500">{product.category} › {product.subcategory}</p>

          <div className="mt-6 flex flex-col">
            <div className="flex items-end gap-3 text-brand-primary">
              <span className="text-3xl font-bold leading-none">{formatPrice(product.basePrice)}</span>
              <span className="mb-1 text-sm font-medium text-gray-500">/ 3 days included</span>
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> {formatPrice(product.extendedPrice)}/extra day</span>
              <span className="flex items-center gap-1"><Info className="h-3 w-3 text-orange-500" /> Deposit: {formatPrice(product.deposit)}</span>
            </div>
          </div>

          <hr className="my-8 border-gray-200" />

          {/* Configuration Forms */}
          <div className="flex flex-col gap-8">
            
            {/* Variants */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium uppercase tracking-wider text-gray-900">Color</h3>
                <span className="text-sm text-gray-500">{selectedVariant.name}</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {product.variants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => handleVariantSelect(variant)}
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all hover:scale-105",
                      selectedVariant.id === variant.id ? "border-black p-0.5" : "border-transparent p-0"
                    )}
                  >
                    <span 
                      className="h-full w-full rounded-full border border-black/10 shadow-inner"
                      style={{ backgroundColor: variant.colorHex }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Size Configuration */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium uppercase tracking-wider text-gray-900">Measurements</h3>
                <button type="button" className="text-sm font-medium text-gray-500 underline hover:text-black">Size Guide</button>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-4 border border-gray-100">
                 {Object.entries(product.sizeInfo).map(([key, value]) => (
                   <div key={key} className="flex flex-col">
                     <span className="text-xs uppercase text-gray-500">{key}</span>
                     <span className="font-medium text-gray-900">{value}</span>
                   </div>
                 ))}
              </div>
            </div>

            {/* Date Selection */}
            <div>
              <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-900">Rental Dates</h3>
              <div className="flex flex-col gap-3 sm:flex-row">
                 <div className="flex flex-1 flex-col">
                   <label className="mb-1 text-xs text-gray-500">Pick-up Date</label>
                   <input 
                     type="date"
                     className="w-full rounded-none border border-gray-300 bg-white p-3 text-sm focus:border-black focus:ring-0"
                     value={startDate}
                     onChange={(e) => setStartDate(e.target.value)}
                     min={new Date().toISOString().split('T')[0]}
                   />
                 </div>
                 <div className="flex flex-1 flex-col">
                   <label className="mb-1 text-xs text-gray-500">Return Date</label>
                   <input 
                     type="date"
                     className="w-full rounded-none border border-gray-300 bg-white p-3 text-sm focus:border-black focus:ring-0"
                     value={endDate}
                     onChange={(e) => setEndDate(e.target.value)}
                     min={startDate || new Date().toISOString().split('T')[0]}
                   />
                 </div>
              </div>
              
              {days > 0 && (
                <div className="mt-3 flex items-center justify-between rounded bg-green-50 px-4 py-2 text-sm text-green-800 border border-green-200">
                  <span>Duration: <strong>{days} days</strong></span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span> Available</span>
                </div>
              )}
            </div>

            {/* Extra Services */}
            <div>
              <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-900">Enhance Your Experience</h3>
              <label className={cn(
                  "mb-3 flex cursor-pointer items-start gap-4 border p-4 transition-colors", 
                  addTryOn ? "border-black bg-gray-50" : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex h-5 items-center">
                  <input type="checkbox" className="h-5 w-5 border-gray-300 text-black focus:ring-black rounded shadow-sm" checked={addTryOn} onChange={e => setAddTryOn(e.target.checked)} />
                </div>
                <div className="flex flex-1 flex-col">
                  <span className="font-medium text-gray-900 flex justify-between">
                    Try before renting <span>+{formatPrice(product.services.tryOn.price)}</span>
                  </span>
                  <span className="mt-1 text-sm text-gray-500">We send the dress home 5 days advance to ensure it fits perfectly.</span>
                </div>
              </label>

              <label className={cn(
                  "flex cursor-pointer border p-4 flex-col gap-3 transition-colors", 
                  addBackup ? "border-black bg-gray-50" : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-5 items-center">
                    <input type="checkbox" className="h-5 w-5 border-gray-300 text-black focus:ring-black rounded shadow-sm" checked={addBackup} onChange={e => setAddBackup(e.target.checked)} />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <span className="font-medium text-gray-900 flex justify-between">
                      Add backup size <span>+{formatPrice(product.services.backupSize.price)}</span>
                    </span>
                    <span className="mt-1 text-sm text-gray-500">Not sure about size? We will send an extra one.</span>
                  </div>
                </div>
                
                {addBackup && (
                  <div className="ml-9 border-t pt-3">
                     <select 
                       className="w-full appearance-none rounded-none border border-gray-300 bg-white p-2 text-sm focus:border-black focus:ring-0"
                       value={selectedBackupSize}
                       onChange={e => setSelectedBackupSize(e.target.value)}
                     >
                       <option value="S">Size S</option>
                       <option value="M">Size M</option>
                       <option value="L">Size L</option>
                       <option value="XL">Size XL</option>
                     </select>
                  </div>
                )}
              </label>
            </div>
            
          </div>

          {/* Sticky Mobile Add To Cart / Static Desktop */}
          <div className="fixed bottom-0 left-0 z-40 w-full border-t bg-white p-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] md:relative md:z-auto md:mt-10 md:border-none md:p-0 md:shadow-none">
            <div className="mb-3 hidden justify-between text-sm md:flex">
               <span className="text-gray-500 items-center flex">Total Price (incl. deposit)</span>
               <span className="text-xl font-bold text-gray-900">{formatPrice(isFormValid ? totalPrice : product.basePrice + product.deposit)}</span>
            </div>
            
            <button
              type="button"
              disabled={!isFormValid}
              onClick={handleAddToCart}
              className={cn(
                "flex w-full items-center justify-center gap-2 bg-black py-4 px-8 text-base font-bold uppercase tracking-widest text-white transition-colors",
                !isFormValid && "opacity-50 cursor-not-allowed hover:bg-black",
                isFormValid && "hover:bg-gray-800"
              )}
            >
              {isFormValid ? `Add to Cart — ${formatPrice(totalPrice)}` : 'Select Dates to Book'}
            </button>
          </div>

          <hr className="my-10 border-gray-200 hidden md:block" />

          {/* Details / FAQs Accordion - Hidden on mobile if not needed or shown beneath */}
          <div className="mt-10 flex flex-col md:mt-0">
             <p className="text-gray-600 leading-relaxed text-sm mb-6">{product.description}</p>
             
             <div className="flex flex-col border-t border-gray-200">
                <button type="button" onClick={() => toggleAccordion('fabric')} className="flex items-center justify-between py-4 text-left font-medium uppercase tracking-wide text-gray-900 hover:text-gray-600">
                  Fabric & Details
                  {openAccordion === 'fabric' ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </button>
                {openAccordion === 'fabric' && (
                  <div className="pb-4 text-sm text-gray-600">
                    {product.fabricDetails}
                  </div>
                )}
             </div>

             <div className="flex flex-col border-t border-gray-200">
                <button type="button" onClick={() => toggleAccordion('care')} className="flex items-center justify-between py-4 text-left font-medium uppercase tracking-wide text-gray-900 hover:text-gray-600">
                  Care Instructions
                  {openAccordion === 'care' ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </button>
                {openAccordion === 'care' && (
                  <div className="pb-4 text-sm text-gray-600">
                    {product.careInstructions}
                  </div>
                )}
             </div>

          </div>

        </div>
      </div>

    </div>
  );
}
