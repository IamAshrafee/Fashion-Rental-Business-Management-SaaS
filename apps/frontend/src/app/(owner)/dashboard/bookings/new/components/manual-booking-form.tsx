'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
  Pencil, Ruler, Tag, CreditCard, Zap,
  Percent, DollarSign, Truck,
} from 'lucide-react';
import { customerApi } from '@/lib/api/customers';
import { productApi, type PricingProfileData } from '@/lib/api/products';
import {
  bookingApi,
  type CreateManualBookingPayload,
  type ManualBookingQuoteResponse,
  type ManualRentalPlan,
  type ValidateCartResponse,
} from '@/lib/api/bookings';
import { inventoryApi } from '@/lib/api/inventory';
import { fulfillmentApi } from '@/lib/api/fulfillment';
import { BundleConfigurator, type BundleSelection } from '@/app/(guest)/products/[slug]/bundle-configurator';
import type { Customer } from '@closetrent/types';
import { useAuth } from '@/hooks/use-auth';
import { formatMinorMoney } from '@/lib/money';
import {
  manualBookingDraftStorageKey,
  useManualBookingDraft,
} from '../hooks/use-manual-booking-draft';
import { RentalPlanStep } from './rental-plan-step';

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

/** Flattened product for display in the form */
interface ProductForForm {
  id: string;
  name: string;
  rentalPrice: number;
  minInternalPrice: number;
  thumbnailUrl: string;
  pricingMode: string;
  variantCount: number;
  variants: Array<{
    id: string;
    colorName: string;
    colorHex: string | null;
    thumbnailUrl: string;
    sizes: Array<{ variantSizeId: string; label: string }>;
  }>;
  // Sizing handled abstractly via attributes now if needed
  // Service config (loaded lazily after selection)
  services?: RentalOptions | null;
}

interface RentalOptions {
  backupSizeEnabled: boolean;
  backupSizeFee: number;
  tryOnEnabled: boolean;
  tryOnFee: number;
  tryOnCreditToRental: boolean;
}

function rentalOptionsFromPricing(pricing: PricingProfileData | null): RentalOptions {
  const component = (purpose: string) =>
    pricing?.components.find(
      (item) =>
        item.config.purpose === purpose || item.config.addonId === purpose,
    );
  const amount = (item: PricingProfileData['components'][number] | undefined) =>
    Number((item?.config.pricing as Record<string, unknown> | undefined)?.amountMinor ?? 0);
  const backup = component('BACKUP_SIZE');
  const tryOn = component('TRY_ON');
  return {
    backupSizeEnabled: Boolean(backup),
    backupSizeFee: amount(backup),
    tryOnEnabled: Boolean(tryOn),
    tryOnFee: amount(tryOn),
    tryOnCreditToRental: Boolean(tryOn?.config.creditToRental),
  };
}

interface BookingItemLine {
  productId: string;
  variantId: string;
  variantSizeId: string;
  quantity: number;
  productName: string;
  variantName: string;
  startDate: string;
  endDate: string;
  thumbnailUrl: string;
  selectedSize?: string;
  backupSize?: string;
  tryOn?: boolean;
  priceOverride?: number;
  priceOverrideReason?: string;
  minInternalPrice: number;
  // Set after validation
  price: number;
  deposit: number;
  // Service info for display
  hasTryOn: boolean;
  hasBackupSize: boolean;
  compositionSelections?: BundleSelection[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function searchProducts(q: string): Promise<ProductForForm[]> {
  if (!q || q.length < 2) return [];
  const response = await productApi.list({ search: q, status: 'published', limit: 10 });
  return response.data.map((product) => ({
    id: product.id,
    name: product.name,
    rentalPrice: product.rentalPrice,
    minInternalPrice: 0,
    thumbnailUrl: product.thumbnailUrl ?? '',
    pricingMode: product.pricingMode ?? 'FLAT_PERIOD',
    variantCount: product.variantCount,
    variants: [],
  }));
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
  return formatMinorMoney(amount);
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
  initialPaymentDepositAmount: z.number().min(0).optional(),
  initialPaymentMethod: z.enum(['cod', 'bkash', 'nagad', 'sslcommerz']).optional(),
  initialPaymentTxId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────

export function ManualBookingForm() {
  const router = useRouter();
  const { tenantId } = useAuth();
  const creationKey = useRef('');
  const loadedDraftKey = useRef('');
  const bookingCreated = useRef(false);
  const [draftReady, setDraftReady] = useState(false);
  const [step, setStep] = useState(1);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProductForForm[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [cartItems, setCartItems] = useState<BookingItemLine[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductForForm | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [selectedVariantSizeId, setSelectedVariantSizeId] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [backupSize, setBackupSize] = useState('');
  const [tryOn, setTryOn] = useState(false);
  const [itemPriceOverride, setItemPriceOverride] = useState('');
  const [itemPriceOverrideReason, setItemPriceOverrideReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sourceLocationId, setSourceLocationId] = useState('');
  const [handoverMethod, setHandoverMethod] = useState<ManualRentalPlan['handoverMethod']>('DELIVERY');
  const [returnMethod, setReturnMethod] = useState<ManualRentalPlan['returnMethod']>('BUSINESS_PICKUP');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [allowTransferPlan, setAllowTransferPlan] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoadingSize, setIsLoadingSize] = useState(false);
  const [compositionSelections, setCompositionSelections] = useState<BundleSelection[]>([]);
  const compositionQuery = useQuery({
    queryKey: ['manual-booking-composition', selectedProduct?.id],
    queryFn: () => fulfillmentApi.listComposition(selectedProduct!.id),
    enabled: !!selectedProduct?.id,
  });

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
  const [acceptedQuote, setAcceptedQuote] = useState<ManualBookingQuoteResponse | null>(null);
  const [creationConflict, setCreationConflict] = useState<{
    code: string;
    message: string;
    affectedLines?: Array<{ lineId: string; currentTotal?: number; previousTotal?: number | null }>;
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const locationsQuery = useQuery({
    queryKey: ['inventory-locations', 'manual-booking'],
    queryFn: () => inventoryApi.listLocations(false),
    staleTime: 60_000,
  });

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
      initialPaymentDepositAmount: 0,
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
  const watchDiscountReason = form.watch('discountReason') || '';
  const watchInitialPaymentEnabled = form.watch('initialPaymentEnabled');
  const watchInitialPaymentAmount = form.watch('initialPaymentAmount') || 0;
  const watchInitialPaymentDepositAmount = form.watch('initialPaymentDepositAmount') || 0;

  useEffect(() => {
    setAcceptedQuote(null);
  }, [watchDiscountEnabled, watchDiscountReason, watchDiscountType, watchDiscountValue]);

  const rentalPlan = useMemo<ManualRentalPlan>(() => ({
    startDate,
    endDate,
    sourceLocationId,
    handoverMethod,
    returnMethod,
    handoverNotes: handoverNotes || undefined,
    allowTransferPlan,
  }), [allowTransferPlan, endDate, handoverMethod, handoverNotes, returnMethod, sourceLocationId, startDate]);
  const applyRentalPlan = useCallback((plan: ManualRentalPlan) => {
    setStartDate(plan.startDate);
    setEndDate(plan.endDate);
    setSourceLocationId(plan.sourceLocationId);
    setHandoverMethod(plan.handoverMethod);
    setReturnMethod(plan.returnMethod);
    setHandoverNotes(plan.handoverNotes ?? '');
    setAllowTransferPlan(Boolean(plan.allowTransferPlan));
    setAcceptedQuote(null);
  }, []);
  const notifyDraftRestored = useCallback(() => {
    toast.info('Draft restored. Pricing and availability must be refreshed.');
  }, []);
  useManualBookingDraft({
    tenantId,
    ready: draftReady,
    setReady: setDraftReady,
    form,
    step,
    setStep,
    cartItems,
    setCartItems,
    plan: rentalPlan,
    applyPlan: applyRentalPlan,
    creationKey,
    loadedDraftKey,
    bookingCreated,
    onRestored: notifyDraftRestored,
  });

  useEffect(() => {
    if (sourceLocationId || !locationsQuery.data?.length) return;
    const preferred = locationsQuery.data.find((location) => location.isDefault)
      ?? locationsQuery.data[0];
    setSourceLocationId(preferred.id);
  }, [locationsQuery.data, sourceLocationId]);

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
      setSelectedVariantSizeId('');
      setSelectedSize('');
      setBackupSize('');
      setTryOn(false);
      setItemPriceOverride('');
      setAvailabilityResult(null);
      setCompositionSelections([]);
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
    setSelectedVariantSizeId(product.variants[0]?.sizes[0]?.variantSizeId ?? '');
    setProductSearch(product.name);
    setShowProductDropdown(false);
    setSearchResults([]);
    setAvailabilityResult(null);
    setSelectedSize('');
    setBackupSize('');
    setTryOn(false);
    setItemPriceOverride('');
    setItemPriceOverrideReason('');
    setCompositionSelections([]);

    // Fetch full product detail for size config + services
    setIsLoadingSize(true);
    try {
      const detail = await productApi.getById(product.id);
      setSelectedProduct(prev => prev ? {
        ...prev,
        services: rentalOptionsFromPricing(detail.pricing),
        variants: detail.variants.map((variant) => ({
          id: variant.id,
          colorName: variant.variantName || variant.mainColor.name,
          colorHex: variant.mainColor.hexCode,
          thumbnailUrl: variant.images[0]?.thumbnailUrl || variant.images[0]?.url || '',
          sizes: variant.sizes.map((size) => ({
            variantSizeId: size.id,
            label: size.sizeInstance.displayLabel,
          })),
        })),
      } : null);
      const firstVariant = detail.variants[0];
      setSelectedVariantId(firstVariant?.id ?? '');
      setSelectedVariantSizeId(firstVariant?.sizes[0]?.id ?? '');
    } catch {
      setSelectedProduct(null);
      setProductSearch('');
      toast.error('This product could not be loaded. Please choose it again.');
    } finally {
      setIsLoadingSize(false);
    }
  };

  // ── Availability check ────────────────────────────────────────────────

  const checkAvailability = useCallback(async (productId: string, variantSizeId: string, start: string, end: string) => {
    if (!start || !end) {
      setAvailabilityResult(null);
      return;
    }
    if (new Date(start) > new Date(end)) {
      setAvailabilityResult({ available: false, message: 'End date must be on or after start date' });
      return;
    }

    setIsCheckingAvailability(true);
    try {
      const result = await bookingApi.checkDateRange(productId, variantSizeId, start, end);
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
    setCartItems((items) => items.map((item) => ({ ...item, startDate: val })));
    setAvailabilityResult(null);
    setValidatedCart(null);
    setAcceptedQuote(null);
    if (selectedProduct && selectedVariantSizeId && val && endDate) {
      checkAvailability(selectedProduct.id, selectedVariantSizeId, val, endDate);
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setCartItems((items) => items.map((item) => ({ ...item, endDate: val })));
    setAvailabilityResult(null);
    setValidatedCart(null);
    setAcceptedQuote(null);
    if (selectedProduct && selectedVariantSizeId && startDate && val) {
      checkAvailability(selectedProduct.id, selectedVariantSizeId, startDate, val);
    }
  };

  const handleRentalPlanChange = (patch: Partial<ManualRentalPlan>) => {
    if (patch.startDate !== undefined) handleStartDateChange(patch.startDate);
    if (patch.endDate !== undefined) handleEndDateChange(patch.endDate);
    if (patch.sourceLocationId !== undefined) setSourceLocationId(patch.sourceLocationId);
    if (patch.handoverMethod !== undefined) setHandoverMethod(patch.handoverMethod);
    if (patch.returnMethod !== undefined) setReturnMethod(patch.returnMethod);
    if (patch.handoverNotes !== undefined) setHandoverNotes(patch.handoverNotes);
    if (patch.allowTransferPlan !== undefined) setAllowTransferPlan(patch.allowTransferPlan);
    setValidatedCart(null);
    setAcceptedQuote(null);
  };

  const handleContinueRentalPlan = () => {
    if (!startDate || !endDate || !sourceLocationId) {
      toast.error('Choose rental dates and a fulfillment location.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Rental end must be on or after rental start.');
      return;
    }
    const selectedLocation = locationsQuery.data?.find((location) => location.id === sourceLocationId);
    if (handoverMethod === 'CUSTOMER_PICKUP' && !selectedLocation?.canCustomerPickup) {
      toast.error('The selected location does not support customer pickup.');
      return;
    }
    setStep(3);
  };

  // ── Add item to cart ──────────────────────────────────────────────────

  const handleAddItem = () => {
    if (!selectedProduct || !selectedVariantId || !selectedVariantSizeId || !startDate || !endDate) {
      toast.error('Please select a product, variant, size, and rental dates.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('End date must be on or after start date.');
      return;
    }
    if (availabilityResult && !availabilityResult.available) {
      toast.error('Product is not available for the selected dates.');
      return;
    }
    const unresolvedRequiredComponent = (compositionQuery.data || []).some((rule) =>
      rule.role === 'REQUIRED_COMPONENT' &&
      rule.skuResolution === 'CUSTOMER_SELECTED' &&
      !compositionSelections.some((selection) => selection.compositionRuleId === rule.id && selection.variantSizeId),
    );
    if (unresolvedRequiredComponent) {
      toast.error('Select every required package component before adding this product.');
      return;
    }

    // Duplicate check
    const isDuplicate = cartItems.some(
      item => item.productId === selectedProduct.id
        && item.variantId === selectedVariantId
        && item.variantSizeId === selectedVariantSizeId
        && item.startDate === startDate
        && item.endDate === endDate,
    );
    if (isDuplicate) {
      toast.error('This item with the same dates is already in the order.');
      return;
    }


    // Parse price override
    const parsedOverride = itemPriceOverride
      ? Math.round(Number(itemPriceOverride) * 100)
      : undefined;
    if (parsedOverride !== undefined && isNaN(parsedOverride)) {
      toast.error('Invalid price override value.');
      return;
    }
    if (parsedOverride !== undefined && !itemPriceOverrideReason.trim()) {
      toast.error('Add a reason for the price override.');
      return;
    }

    const variant = selectedProduct.variants.find(v => v.id === selectedVariantId);
    const selectedSku = variant?.sizes.find(size => size.variantSizeId === selectedVariantSizeId);
    const services = selectedProduct.services;
    const hasTryOn = !!services?.tryOnEnabled;
    const hasBackupSize = !!services?.backupSizeEnabled;

    setCartItems(prev => [...prev, {
      productId: selectedProduct.id,
      variantId: selectedVariantId,
      variantSizeId: selectedVariantSizeId,
      quantity: 1,
      productName: selectedProduct.name,
      variantName: variant?.colorName ?? 'Default',
      startDate,
      endDate,
      thumbnailUrl: variant?.thumbnailUrl || selectedProduct.thumbnailUrl,
      selectedSize: selectedSku?.label || selectedSize || undefined,
      backupSize: backupSize || undefined,
      tryOn: tryOn || undefined,
      priceOverride: parsedOverride,
      priceOverrideReason: parsedOverride !== undefined ? itemPriceOverrideReason.trim() : undefined,
      minInternalPrice: selectedProduct.minInternalPrice,
      price: parsedOverride ?? availabilityResult?.pricing?.baseRental ?? selectedProduct.rentalPrice,
      deposit: availabilityResult?.pricing?.deposit ?? 0,
      hasTryOn,
      hasBackupSize,
      compositionSelections,
    }]);

    // Reset selection
    setSelectedProduct(null);
    setSelectedVariantId('');
    setSelectedVariantSizeId('');
    setSelectedSize('');
    setBackupSize('');
    setTryOn(false);
    setItemPriceOverride('');
    setItemPriceOverrideReason('');
    setProductSearch('');
    setSearchResults([]);
    setAvailabilityResult(null);
    setCompositionSelections([]);
    setValidatedCart(null);
    setAcceptedQuote(null);
  };

  const removeItem = (idx: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== idx));
    setValidatedCart(null);
    setAcceptedQuote(null);
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
          variantSizeId: item.variantSizeId,
          quantity: item.quantity,
          startDate: item.startDate,
          endDate: item.endDate,
          selectedSize: item.selectedSize,
          backupSize: item.backupSize,
          tryOn: item.tryOn,
          compositionSelections: item.compositionSelections?.map(({ label: _label, ...selection }) => selection),
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
      setStep(4);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to validate cart';
      toast.error(msg);
    } finally {
      setIsValidating(false);
    }
  };

  // ── Discount calculation ──────────────────────────────────────────────

  const rawSubtotal = acceptedQuote?.valid ? acceptedQuote.totals.subtotal : validatedCart?.summary?.subtotal
    ?? cartItems.reduce((sum, i) => sum + i.price, 0);
  const rawTotalFees = acceptedQuote?.valid ? acceptedQuote.totals.totalFees : validatedCart?.summary?.totalFees ?? 0;
  const rawTotalDeposit = acceptedQuote?.valid ? acceptedQuote.totals.totalDeposit : validatedCart?.summary?.totalDeposit
    ?? cartItems.reduce((sum, i) => sum + i.deposit, 0);
  const rawShippingFee = acceptedQuote?.valid ? acceptedQuote.totals.shippingFee : validatedCart?.summary?.shippingFee ?? 0;
  const rawGrandTotal = rawSubtotal + rawTotalFees + rawShippingFee + rawTotalDeposit;

  let discountAmount = acceptedQuote?.valid ? acceptedQuote.totals.discountAmount : 0;
  if (!acceptedQuote?.valid && watchDiscountEnabled && watchDiscountValue > 0) {
    if (watchDiscountType === 'flat') {
      discountAmount = Math.min(Math.round(watchDiscountValue * 100), rawSubtotal + rawTotalFees + rawShippingFee);
    } else {
      const pct = Math.min(watchDiscountValue, 100);
      discountAmount = Math.ceil((rawSubtotal + rawTotalFees + rawShippingFee) * (pct / 100));
      discountAmount = Math.min(discountAmount, rawSubtotal + rawTotalFees + rawShippingFee);
    }
  }

  const grandTotal = acceptedQuote?.valid ? acceptedQuote.totals.grandTotal : rawGrandTotal - discountAmount;
  const initialPaymentMinor = Math.round(watchInitialPaymentAmount * 100);
  const initialPaymentDepositMinor = Math.round(watchInitialPaymentDepositAmount * 100);
  const balanceDue = grandTotal - (watchInitialPaymentEnabled ? initialPaymentMinor : 0);

  // ── Submit ──────────────────────────────────────────────────────────────

  const currentPlan = (): ManualRentalPlan => ({
    startDate,
    endDate,
    sourceLocationId,
    handoverMethod,
    returnMethod,
    handoverNotes: handoverNotes.trim() || undefined,
    allowTransferPlan,
  });

  const manualItems = () => cartItems.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    variantSizeId: item.variantSizeId,
    quantity: item.quantity,
    startDate,
    endDate,
    selectedSize: item.selectedSize,
    backupSize: item.backupSize,
    tryOn: item.tryOn,
    priceOverride: item.priceOverride,
    priceOverrideReason: item.priceOverrideReason,
    compositionSelections: item.compositionSelections?.map(({ label: _label, ...selection }) => selection),
  }));

  const currentDiscount = () => watchDiscountEnabled && watchDiscountValue > 0
    ? {
        type: watchDiscountType ?? 'flat',
        value: watchDiscountType === 'percentage'
          ? watchDiscountValue
          : Math.round(watchDiscountValue * 100),
        reason: form.getValues('discountReason')?.trim() ?? '',
      }
    : undefined;

  const quoteMutation = useMutation({
    mutationFn: () => bookingApi.quoteManual({
      plan: currentPlan(),
      items: manualItems(),
      discount: currentDiscount(),
    }),
    onSuccess: (quote) => {
      setCreationConflict(null);
      setAcceptedQuote(quote);
      if (!quote.valid) {
        toast.error(quote.conflicts[0]?.message ?? 'The rental plan has an availability conflict');
        return;
      }
      setCartItems((items) => items.map((item, index) => ({
        ...item,
        price: quote.lines[index]?.finalItemTotal ?? item.price,
        deposit: quote.lines[index]?.depositAmount ?? item.deposit,
      })));
      toast.success('Pricing and availability are locked for 10 minutes');
    },
    onError: (err: unknown) => {
      setAcceptedQuote(null);
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Could not create an authoritative quote';
      toast.error(message);
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: CreateManualBookingPayload) =>
      bookingApi.createManual(payload, creationKey.current || (creationKey.current = crypto.randomUUID())),
    onSuccess: (result) => {
      setCreationConflict(null);
      bookingCreated.current = true;
      if (tenantId) localStorage.removeItem(manualBookingDraftStorageKey(tenantId));
      toast.success(`Booking ${result?.bookingNumber} created successfully!`);
      router.push(`/dashboard/bookings/${result?.bookingId}`);
    },
    onError: (err: unknown) => {
      const response = (err as { response?: { data?: { code?: string; message?: string | { message?: string }; affectedLines?: unknown[] } } })?.response?.data;
      const code = response?.code;
      if (code && ['QUOTE_EXPIRED', 'QUOTE_STALE', 'QUOTE_INPUTS_CHANGED', 'PRICING_CHANGED', 'QUOTE_TOTAL_CHANGED', 'AVAILABILITY_CHANGED', 'FULFILLMENT_LOCATION_CHANGED'].includes(code)) {
        setAcceptedQuote(null);
        setStep(4);
      }
      const msg = typeof response?.message === 'string'
        ? response.message
        : response?.message?.message ?? 'Failed to create booking. Your draft is preserved; refresh the quote and try again.';
      if (code) {
        setCreationConflict({
          code,
          message: msg,
          affectedLines: response?.affectedLines as Array<{ lineId: string; currentTotal?: number; previousTotal?: number | null }> | undefined,
        });
      }
      toast.error(msg);
    },
  });

  const buildPayload = (values: FormValues): CreateManualBookingPayload => {
    if (!acceptedQuote?.valid || !acceptedQuote.quoteId || !acceptedQuote.quoteHash) {
      throw new Error('Refresh and accept the authoritative quote before creating the booking');
    }
    const payload: CreateManualBookingPayload = {
      quoteId: acceptedQuote.quoteId,
      quoteHash: acceptedQuote.quoteHash,
      plan: currentPlan(),
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
      items: manualItems(),
      paymentMethod: values.paymentMethod,
      customerNotes: values.customerNotes || undefined,
      internalNotes: values.internalNotes || undefined,
      autoConfirm: values.autoConfirm || undefined,
    };

    // Discount
    if (values.discountEnabled && (values.discountValue ?? 0) > 0) {
      payload.discount = {
        type: values.discountType || 'flat',
        value: values.discountType === 'percentage'
          ? values.discountValue ?? 0
          : Math.round((values.discountValue ?? 0) * 100),
        reason: values.discountReason?.trim() || '',
      };
    }

    // Initial payment
    if (values.initialPaymentEnabled && (values.initialPaymentAmount ?? 0) > 0) {
      payload.initialPayment = {
        amount: Math.round((values.initialPaymentAmount ?? 0) * 100),
        depositAmount: Math.round((values.initialPaymentDepositAmount ?? 0) * 100),
        method: values.initialPaymentMethod || 'bkash',
        transactionId: values.initialPaymentTxId || undefined,
      };
    }

    return payload;
  };

  const handleSubmitClick = form.handleSubmit(() => {
    if (cartItems.length === 0) {
      toast.error('Please add at least one product.');
      setStep(3);
      return;
    }
    if (!acceptedQuote?.valid || !acceptedQuote.quoteId || !acceptedQuote.quoteHash) {
      toast.error('Refresh pricing and availability before creating the booking.');
      setStep(4);
      return;
    }
    if (acceptedQuote.expiresAt && new Date(acceptedQuote.expiresAt) <= new Date()) {
      setAcceptedQuote(null);
      toast.error('The quote expired. Refresh it before creating the booking.');
      setStep(4);
      return;
    }
    if (watchInitialPaymentEnabled && initialPaymentMinor > grandTotal) {
      toast.error('Upfront payment cannot exceed the final booking total.');
      return;
    }
    if (watchInitialPaymentEnabled && (
      initialPaymentDepositMinor > initialPaymentMinor
      || initialPaymentDepositMinor > rawTotalDeposit
      || initialPaymentMinor - initialPaymentDepositMinor > grandTotal - rawTotalDeposit
    )) {
      toast.error('Split the upfront payment correctly between rental charges and security deposits.');
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
                    Continue to Rental Plan
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* ── Step 2: Rental plan ── */}
          {step >= 2 && (
            <RentalPlanStep
              active={step === 2}
              complete={step > 2}
              today={today}
              plan={rentalPlan}
              locations={locationsQuery.data ?? []}
              locationsLoading={locationsQuery.isLoading}
              onEdit={() => goToStep(2)}
              onBack={() => setStep(1)}
              onContinue={handleContinueRentalPlan}
              onPlanChange={handleRentalPlanChange}
            />
          )}

          {/* ── Step 3: Items ── */}
          {step >= 3 && (
            <Card className="shadow-none border">
              <CardHeader
                className="pb-3 bg-muted/30 cursor-pointer"
                onClick={() => step > 3 && goToStep(3)}
              >
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className={`h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center ${step > 3 ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground'}`}>
                      {step > 3 ? <CheckCircle className="h-3 w-3" /> : '3'}
                    </span>
                    Rental Items
                  </span>
                  <div className="flex items-center gap-2">
                    {cartItems.length > 0 && (
                      <Badge variant="secondary">{cartItems.length} item{cartItems.length !== 1 ? 's' : ''}</Badge>
                    )}
                    {step > 3 && (
                      <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={(e) => { e.stopPropagation(); setStep(3); }}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>

              {step === 3 && (
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
                                    {p.variantCount} variant{p.variantCount !== 1 ? 's' : ''}
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
                            <Select
                              value={selectedVariantId}
                              disabled={isLoadingSize}
                              onValueChange={(variantId) => {
                                setSelectedVariantId(variantId);
                                const firstSku = selectedProduct.variants.find((variant) => variant.id === variantId)?.sizes[0];
                                setSelectedVariantSizeId(firstSku?.variantSizeId ?? '');
                                setAvailabilityResult(null);
                              }}
                            >
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

                          <div className="space-y-1 col-span-2 sm:col-span-1">
                            <Label className="text-xs">Size / SKU *</Label>
                            <Select
                              value={selectedVariantSizeId}
                              onValueChange={(variantSizeId) => {
                                setSelectedVariantSizeId(variantSizeId);
                                setAvailabilityResult(null);
                                if (startDate && endDate) {
                                  checkAvailability(selectedProduct.id, variantSizeId, startDate, endDate);
                                }
                              }}
                            >
                              <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                              <SelectContent>
                                {(selectedProduct.variants.find((variant) => variant.id === selectedVariantId)?.sizes ?? []).map((size) => (
                                  <SelectItem key={size.variantSizeId} value={size.variantSizeId}>{size.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Date pickers */}
                          <div className="space-y-1">
                            <Label className="text-xs">Rental start</Label>
                            <Input
                              type="date"
                              value={startDate}
                              disabled
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Rental end</Label>
                            <Input
                              type="date"
                              value={endDate}
                              disabled
                            />
                          </div>
                        </div>

                        <BundleConfigurator
                          rules={compositionQuery.data || []}
                          selections={compositionSelections}
                          onChange={setCompositionSelections}
                        />

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
                            {itemPriceOverride && Math.round(Number(itemPriceOverride) * 100) < selectedProduct.minInternalPrice && selectedProduct.minInternalPrice > 0 && (
                              <Badge variant="outline" className="text-[9px] border-yellow-500 text-yellow-600">Below min</Badge>
                            )}
                          </div>
                          {itemPriceOverride && (
                            <Input
                              placeholder="Required reason for this override"
                              value={itemPriceOverrideReason}
                              onChange={(event) => setItemPriceOverrideReason(event.target.value)}
                              maxLength={500}
                            />
                          )}
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
                    <Button type="button" variant="outline" onClick={() => setStep(2)}>
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
                        'Continue to Quote & Payment'
                      )}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* ── Step 4: Authoritative quote, payment, and notes ── */}
          {step >= 4 && (
            <Card className="shadow-none border">
              <CardHeader className="pb-3 bg-muted/30">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center bg-primary text-primary-foreground">
                    4
                  </span>
                  Quote, Payment & Options
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

                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Authoritative quote</p>
                      <p className="text-xs text-muted-foreground">Locks current policy versions and checks every component at {locationsQuery.data?.find((location) => location.id === sourceLocationId)?.name ?? 'the selected location'}.</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        if (watchDiscountEnabled && watchDiscountValue > 0 && !watchDiscountReason.trim()) {
                          toast.error('Add a discount reason before requesting the quote.');
                          return;
                        }
                        quoteMutation.mutate();
                      }}
                      disabled={quoteMutation.isPending || !validatedCart}
                    >
                      {quoteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                      {acceptedQuote?.valid ? 'Refresh quote' : 'Check & lock quote'}
                    </Button>
                  </div>
                  {acceptedQuote?.valid && acceptedQuote.expiresAt && (
                    <div className="rounded bg-green-50 p-2 text-xs text-green-800 dark:bg-green-950/30 dark:text-green-300">
                      Quote accepted · expires {new Date(acceptedQuote.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {acceptedQuote.availabilityPlan.length} fulfillment requirement{acceptedQuote.availabilityPlan.length === 1 ? '' : 's'} checked
                    </div>
                  )}
                  {creationConflict && (
                    <div className="rounded border border-amber-400/50 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                      <p className="font-medium">{creationConflict.message}</p>
                      {creationConflict.affectedLines?.map((line) => {
                        const index = Number(line.lineId.split(':')[0]);
                        return (
                          <p key={line.lineId} className="mt-1">
                            {cartItems[index]?.productName ?? 'Changed item'}
                            {line.previousTotal != null && line.currentTotal != null
                              ? `: ${formatCurrency(line.previousTotal)} → ${formatCurrency(line.currentTotal)}`
                              : ''}
                          </p>
                        );
                      })}
                      <p className="mt-1">Your customer, plan, items, payment, and notes are preserved. Refresh the quote to continue.</p>
                    </div>
                  )}
                  {acceptedQuote && !acceptedQuote.valid && (
                    <div className="space-y-2">
                      {acceptedQuote.conflicts.map((conflict, index) => (
                        <div key={`${conflict.lineId}-${conflict.code}-${index}`} className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs">
                          <p className="font-medium text-destructive">{conflict.message}</p>
                          {conflict.transferRequired && (
                            <p className="mt-1 text-muted-foreground">Inventory exists at another location. Arrange and complete a transfer, or change the fulfillment location before quoting again.</p>
                          )}
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button type="button" size="sm" variant="outline" onClick={() => setStep(2)}>Change dates or location</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setStep(3)}>Change items</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => quoteMutation.mutate()} disabled={quoteMutation.isPending}>Recheck</Button>
                      </div>
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
                    <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2 lg:grid-cols-4">
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
                      <FormField control={form.control} name="initialPaymentDepositAmount" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Deposit portion</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={rawTotalDeposit / 100}
                              placeholder="Security deposit"
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
                  <Button type="button" variant="outline" onClick={() => setStep(3)}>
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
                        <span>-{formatCurrency(initialPaymentMinor)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium">
                        <span>Balance Due</span>
                        <span className={balanceDue < 0 ? 'text-destructive' : undefined}>{balanceDue < 0 ? `Over by ${formatCurrency(Math.abs(balanceDue))}` : formatCurrency(balanceDue)}</span>
                      </div>
                    </>
                  )}

                  {/* Status badges */}
                  <div className="space-y-1.5">
                    {acceptedQuote?.valid ? (
                      <div className="flex items-center gap-1.5 text-xs text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        Quote and location capacity verified
                      </div>
                    ) : validatedCart ? (
                      <div className="flex items-center gap-1.5 text-xs text-yellow-600">
                        <AlertCircle className="h-3 w-3" />
                        Items validated; authoritative quote still required
                      </div>
                    ) : null}
                    {watchAutoConfirm && (
                      <div className="flex items-center gap-1.5 text-xs text-yellow-600">
                        <Zap className="h-3 w-3" />
                        Will be confirmed immediately
                      </div>
                    )}
                  </div>
                </>
              )}

              {step >= 4 && (
                <Button
                  type="submit"
                  className="w-full mt-2"
                  size="lg"
                  disabled={mutation.isPending || quoteMutation.isPending || cartItems.length === 0 || !acceptedQuote?.valid || (watchInitialPaymentEnabled && (initialPaymentMinor > grandTotal || initialPaymentDepositMinor > initialPaymentMinor || initialPaymentDepositMinor > rawTotalDeposit || initialPaymentMinor - initialPaymentDepositMinor > grandTotal - rawTotalDeposit))}
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
                      <span>{formatCurrency(initialPaymentMinor)}</span>
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
