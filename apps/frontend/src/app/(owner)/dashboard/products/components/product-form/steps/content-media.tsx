'use client';

import { Separator } from '@/components/ui/separator';
import { DetailsFAQStep } from './details-faq';
import { VariantsMediaStep } from './variants';

export function ContentMediaStep() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Storefront content</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload customer-facing photos, then add structured details and answers.
        </p>
      </div>
      <VariantsMediaStep showConfiguration={false} showMedia />
      <Separator />
      <DetailsFAQStep />
    </div>
  );
}
