'use client';

import { SizeStep } from './size';
import { DetailsFAQStep } from './details-faq';
import { Separator } from '@/components/ui/separator';

/**
 * Combined Size + Details/FAQ step for the creation wizard.
 * Reuses the existing individual step components via composition
 * rather than duplicating their logic.
 */
export function SizeDetailsStep() {
  return (
    <div className="space-y-8">
      {/* Section A — Sizing */}
      <SizeStep />

      <Separator className="my-8" />

      {/* Section B — Details & FAQ */}
      <DetailsFAQStep />
    </div>
  );
}
