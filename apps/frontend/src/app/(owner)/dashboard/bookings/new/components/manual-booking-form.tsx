'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  PackageSearch, CheckCircle, Loader2, Plus, Trash2,
  UserCheck, AlertCircle, Calendar, ShoppingBag, ImageIcon,
  ChevronDown, ChevronUp, Pencil, Ruler,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { customerApi } from '@/lib/api/customers';
import { productApi, type ProductSizeData } from '@/lib/api/products';
import { bookingApi, type ValidateCartResponse } from '@/lib/api/bookings';
import type { ApiResponse, Customer } from '@closetrent/types';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Matches the exact shape returned by GET /owner/products (listOwner) */
interface OwnerProductResult {
  id: string;
  name: string;
  slug: string;
  status: string;
  pricing: {
    mode: string;
    rentalPrice: number | null;
    pricePerDay: number | null;
    calculatedPrice: number | null;
    priceOverride: number | null;
    minInternalPrice: number | null;
  } | null;
  variants: Array<{
    id: string;
    variantName: string | null;
    mainColor: { name: string; hexCode: string | null };
    images: Array<{ thumbnailUrl: string }>;
  }>;
  category?: { id: string; name: string; slug: string };
  _count?: { variants: number; bookingItems: number };
}

/** Flattened product for display in the form */
interface ProductForForm {
  id: string;
  name: string;
  rentalPrice: number;
  thumbnailUrl: string;
  pricingMode: string;
  variants: Array<{
    id: string;
    colorName: string;
    colorHex: string | null;
    thumbnailUrl: string;
  }>;
  // Size config (loaded lazily after selection)
  sizeConfig?: ProductSizeData | null;
}

interface BookingItemLine {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  startDate: string;
  endDate: string;
  thumbnailUrl: string;
  selectedSize?: string;
  backupSize?: string;
  // Set after validation
  price: number;
  deposit: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEffectivePrice(pricing: OwnerProductResult['pricing']): number {
  if (!pricing) return 0;
  if (pricing.priceOverride) return pricing.priceOverride;
  if (pricing.mode === 'one_time') return pricing.rentalPrice ?? 0;
  if (pricing.mode === 'per_day') return pricing.pricePerDay ?? 0;
  if (pricing.mode === 'percentage') return pricing.calculatedPrice ?? 0;
  return pricing.rentalPrice ?? 0;
}

function mapToFormProduct(raw: OwnerProductResult): ProductForForm {
  const price = getEffectivePrice(raw.pricing);
  const firstVariant = raw.variants?.[0];
  const thumb = firstVariant?.images?.[0]?.thumbnailUrl ?? '';

  return {
    id: raw.id,
    name: raw.name,
    rentalPrice: price,
    thumbnailUrl: thumb,
    pricingMode: raw.pricing?.mode ?? 'one_time',
    variants: (raw.variants ?? []).map((v) => ({
      id: v.id,
      colorName: v.mainColor?.name ?? 'Default',
      colorHex: v.mainColor?.hexCode ?? null,
      thumbnailUrl: v.images?.[0]?.thumbnailUrl ?? '',
    })),
  };
}

async function searchProducts(q: string): Promise<ProductForForm[]> {
  if (!q || q.length < 2) return [];
  const { data: response } = await apiClient.get<{ data: OwnerProductResult[]; meta: unknown }>(
    '/owner/products',
    { params: { search: q, status: 'published', limit: 10 } },
  );
  const items = response.data ?? [];
  return items.map(mapToFormProduct);
}

/** Hook: close dropdown on outside click */
function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose]);
}

// ─── Zod Schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  // Customer section
  fullName: z.string().min(2, 'Name is required'),
  phone: z.string().min(10, 'Phone is required'),
  altPhone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  // Delivery
  address: z.string().min(5, 'Address is required'),
  area: z.string().optional(),
  thana: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  // Payment
  paymentMethod: z.enum(['cod', 'bkash', 'nagad', 'sslcommerz']),
  bkashTransactionId: z.string().optional(),
  nagadTransactionId: z.string().optional(),
  customerNotes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────

export function ManualBookingForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProductForForm[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [cartItems, setCartItems] = useState<BookingItemLine[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductForForm | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [backupSize, setBackupSize] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoadingSize, setIsLoadingSize] = useState(false);

  // Refs for click-outside
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(productDropdownRef, () => setShowProductDropdown(false));
  useClickOutside(customerDropdownRef, () => setShowCustomerDropdown(false));

  // Availability check state
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availabilityResult, setAvailabilityResult] = useState<{
    available: boolean;
    message?: string;
    rentalDays?: number;
    pricing?: { baseRental: number; deposit: number; total: number };
  } | null>(null);

  // Validated cart state (from backend /bookings/validate)
  const [validatedCart, setValidatedCart] = useState<ValidateCartResponse | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      paymentMethod: 'cod',
      fullName: '',
      phone: '',
      address: '',
      city: '',
      district: '',
      area: '',
      thana: '',
    },
  });

  const watchPaymentMethod = form.watch('paymentMethod');

  // ── Customer search ──────────────────────────────────────────────────────

  const { data: customerResults, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customer-search', customerSearch],
    queryFn: () => customerApi.getCustomers({ search: customerSearch, limit: 10 }),
    enabled: customerSearch.length >= 3,
    staleTime: 5000,
  });

  const handleSelectCustomer = (customer: Customer) => {
    form.setValue('fullName', customer.fullName);
    form.setValue('phone', customer.phone);
    if (customer.email) form.setValue('email', customer.email);
    // Auto-fill delivery address from customer (Fix #6)
    if (customer.district) form.setValue('district', customer.district);
    setCustomerSearch('');
    setShowCustomerDropdown(false);
  };

  // ── Product search ──────────────────────────────────────────────────────

  const handleProductSearch = async (q: string) => {
    setProductSearch(q);
    if (selectedProduct) {
      setSelectedProduct(null);
      setSelectedVariantId('');
      setSelectedSize('');
      setBackupSize('');
      setAvailabilityResult(null);
    }
    if (q.length < 2) { setSearchResults([]); setShowProductDropdown(false); return; }
    setIsSearching(true);
    setShowProductDropdown(true);
    try {
      const results = await searchProducts(q);
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  // ── Product selection + size config fetch (Fix #1, #4) ────────────────

  const handleSelectProduct = async (product: ProductForForm) => {
    setSelectedProduct(product);
    setSelectedVariantId(product.variants[0]?.id ?? '');
    setProductSearch(product.name);
    setShowProductDropdown(false);
    setSearchResults([]);
    setAvailabilityResult(null);
    setSelectedSize('');
    setBackupSize('');

    // Fetch full product detail for size config
    setIsLoadingSize(true);
    try {
      const detail = await productApi.getById(product.id);
      setSelectedProduct(prev => prev ? {
        ...prev,
        sizeConfig: detail.productSize,
      } : null);
    } catch {
      // Non-critical — size just won't be available
    } finally {
      setIsLoadingSize(false);
    }
  };

  // ── Availability check ────────────────────────────────────────────────

  const checkAvailability = useCallback(async (productId: string, start: string, end: string) => {
    if (!start || !end) {
      setAvailabilityResult(null);
      return;
    }
    if (new Date(start) >= new Date(end)) {
      setAvailabilityResult({ available: false, message: 'End date must be after start date' });
      return;
    }

    setIsCheckingAvailability(true);
    try {
      const result = await bookingApi.checkDateRange(productId, start, end);
      if (result.available) {
        setAvailabilityResult({
          available: true,
          rentalDays: result.rentalDays,
          pricing: result.pricing ? {
            baseRental: result.pricing.baseRental,
            deposit: result.pricing.deposit,
            total: result.pricing.total,
          } : undefined,
        });
      } else {
        setAvailabilityResult({
          available: false,
          message: result.conflictDates
            ? `Unavailable ${result.conflictDates[0]} to ${result.conflictDates[1]}. Next available: ${result.nextAvailable || 'N/A'}`
            : (result.reason || 'Dates not available'),
        });
      }
    } catch {
      setAvailabilityResult({ available: false, message: 'Failed to check availability' });
    } finally {
      setIsCheckingAvailability(false);
    }
  }, []);

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setAvailabilityResult(null);
    if (selectedProduct && val && endDate) {
      checkAvailability(selectedProduct.id, val, endDate);
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setAvailabilityResult(null);
    if (selectedProduct && startDate && val) {
      checkAvailability(selectedProduct.id, startDate, val);
    }
  };

  // ── Add item to cart (Fix #5 — deduplication) ──────────────────────────

  const handleAddItem = () => {
    if (!selectedProduct || !selectedVariantId || !startDate || !endDate) {
      toast.error('Please select a product, variant, and rental dates.');
      return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      toast.error('End date must be after start date.');
      return;
    }
    if (availabilityResult && !availabilityResult.available) {
      toast.error('Product is not available for the selected dates.');
      return;
    }

    // Check for duplicate (Fix #5)
    const isDuplicate = cartItems.some(
      item => item.productId === selectedProduct.id
        && item.variantId === selectedVariantId
        && item.startDate === startDate
        && item.endDate === endDate,
    );
    if (isDuplicate) {
      toast.error('This item with the same dates is already in the order.');
      return;
    }

    // Validate size selection if product has sizes
    const sizeConfig = selectedProduct.sizeConfig;
    if (sizeConfig && sizeConfig.mode === 'fixed' && sizeConfig.availableSizes.length > 0 && !selectedSize) {
      toast.error('Please select a size for this product.');
      return;
    }

    const variant = selectedProduct.variants.find(v => v.id === selectedVariantId);
    setCartItems(prev => [...prev, {
      productId: selectedProduct.id,
      variantId: selectedVariantId,
      productName: selectedProduct.name,
      variantName: variant?.colorName ?? 'Default',
      startDate,
      endDate,
      thumbnailUrl: variant?.thumbnailUrl || selectedProduct.thumbnailUrl,
      selectedSize: selectedSize || undefined,
      backupSize: backupSize || undefined,
      price: availabilityResult?.pricing?.baseRental ?? selectedProduct.rentalPrice,
      deposit: availabilityResult?.pricing?.deposit ?? 0,
    }]);

    // Reset selection
    setSelectedProduct(null);
    setSelectedVariantId('');
    setSelectedSize('');
    setBackupSize('');
    setStartDate('');
    setEndDate('');
    setProductSearch('');
    setSearchResults([]);
    setAvailabilityResult(null);
    setValidatedCart(null);
  };

  const removeItem = (idx: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== idx));
    setValidatedCart(null);
  };

  // ── Validate cart (Step 2 → Step 3) ────────────────────────────────────

  const handleValidateAndContinue = async () => {
    if (cartItems.length === 0) {
      toast.error('Add at least one item to continue.');
      return;
    }

    setIsValidating(true);
    try {
      const result = await bookingApi.validateCart({
        items: cartItems.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          startDate: item.startDate,
          endDate: item.endDate,
          selectedSize: item.selectedSize,
          backupSize: item.backupSize,
        })),
      });

      if (!result.valid) {
        const errorItems = result.items.filter(i => !i.available);
        errorItems.forEach(item => {
          const cartItem = cartItems.find(c => c.productId === item.productId);
          toast.error(`"${cartItem?.productName || 'Item'}" is no longer available for the selected dates.`);
        });
        return;
      }

      // Update cart items with validated pricing
      setCartItems(prev => prev.map((item, idx) => {
        const validated = result.items[idx];
        if (!validated) return item;
        return {
          ...item,
          price: validated.itemTotal,
          deposit: validated.deposit,
        };
      }));

      setValidatedCart(result);
      setStep(3);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to validate cart';
      toast.error(msg);
    } finally {
      setIsValidating(false);
    }
  };

  // ── Totals ───────────────────────────────────────────────────────────────

  const summary = validatedCart?.summary ?? {
    subtotal: cartItems.reduce((sum, i) => sum + i.price, 0),
    totalFees: 0,
    totalDeposit: cartItems.reduce((sum, i) => sum + i.deposit, 0),
    shippingFee: 0,
    grandTotal: cartItems.reduce((sum, i) => sum + i.price + i.deposit, 0),
  };

  // ── Submit (Fix #12 — confirmation dialog) ──────────────────────────────

  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof bookingApi.create>[0]) => bookingApi.create(payload),
    onSuccess: (result) => {
      toast.success(`Booking ${result?.bookingNumber} created successfully!`);
      router.push(`/dashboard/bookings/${result?.bookingId}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Failed to create booking. Please try again.';
      toast.error(msg);
    },
  });

  const buildPayload = (values: FormValues) => ({
    customer: {
      fullName: values.fullName,
      phone: values.phone,
      altPhone: values.altPhone || undefined,
      email: values.email || undefined,
    },
    delivery: {
      address: values.address,
      area: values.area || undefined,
      thana: values.thana || undefined,
      city: values.city || values.district || undefined, // Fix #2
      district: values.district || undefined,
    },
    items: cartItems.map(item => ({
      productId: item.productId,
      variantId: item.variantId,
      startDate: item.startDate,
      endDate: item.endDate,
      selectedSize: item.selectedSize,
      backupSize: item.backupSize,
    })),
    paymentMethod: values.paymentMethod,
    bkashTransactionId: values.bkashTransactionId || undefined,
    nagadTransactionId: values.nagadTransactionId || undefined,
    customerNotes: values.customerNotes || undefined,
  });

  const handleSubmitClick = form.handleSubmit(() => {
    if (cartItems.length === 0) {
      toast.error('Please add at least one product.');
      setStep(2);
      return;
    }
    setShowConfirmDialog(true); // Fix #12
  });

  const handleConfirmSubmit = () => {
    setShowConfirmDialog(false);
    const values = form.getValues();
    mutation.mutate(buildPayload(values));
  };

  const today = new Date().toISOString().split('T')[0];

  // Step navigation helpers (Fix #8)
  const goToStep = (target: number) => {
    if (target < step) setStep(target);
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmitClick} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">

          {/* ── Step 1: Customer ── */}
          <Card className="shadow-none border">
            <CardHeader
              className="pb-3 bg-muted/30 cursor-pointer"
              onClick={() => step > 1 && goToStep(1)}
            >
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className={`h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center ${step > 1 ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground'}`}>
                    {step > 1 ? <CheckCircle className="h-3 w-3" /> : '1'}
                  </span>
                  Customer Details
                </span>
                {/* Fix #9 — collapsed summary */}
                {step > 1 && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-green-600">
                      {form.getValues('fullName')} · {form.getValues('phone')}
                    </span>
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={(e) => { e.stopPropagation(); setStep(1); }}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>

            {/* Fix #9 — only show content when active */}
            {step === 1 && (
              <CardContent className="pt-4 space-y-4">
                {/* Customer lookup */}
                <div className="space-y-2" ref={customerDropdownRef}>
                  <Label>Search Existing Customer (optional)</Label>
                  <div className="relative">
                    <Input
                      placeholder="Type name or phone to search..."
                      value={customerSearch}
                      onChange={e => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerDropdown(e.target.value.length >= 3);
                      }}
                    />
                    {showCustomerDropdown && customerSearch.length >= 3 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {isLoadingCustomers ? (
                          <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                          </div>
                        ) : (customerResults?.data ?? []).length === 0 ? (
                          <div className="p-3 text-sm text-muted-foreground">No customers found.</div>
                        ) : (
                          (customerResults?.data ?? []).map((c: Customer) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleSelectCustomer(c)}
                              className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors flex items-center gap-2 text-sm"
                            >
                              <UserCheck className="h-3.5 w-3.5 text-green-600 shrink-0" />
                              <span className="font-medium">{c.fullName}</span>
                              <span className="text-muted-foreground">{c.phone}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-center text-xs text-muted-foreground relative">
                  <span className="bg-card px-2 relative z-10">OR ENTER MANUALLY</span>
                  <div className="absolute left-0 right-0 top-1/2 -mt-px border-t pointer-events-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="fullName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl><Input placeholder="Customer name" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone *</FormLabel>
                      <FormControl><Input placeholder="01XXXXXXXXX" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="altPhone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alt. Phone</FormLabel>
                      <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" placeholder="Optional" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <Separator />

                {/* Delivery — Fix #2: added city field */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Delivery Address *</FormLabel>
                      <FormControl><Input placeholder="House, Road, Area..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="area" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Area</FormLabel>
                      <FormControl><Input placeholder="e.g. Dhanmondi" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="thana" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Thana</FormLabel>
                      <FormControl><Input placeholder="e.g. Mohammadpur" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl><Input placeholder="e.g. Dhaka" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="district" render={({ field }) => (
                    <FormItem>
                      <FormLabel>District</FormLabel>
                      <FormControl><Input placeholder="e.g. Dhaka" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={async () => {
                      const ok = await form.trigger(['fullName', 'phone', 'address']);
                      if (ok) setStep(2);
                    }}
                  >
                    Continue to Items
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* ── Step 2: Items ── */}
          {step >= 2 && (
            <Card className="shadow-none border">
              <CardHeader
                className="pb-3 bg-muted/30 cursor-pointer"
                onClick={() => step > 2 && goToStep(2)}
              >
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className={`h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center ${step > 2 ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground'}`}>
                      {step > 2 ? <CheckCircle className="h-3 w-3" /> : '2'}
                    </span>
                    Rental Items
                  </span>
                  <div className="flex items-center gap-2">
                    {cartItems.length > 0 && (
                      <Badge variant="secondary">{cartItems.length} item{cartItems.length !== 1 ? 's' : ''}</Badge>
                    )}
                    {step > 2 && (
                      <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={(e) => { e.stopPropagation(); setStep(2); }}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>

              {/* Fix #9 — only show content when active */}
              {step === 2 && (
                <CardContent className="pt-4 space-y-4">
                  {/* Added items — Fix #10: formatted dates */}
                  {cartItems.length > 0 && (
                    <div className="space-y-2">
                      {cartItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-md border bg-muted/20 px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 bg-muted rounded-md overflow-hidden shrink-0 border">
                              {item.thumbnailUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.thumbnailUrl} alt={item.productName} className="object-cover h-full w-full" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{item.productName}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                <span>{item.variantName}</span>
                                {item.selectedSize && (
                                  <>
                                    <span>·</span>
                                    <span className="flex items-center gap-0.5"><Ruler className="h-3 w-3" />{item.selectedSize}</span>
                                  </>
                                )}
                                <span>·</span>
                                <Calendar className="h-3 w-3" />
                                {/* Fix #10 — formatted dates */}
                                <span>{format(parseISO(item.startDate), 'MMM d')} → {format(parseISO(item.endDate), 'MMM d, yyyy')}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-sm text-right">
                              <div className="font-medium">৳{item.price.toLocaleString()}</div>
                              {item.deposit > 0 && (
                                <div className="text-xs text-muted-foreground">+৳{item.deposit.toLocaleString()} deposit</div>
                              )}
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeItem(idx)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add product section */}
                  <div className="rounded-md border border-dashed p-4 space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <PackageSearch className="h-3.5 w-3.5" /> Add Product
                    </p>

                    {/* Product search — Fix #11: click-outside */}
                    <div className="relative" ref={productDropdownRef}>
                      <Input
                        placeholder="Search products by name..."
                        value={productSearch}
                        onChange={e => handleProductSearch(e.target.value)}
                      />
                      {showProductDropdown && productSearch.length >= 2 && !selectedProduct && (
                        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-card border rounded-md shadow-lg max-h-56 overflow-y-auto">
                          {isSearching ? (
                            <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                            </div>
                          ) : searchResults.length === 0 ? (
                            <div className="p-3 text-sm text-muted-foreground">No products found.</div>
                          ) : (
                            searchResults.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleSelectProduct(p)}
                                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors text-sm flex items-center gap-3"
                              >
                                <div className="h-10 w-10 bg-muted rounded border overflow-hidden shrink-0">
                                  {p.thumbnailUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={p.thumbnailUrl} alt={p.name} className="object-cover h-full w-full" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{p.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {p.variants.length} variant{p.variants.length !== 1 ? 's' : ''}
                                  </div>
                                </div>
                                <span className="text-muted-foreground font-medium shrink-0">৳{p.rentalPrice?.toLocaleString()}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {selectedProduct && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          {/* Variant selector */}
                          <div className="space-y-1 col-span-2 sm:col-span-1">
                            <Label className="text-xs">Color / Variant *</Label>
                            <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select variant" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedProduct.variants.map(v => (
                                  <SelectItem key={v.id} value={v.id}>
                                    <span className="flex items-center gap-2">
                                      {v.colorHex && (
                                        <span
                                          className="inline-block h-3 w-3 rounded-full border"
                                          style={{ backgroundColor: v.colorHex }}
                                        />
                                      )}
                                      {v.colorName}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Size selector — Fix #1, #4 */}
                          {isLoadingSize ? (
                            <div className="space-y-1 col-span-2 sm:col-span-1">
                              <Label className="text-xs">Size</Label>
                              <div className="h-9 flex items-center text-sm text-muted-foreground gap-1.5">
                                <Loader2 className="h-3 w-3 animate-spin" /> Loading sizes...
                              </div>
                            </div>
                          ) : selectedProduct.sizeConfig && selectedProduct.sizeConfig.mode === 'fixed' && selectedProduct.sizeConfig.availableSizes.length > 0 ? (
                            <div className="space-y-1 col-span-2 sm:col-span-1">
                              <Label className="text-xs flex items-center gap-1"><Ruler className="h-3 w-3" /> Size *</Label>
                              <Select value={selectedSize} onValueChange={setSelectedSize}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select size" />
                                </SelectTrigger>
                                <SelectContent>
                                  {selectedProduct.sizeConfig.availableSizes.map(s => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : selectedProduct.sizeConfig && selectedProduct.sizeConfig.mode === 'free_size' ? (
                            <div className="space-y-1 col-span-2 sm:col-span-1">
                              <Label className="text-xs flex items-center gap-1"><Ruler className="h-3 w-3" /> Size</Label>
                              <div className="h-9 flex items-center text-sm text-muted-foreground">
                                Free Size{selectedProduct.sizeConfig.freeSizeType ? ` (${selectedProduct.sizeConfig.freeSizeType})` : ''}
                              </div>
                            </div>
                          ) : null}

                          {/* Date pickers */}
                          <div className="space-y-1">
                            <Label className="text-xs">From Date *</Label>
                            <Input
                              type="date"
                              value={startDate}
                              min={today}
                              onChange={e => handleStartDateChange(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">To Date *</Label>
                            <Input
                              type="date"
                              value={endDate}
                              min={startDate || today}
                              onChange={e => handleEndDateChange(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Availability feedback */}
                        {isCheckingAvailability && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 rounded bg-muted/50">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Checking availability...
                          </div>
                        )}

                        {availabilityResult && !isCheckingAvailability && (
                          <div className={`flex items-start gap-2 text-sm p-3 rounded-md border ${
                            availabilityResult.available
                              ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                              : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                          }`}>
                            {availabilityResult.available ? (
                              <>
                                <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                <div>
                                  <div className="font-medium">Available — {availabilityResult.rentalDays} days</div>
                                  {availabilityResult.pricing && (
                                    <div className="text-xs mt-1 opacity-80">
                                      Rental: ৳{availabilityResult.pricing.baseRental.toLocaleString()}
                                      {availabilityResult.pricing.deposit > 0 && (
                                        <> · Deposit: ৳{availabilityResult.pricing.deposit.toLocaleString()}</>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                <div className="font-medium">{availabilityResult.message}</div>
                              </>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddItem}
                      disabled={!selectedProduct || (availabilityResult !== null && !availabilityResult.available)}
                      className="gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add to Order
                    </Button>
                  </div>

                  {/* Navigation — Fix #8 */}
                  <div className="flex justify-between pt-2">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={handleValidateAndContinue}
                      disabled={isValidating || cartItems.length === 0}
                    >
                      {isValidating ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating...</>
                      ) : (
                        'Continue to Payment'
                      )}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* ── Step 3: Payment ── */}
          {step >= 3 && (
            <Card className="shadow-none border">
              <CardHeader className="pb-3 bg-muted/30">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center bg-primary text-primary-foreground">
                    3
                  </span>
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cod">Cash on Delivery (COD)</SelectItem>
                        <SelectItem value="bkash">bKash</SelectItem>
                        <SelectItem value="nagad">Nagad</SelectItem>
                        <SelectItem value="sslcommerz">SSLCommerz</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {watchPaymentMethod === 'bkash' && (
                  <FormField control={form.control} name="bkashTransactionId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>bKash Transaction ID</FormLabel>
                      <FormControl><Input placeholder="TrxID..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
                {watchPaymentMethod === 'nagad' && (
                  <FormField control={form.control} name="nagadTransactionId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nagad Transaction ID</FormLabel>
                      <FormControl><Input placeholder="TrxID..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                <FormField control={form.control} name="customerNotes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any special instructions or notes for this order..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Fix #8 — Back button */}
                <div className="flex justify-start pt-2">
                  <Button type="button" variant="outline" onClick={() => setStep(2)}>
                    Back
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Order Summary sidebar ── */}
        <div className="md:col-span-1 space-y-6">
          <Card className="shadow-none border sticky top-6">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {cartItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add items to view summary.</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {cartItems.map((item, idx) => {
                      const validatedItem = validatedCart?.items?.[idx];
                      return (
                        <div key={idx} className="flex justify-between text-sm gap-2">
                          <div className="text-muted-foreground truncate flex-1">
                            <div className="truncate">{item.productName}</div>
                            <div className="text-[11px] flex items-center gap-1">
                              {validatedItem && <span>{validatedItem.rentalDays} days</span>}
                              {item.selectedSize && <span>· {item.selectedSize}</span>}
                            </div>
                          </div>
                          <span className="font-medium shrink-0">
                            ৳{(validatedItem?.itemTotal ?? item.price).toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <Separator />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>৳{summary.subtotal.toLocaleString()}</span>
                    </div>
                    {summary.totalFees > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fees</span>
                        <span>৳{summary.totalFees.toLocaleString()}</span>
                      </div>
                    )}
                    {summary.shippingFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Shipping</span>
                        <span>৳{summary.shippingFee.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Deposit held</span>
                      <span>৳{summary.totalDeposit.toLocaleString()}</span>
                    </div>
                  </div>

                  <Separator />
                  <div className="flex justify-between font-semibold text-base">
                    <span>Grand Total</span>
                    <span className="text-primary">৳{summary.grandTotal.toLocaleString()}</span>
                  </div>

                  {validatedCart && (
                    <div className="flex items-center gap-1.5 text-xs text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      Pricing verified by server
                    </div>
                  )}
                </>
              )}

              {step >= 3 && (
                <Button
                  type="submit"
                  className="w-full mt-2"
                  size="lg"
                  disabled={mutation.isPending || cartItems.length === 0}
                >
                  {mutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
                  ) : (
                    'Create Booking'
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Fix #12 — Confirmation dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Booking</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Please review the order details before submitting:</p>
                <div className="bg-muted/50 rounded-md p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-medium">{form.getValues('fullName')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <span>{form.getValues('phone')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items</span>
                    <span>{cartItems.length} product{cartItems.length !== 1 ? 's' : ''}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Grand Total</span>
                    <span className="text-primary">৳{summary.grandTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Payment</span>
                    <span className="uppercase">{form.getValues('paymentMethod')}</span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSubmit}>
              Confirm & Create
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}
