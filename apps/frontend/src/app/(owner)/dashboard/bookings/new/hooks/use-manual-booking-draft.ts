'use client';

import { useEffect, type MutableRefObject } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import type { ManualRentalPlan } from '@/lib/api/bookings';

interface PersistedManualBookingDraft<TForm, TItem> {
  version: 2;
  creationKey: string;
  step: number;
  form: TForm;
  cartItems: TItem[];
  plan: ManualRentalPlan;
}

interface ManualBookingDraftOptions<TForm extends FieldValues, TItem> {
  tenantId?: string | null;
  ready: boolean;
  setReady: (ready: boolean) => void;
  form: UseFormReturn<TForm>;
  step: number;
  setStep: (step: number) => void;
  cartItems: TItem[];
  setCartItems: (items: TItem[]) => void;
  plan: ManualRentalPlan;
  applyPlan: (plan: ManualRentalPlan) => void;
  creationKey: MutableRefObject<string>;
  loadedDraftKey: MutableRefObject<string>;
  bookingCreated: MutableRefObject<boolean>;
  onRestored: () => void;
}

export function manualBookingDraftStorageKey(tenantId: string) {
  return `closetrent:manual-booking:${tenantId}:v2`;
}

export function useManualBookingDraft<TForm extends FieldValues, TItem>({
  tenantId,
  ready,
  setReady,
  form,
  step,
  setStep,
  cartItems,
  setCartItems,
  plan,
  applyPlan,
  creationKey,
  loadedDraftKey,
  bookingCreated,
  onRestored,
}: ManualBookingDraftOptions<TForm, TItem>) {
  useEffect(() => {
    if (!tenantId) return;
    const storageKey = manualBookingDraftStorageKey(tenantId);
    if (loadedDraftKey.current === storageKey) return;
    loadedDraftKey.current = storageKey;
    creationKey.current = crypto.randomUUID();
    localStorage.removeItem(`closetrent:manual-booking:${tenantId}:v1`);
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const draft = JSON.parse(stored) as PersistedManualBookingDraft<TForm, TItem>;
        if (draft.version === 2 && draft.creationKey && draft.plan) {
          form.reset(draft.form);
          setCartItems(Array.isArray(draft.cartItems) ? draft.cartItems : []);
          applyPlan(draft.plan);
          setStep(Math.min(Math.max(draft.step, 1), 4));
          creationKey.current = draft.creationKey;
          onRestored();
        }
      }
    } catch {
      localStorage.removeItem(storageKey);
    } finally {
      setReady(true);
    }
  }, [applyPlan, creationKey, form, loadedDraftKey, onRestored, setCartItems, setReady, setStep, tenantId]);

  useEffect(() => {
    if (!tenantId || !ready) return;
    const storageKey = manualBookingDraftStorageKey(tenantId);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (bookingCreated.current) return;
        const draft: PersistedManualBookingDraft<TForm, TItem> = {
          version: 2,
          creationKey: creationKey.current || crypto.randomUUID(),
          step,
          form: form.getValues(),
          cartItems,
          plan,
        };
        creationKey.current = draft.creationKey;
        localStorage.setItem(storageKey, JSON.stringify(draft));
      }, 250);
    };
    save();
    const subscription = form.watch(save);
    return () => {
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [bookingCreated, cartItems, creationKey, form, plan, ready, step, tenantId]);
}
