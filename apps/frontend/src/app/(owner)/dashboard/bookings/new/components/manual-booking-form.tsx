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
import { Switch } from '@/components/ui/switch';
import {
  PackageSearch, CheckCircle, Loader2, Plus, Trash2,
  UserCheck, AlertCircle, Calendar, ShoppingBag, ImageIcon,
  Pencil, Ruler, Tag, CreditCard, Zap, ChevronDown, ChevronUp,
  Percent, DollarSign, Truck,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { customerApi } from '@/lib/api/customers';
import { productApi, type ProductServicesData } from '@/lib/api/products';
import { bookingApi, type ValidateCartResponse } from '@/lib/api/bookings';
import type { ApiResponse, Customer } from '@closetrent/types';

// ─── Extended customer type (the list endpoint returns full model) ──────────
/** The backend customer list returns all Prisma columns, but the shared
 *  `Customer` type is minimal. We extend it here for auto-fill. */
interface CustomerForAutoFill extends Customer {
  altPhone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  notes?: string | null;
  addressExtra?: Record<string, string> | null;
}

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
  minInternalPrice: number;
  thumbnailUrl: string;
  pricingMode: string;
  variants: Array<{
    id: string;
    colorName: string;
    colorHex: string | null;
    thumbnailUrl: string;
  }>;
  // Sizing handled abstractly via attributes now if needed
  // Service config (loaded lazily after selection)
  services?: ProductServicesData | null;
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
  tryOn?: boolean;
  priceOverride?: number;
  minInternalPrice: number;
  // Set after validation
  price: number;
  deposit: number;
  // Service info for display
  hasTryOn: boolean;
  hasBackupSize: boolean;
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
    minInternalPrice: raw.pricing?.minInternalPrice ?? 0,
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

function formatCurrency(amount: number): string {
  return `৳${amount.toLocaleString()}`;
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
  postalCode: z.string().optional(),
  // Delivery recipient override
  deliveryDiffers: z.boolean().optional(),
  deliveryName: z.string().optional(),
  deliveryPhone: z.string().optional(),
  deliveryAltPhone: z.string().optional(),
  // Payment
  paymentMethod: z.enum(['cod', 'bkash', 'nagad', 'sslcommerz']),
  bkashTransactionId: z.string().optional(),
  nagadTransactionId: z.string().optional(),
  // Notes
  customerNotes: z.string().optional(),
  internalNotes: z.string().optional(),
  // Auto-confirm
  autoConfirm: z.boolean().optional(),
  // Discount
  discountEnabled: z.boolean().optional(),
  discountType: z.enum(['flat', 'percentage']).optional(),
  discountValue: z.number().min(0).optional(),
  discountReason: z.string().optional(),
  // Initial payment
  initialPaymentEnabled: z.boolean().optional(),
  initialPaymentAmount: z.number().min(0).optional(),
  initialPaymentMethod: z.enum(['cod', 'bkash', 'nagad', 'sslcommerz']).optional(),
  initialPaymentTxId: z.string().optional(),
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
  const [tryOn, setTryOn] = useState(false);
  const [itemPriceOverride, setItemPriceOverride] = useState('');
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
      postalCode: '',
      deliveryDiffers: false,
      deliveryName: '',
      deliveryPhone: '',
      deliveryAltPhone: '',
      autoConfirm: false,
      discountEnabled: false,
      discountType: 'flat',
      discountValue: 0,
      discountReason: '',
      initialPaymentEnabled: false,
      initialPaymentAmount: 0,
      initialPaymentMethod: 'bkash',
      initialPaymentTxId: '',
      internalNotes: '',
      customerNotes: '',
    },
  });

  const watchPaymentMethod = form.watch('paymentMethod');
  const watchDeliveryDiffers = form.watch('deliveryDiffers');
  const watchAutoConfirm = form.watch('autoConfirm');
  const watchDiscountEnabled = form.watch('discountEnabled');
  const watchDiscountType = form.watch('discountType');
  const watchDiscountValue = form.watch('discountValue') || 0;
  const watchInitialPaymentEnabled = form.watch('initialPaymentEnabled');
  const watchInitialPaymentAmount = form.watch('initialPaymentAmount') || 0;

  // ── Customer search ──────────────────────────────────────────────────────

  const { data: customerResults, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customer-search', customerSearch],
    queryFn: () => customerApi.getCustomers({ search: customerSearch, limit: 10 }),
    enabled: customerSearch.length >= 3,
    staleTime: 5000,
  });

  const handleSelectCustomer = (customer: CustomerForAutoFill) => {
    // Full auto-fill — all known fields
    form.setValue('fullName', customer.fullName);
    form.setValue('phone', customer.phone);
    if (customer.altPhone) form.setValue('altPhone', customer.altPhone);
    if (customer.email) form.setValue('email', customer.email);
    if (customer.addressLine1) form.setValue('address', customer.addressLine1);
    if (customer.city) form.setValue('city', customer.city);
    if (customer.state) form.setValue('district', customer.state);
    if (customer.postalCode) form.setValue('postalCode', customer.postalCode);
    // addressExtra may have area/thana
    if (customer.addressExtra) {
      const extra = customer.addressExtra as Record<string, string>;
      if (extra.area) form.setValue('area', extra.area);
      if (extra.thana) form.setValue('thana', extra.thana);
      if (extra.district) form.setValue('district', extra.district);
    }
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
      setTryOn(false);
      setItemPriceOverride('');
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

  // ── Product selection + size/services config fetch ────────────────

  const handleSelectProduct = async (product: ProductForForm) => {
    setSelectedProduct(product);
    setSelectedVariantId(product.variants[0]?.id ?? '');
    setProductSearch(product.name);
    setShowProductDropdown(false);
    setSearchResults([]);
    setAvailabilityResult(null);
    setSelectedSize('');
    setBackupSize('');
    setTryOn(false);
    setItemPriceOverride('');

    // Fetch full product detail for size config + services
    setIsLoadingSize(true);
    try {
      const detail = await productApi.getById(product.id);
      setSelectedProduct(prev => prev ? {
        ...prev,
        services: detail.services,
      } : null);
    } catch {
      // Non-critical — size/services just won't be available
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

  // ── Add item to cart ──────────────────────────────────────────────────

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

    // Duplicate check
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


    // Parse price override
    const parsedOverride = itemPriceOverride ? parseInt(itemPriceOverride, 10) : undefined;
    if (parsedOverride !== undefined && isNaN(parsedOverride)) {
      toast.error('Invalid price override value.');
      return;
    }

    const variant = selectedProduct.variants.find(v => v.id === selectedVariantId);
    const services = selectedProduct.services;
    const hasTryOn = !!services?.tryOnEnabled;
    const hasBackupSize = !!services?.backupSizeEnabled;

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
      tryOn: tryOn || undefined,
      priceOverride: parsedOverride,
      minInternalPrice: selectedProduct.minInternalPrice,
      price: parsedOverride ?? availabilityResult?.pricing?.baseRental ?? selectedProduct.rentalPrice,
      deposit: availabilityResult?.pricing?.deposit ?? 0,
      hasTryOn,
      hasBackupSize,
    }]);

    // Reset selection
    setSelectedProduct(null);
    setSelectedVariantId('');
    setSelectedSize('');
    setBackupSize('');
    setTryOn(false);
    setItemPriceOverride('');
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
          tryOn: item.tryOn,
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

      // Update cart items with validated pricing (but keep priceOverride if set)
      setCartItems(prev => prev.map((item, idx) => {
        const validated = result.items[idx];
        if (!validated) return item;
        return {
          ...item,
          price: item.priceOverride ?? validated.itemTotal,
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

  // ── Discount calculation ──────────────────────────────────────────────

  const rawSubtotal = validatedCart?.summary?.subtotal
    ?? cartItems.reduce((sum, i) => sum + i.price, 0);
  const rawTotalFees = validatedCart?.summary?.totalFees ?? 0;
  const rawTotalDeposit = validatedCart?.summary?.totalDeposit
    ?? cartItems.reduce((sum, i) => sum + i.deposit, 0);
  const rawShippingFee = validatedCart?.summary?.shippingFee ?? 0;
  const rawGrandTotal = rawSubtotal + rawTotalFees + rawShippingFee + rawTotalDeposit;

  let discountAmount = 0;
  if (watchDiscountEnabled && watchDiscountValue > 0) {
    if (watchDiscountType === 'flat') {
      discountAmount = Math.min(watchDiscountValue, rawGrandTotal);
    } else {
      const pct = Math.min(watchDiscountValue, 100);
      discountAmount = Math.ceil((rawSubtotal + rawTotalFees) * (pct / 100));
      discountAmount = Math.min(discountAmount, rawGrandTotal);
    }
  }

  const grandTotal = rawGrandTotal - discountAmount;
  const balanceDue = grandTotal - (watchInitialPaymentEnabled ? Math.min(watchInitialPaymentAmount, grandTotal) : 0);

  // ── Submit ──────────────────────────────────────────────────────────────

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

  const buildPayload = (values: FormValues) => {
    const payload: Parameters<typeof bookingApi.create>[0] = {
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
        city: values.city || values.district || undefined,
        district: values.district || undefined,
        postalCode: values.postalCode || undefined,
        ...(values.deliveryDiffers ? {
          deliveryName: values.deliveryName || undefined,
          deliveryPhone: values.deliveryPhone || undefined,
          deliveryAltPhone: values.deliveryAltPhone || undefined,
        } : {}),
      },
      items: cartItems.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        startDate: item.startDate,
        endDate: item.endDate,
        selectedSize: item.selectedSize,
        backupSize: item.backupSize,
        tryOn: item.tryOn,
        priceOverride: item.priceOverride,
      })),
      paymentMethod: values.paymentMethod,
      customerNotes: values.customerNotes || undefined,
      internalNotes: values.internalNotes || undefined,
      autoConfirm: values.autoConfirm || undefined,
    };

    // Discount
    if (values.discountEnabled && (values.discountValue ?? 0) > 0) {
      payload.discount = {
        type: values.discountType || 'flat',
        value: values.discountValue ?? 0,
        reason: values.discountReason || undefined,
      };
    }

    // Initial payment
    if (values.initialPaymentEnabled && (values.initialPaymentAmount ?? 0) > 0) {
      payload.initialPayment = {
        amount: values.initialPaymentAmount ?? 0,
        method: values.initialPaymentMethod || 'bkash',
        transactionId: values.initialPaymentTxId || undefined,
      };
    }

    return payload;
  };

  const handleSubmitClick = form.handleSubmit(() => {
    if (cartItems.length === 0) {
      toast.error('Please add at least one product.');
      setStep(2);
      return;
    }
    setShowConfirmDialog(true);
  });

  const handleConfirmSubmit = () => {
    setShowConfirmDialog(false);
    const values = form.getValues();
    mutation.mutate(buildPayload(values));
  };

  const today = new Date().toISOString().split('T')[0];

  // Step navigation helpers
  const goToStep = (target: number) => {
    if (target < step) setStep(target);
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmitClick} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">

          {/* ── Step 1: Customer & Delivery ── */}
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
                  Customer & Delivery
                </span>
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
                          (customerResults?.data ?? []).map((c: CustomerForAutoFill) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleSelectCustomer(c)}
                              className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors flex items-center gap-2 text-sm"
                            >
                              <UserCheck className="h-3.5 w-3.5 text-green-600 shrink-0" />
                              <span className="font-medium">{c.fullName}</span>
                              <span className="text-muted-foreground">{c.phone}</span>
                              {c.totalBookings > 0 && (
                                <Badge variant="secondary" className="text-[10px] ml-auto">{c.totalBookings} bookings</Badge>
                              )}
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

                {/* Delivery Address */}
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
                  <FormField control={form.control} name="postalCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl><Input placeholder="e.g. 1207" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Delivery recipient override toggle */}
                <div className="rounded-md border p-3 space-y-3">
                  <FormField control={form.control} name="deliveryDiffers" render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-2">
                      <div>
                        <FormLabel className="text-sm font-medium flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          Delivery recipient differs from customer
                        </FormLabel>
                        <p className="text-xs text-muted-foreground mt-0.5">Enable if the order is a gift or being delivered to someone else.</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )} />

                  {watchDeliveryDiffers && (
                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <FormField control={form.control} name="deliveryName" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Recipient Name</FormLabel>
                          <FormControl><Input placeholder="Recipient name" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="deliveryPhone" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Recipient Phone</FormLabel>
                          <FormControl><Input placeholder="01XXXXXXXXX" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="deliveryAltPhone" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Alt Phone</FormLabel>
                          <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                  )}
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

              {step === 2 && (
                <CardContent className="pt-4 space-y-4">
                  {/* Added items */}
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
                              <div className="font-medium text-sm flex items-center gap-1.5">
                                {item.productName}
                                {item.priceOverride !== undefined && (
                                  <Badge variant="outline" className="text-[9px] border-yellow-500 text-yellow-600 px-1">Custom Price</Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                <span>{item.variantName}</span>
                                {item.selectedSize && (
                                  <>
                                    <span>·</span>
                                    <span className="flex items-center gap-0.5"><Ruler className="h-3 w-3" />{item.selectedSize}</span>
                                  </>
                                )}
                                {item.tryOn && (
                                  <>
                                    <span>·</span>
                                    <Badge variant="secondary" className="text-[9px] px-1">Try-on</Badge>
                                  </>
                                )}
                                <span>·</span>
                                <Calendar className="h-3 w-3" />
                                <span>{format(parseISO(item.startDate), 'MMM d')} → {format(parseISO(item.endDate), 'MMM d, yyyy')}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-sm text-right">
                              <div className="font-medium">{formatCurrency(item.price)}</div>
                              {item.deposit > 0 && (
                                <div className="text-xs text-muted-foreground">+{formatCurrency(item.deposit)} deposit</div>
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

                    {/* Product search */}
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
                                <span className="text-muted-foreground font-medium shrink-0">{formatCurrency(p.rentalPrice)}</span>
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

                        {/* Service toggles: Try-on + Backup Size */}
                        {(selectedProduct.services?.tryOnEnabled || selectedProduct.services?.backupSizeEnabled) && (
                          <div className="grid grid-cols-2 gap-3">
                            {selectedProduct.services?.tryOnEnabled && (
                              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                <div>
                                  <div className="text-xs font-medium">Try-on Service</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {formatCurrency(selectedProduct.services.tryOnFee ?? 0)}
                                    {selectedProduct.services.tryOnCreditToRental && ' (credited to rental)'}
                                  </div>
                                </div>
                                <Switch checked={tryOn} onCheckedChange={setTryOn} />
                              </div>
                            )}
                            {selectedProduct.services?.backupSizeEnabled && (
                              <div className="space-y-1">
                                <Label className="text-xs">Backup Size ({formatCurrency(selectedProduct.services.backupSizeFee ?? 0)})</Label>
                                <Input
                                  placeholder="Enter backup size"
                                  value={backupSize}
                                  onChange={(e) => setBackupSize(e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Per-item price override */}
                        <div className="space-y-1">
                          <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
                            <Tag className="h-3 w-3" /> Custom Price (optional)
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              placeholder={`Standard: ${formatCurrency(selectedProduct.rentalPrice)}`}
                              value={itemPriceOverride}
                              onChange={e => setItemPriceOverride(e.target.value)}
                              className="max-w-[200px]"
                            />
                            {selectedProduct.minInternalPrice > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                Min: {formatCurrency(selectedProduct.minInternalPrice)}
                              </span>
                            )}
                            {itemPriceOverride && parseInt(itemPriceOverride) < selectedProduct.minInternalPrice && selectedProduct.minInternalPrice > 0 && (
                              <Badge variant="outline" className="text-[9px] border-yellow-500 text-yellow-600">Below min</Badge>
                            )}
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
                                      Rental: {formatCurrency(availabilityResult.pricing.baseRental)}
                                      {availabilityResult.pricing.deposit > 0 && (
                                        <> · Deposit: {formatCurrency(availabilityResult.pricing.deposit)}</>
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

                  {/* Navigation */}
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

          {/* ── Step 3: Payment, Notes, Discount ── */}
          {step >= 3 && (
            <Card className="shadow-none border">
              <CardHeader className="pb-3 bg-muted/30">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center bg-primary text-primary-foreground">
                    3
                  </span>
                  Payment & Options
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-5">
                {/* Payment method */}
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

                <Separator />

                {/* ── Discount Section ── */}
                <div className="rounded-md border p-3 space-y-3">
                  <FormField control={form.control} name="discountEnabled" render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-2">
                      <div>
                        <FormLabel className="text-sm font-medium flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          Apply Discount
                        </FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )} />

                  {watchDiscountEnabled && (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center gap-3">
                        <FormField control={form.control} name="discountType" render={({ field }) => (
                          <FormItem className="flex-shrink-0">
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="flat">
                                  <span className="flex items-center gap-1.5"><DollarSign className="h-3 w-3" /> Flat Amount</span>
                                </SelectItem>
                                <SelectItem value="percentage">
                                  <span className="flex items-center gap-1.5"><Percent className="h-3 w-3" /> Percentage</span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="discountValue" render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                type="number"
                                placeholder={watchDiscountType === 'flat' ? 'Amount in ৳' : 'Percentage (e.g. 10)'}
                                value={field.value || ''}
                                onChange={e => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                              />
                            </FormControl>
                          </FormItem>
                        )} />
                      </div>
                      {discountAmount > 0 && (
                        <div className="text-xs text-green-600 font-medium flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Discount: -{formatCurrency(discountAmount)}
                        </div>
                      )}
                      <FormField control={form.control} name="discountReason" render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input placeholder="Reason (e.g. Repeat customer, Festival offer)" {...field} />
                          </FormControl>
                        </FormItem>
                      )} />
                    </div>
                  )}
                </div>

                {/* ── Initial Payment Section ── */}
                <div className="rounded-md border p-3 space-y-3">
                  <FormField control={form.control} name="initialPaymentEnabled" render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-2">
                      <div>
                        <FormLabel className="text-sm font-medium flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Record Upfront Payment
                        </FormLabel>
                        <p className="text-xs text-muted-foreground mt-0.5">Record a payment collected at booking time.</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )} />

                  {watchInitialPaymentEnabled && (
                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <FormField control={form.control} name="initialPaymentAmount" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Amount *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="Amount"
                              value={field.value || ''}
                              onChange={e => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                            />
                          </FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="initialPaymentMethod" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Method</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="cod">Cash</SelectItem>
                              <SelectItem value="bkash">bKash</SelectItem>
                              <SelectItem value="nagad">Nagad</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="initialPaymentTxId" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Transaction ID</FormLabel>
                          <FormControl><Input placeholder="TrxID..." {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                  )}
                </div>

                <Separator />

                {/* ── Notes ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="internalNotes" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        Internal Notes
                        <Badge variant="secondary" className="text-[9px]">Staff only</Badge>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Notes for your team (not visible to customer)..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="customerNotes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Notes from or for the customer..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <Separator />

                {/* ── Auto-confirm Toggle ── */}
                <FormField control={form.control} name="autoConfirm" render={({ field }) => (
                  <div className="rounded-md border p-3">
                    <FormItem className="flex items-center justify-between gap-2">
                      <div>
                        <FormLabel className="text-sm font-medium flex items-center gap-2">
                          <Zap className="h-4 w-4 text-yellow-500" />
                          Create & Confirm Immediately
                        </FormLabel>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Skip the pending state — booking will be confirmed on creation.
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  </div>
                )} />

                {/* Back button */}
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
                            <div className="truncate flex items-center gap-1">
                              {item.productName}
                              {item.priceOverride !== undefined && (
                                <Tag className="h-2.5 w-2.5 text-yellow-500" />
                              )}
                            </div>
                            <div className="text-[11px] flex items-center gap-1">
                              {validatedItem && <span>{validatedItem.rentalDays} days</span>}
                              {item.selectedSize && <span>· {item.selectedSize}</span>}
                              {item.tryOn && <span>· Try-on</span>}
                            </div>
                          </div>
                          <span className="font-medium shrink-0">
                            {formatCurrency(item.priceOverride ?? validatedItem?.itemTotal ?? item.price)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <Separator />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(rawSubtotal)}</span>
                    </div>
                    {rawTotalFees > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fees</span>
                        <span>{formatCurrency(rawTotalFees)}</span>
                      </div>
                    )}
                    {rawShippingFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Shipping</span>
                        <span>{formatCurrency(rawShippingFee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Deposit held</span>
                      <span>{formatCurrency(rawTotalDeposit)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          Discount
                        </span>
                        <span>-{formatCurrency(discountAmount)}</span>
                      </div>
                    )}
                  </div>

                  <Separator />
                  <div className="flex justify-between font-semibold text-base">
                    <span>Grand Total</span>
                    <span className="text-primary">{formatCurrency(grandTotal)}</span>
                  </div>

                  {watchInitialPaymentEnabled && watchInitialPaymentAmount > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-blue-600">
                        <span className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          Upfront Payment
                        </span>
                        <span>-{formatCurrency(Math.min(watchInitialPaymentAmount, grandTotal))}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium">
                        <span>Balance Due</span>
                        <span>{formatCurrency(Math.max(balanceDue, 0))}</span>
                      </div>
                    </>
                  )}

                  {/* Status badges */}
                  <div className="space-y-1.5">
                    {validatedCart && (
                      <div className="flex items-center gap-1.5 text-xs text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        Pricing verified by server
                      </div>
                    )}
                    {watchAutoConfirm && (
                      <div className="flex items-center gap-1.5 text-xs text-yellow-600">
                        <Zap className="h-3 w-3" />
                        Will be confirmed immediately
                      </div>
                    )}
                  </div>
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
                  ) : watchAutoConfirm ? (
                    <><Zap className="mr-2 h-4 w-4" /> Create & Confirm</>
                  ) : (
                    'Create Booking'
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Confirmation dialog */}
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
                  {watchDeliveryDiffers && form.getValues('deliveryName') && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Deliver to</span>
                      <span className="font-medium">{form.getValues('deliveryName')}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items</span>
                    <span>{cartItems.length} product{cartItems.length !== 1 ? 's' : ''}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Grand Total</span>
                    <span className="text-primary">{formatCurrency(grandTotal)}</span>
                  </div>
                  {watchInitialPaymentEnabled && watchInitialPaymentAmount > 0 && (
                    <div className="flex justify-between text-xs text-blue-600">
                      <span>Upfront Payment</span>
                      <span>{formatCurrency(Math.min(watchInitialPaymentAmount, grandTotal))}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Payment</span>
                    <span className="uppercase">{form.getValues('paymentMethod')}</span>
                  </div>
                  {watchAutoConfirm && (
                    <div className="flex items-center gap-1.5 text-xs text-yellow-600 pt-1">
                      <Zap className="h-3 w-3" />
                      Will be confirmed immediately
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSubmit}>
              {watchAutoConfirm ? 'Confirm & Create' : 'Create Booking'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}
