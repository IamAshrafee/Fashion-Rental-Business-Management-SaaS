'use client';

import { ContextHelp } from './context-help';
import type { ContextHelpKey } from '@/lib/help/types';

interface FieldTipProps {
  /** The tooltip help text */
  tip?: string;
  helpKey?: ContextHelpKey;
  /** Optional className for the icon wrapper */
  className?: string;
}

/**
 * A small (ℹ) icon that shows a tooltip on hover.
 * Place it next to a FormLabel for contextual help.
 *
 * Usage:
 * ```tsx
 * <FormLabel>
 *   Rental Price <FieldTip tip="The price customers pay for a single rental period." />
 * </FormLabel>
 * ```
 */
export function FieldTip({ tip, helpKey, className }: FieldTipProps) {
  return (
    <ContextHelp
      helpKey={helpKey}
      content={tip ? { title: 'About this field', meaning: tip } : undefined}
      className={className}
    />
  );
}
