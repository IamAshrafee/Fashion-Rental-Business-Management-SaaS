'use client';

import { DetailsFAQStep } from './details-faq';

export function ContentMediaStep() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Product details and FAQ</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add reusable specifications and answers that help customers rent with confidence.
        </p>
      </div>
      <DetailsFAQStep />
    </div>
  );
}
