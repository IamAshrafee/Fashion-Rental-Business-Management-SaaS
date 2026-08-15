'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, CircleDashed, Target } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { DashboardStats } from '@/hooks/use-booking-stats';

type Readiness = DashboardStats['setupReadiness'];
type ReadinessKey = keyof Readiness;

const STEPS: Array<{
  id: ReadinessKey;
  label: string;
  description: string;
  href: string;
}> = [
  { id: 'branding', label: 'Add your store logo', description: 'Gives the storefront and customer communications a recognizable identity.', href: '/dashboard/settings/branding' },
  { id: 'category', label: 'Create a product category', description: 'Organizes products so staff and customers can find them consistently.', href: '/dashboard/products/categories' },
  { id: 'publishedProduct', label: 'Publish a rentable product', description: 'Only published products are available to storefront customers.', href: '/dashboard/products/new' },
  { id: 'physicalInventory', label: 'Register a physical item', description: 'Every rentable garment needs its own asset identity and lifecycle record.', href: '/dashboard/inventory/items/register' },
  { id: 'payment', label: 'Configure a payment method', description: 'Add bKash, Nagad, or complete SSLCommerz credentials for checkout.', href: '/dashboard/settings/payment' },
  { id: 'delivery', label: 'Configure pickup operations', description: 'A pickup address and city are required for reliable handoff and delivery planning.', href: '/dashboard/settings/delivery' },
];

export function DashboardSetupWizard({ readiness }: { readiness: Readiness }) {
  const completed = STEPS.filter((step) => readiness[step.id]).length;
  if (completed === STEPS.length) return null;
  const progress = Math.round((completed / STEPS.length) * 100);

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-primary/5">
      <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-primary" />
              Store readiness
            </CardTitle>
            <CardDescription className="mt-1">
              This checklist is calculated from your live store configuration—not manually checked boxes.
            </CardDescription>
          </div>
          <span className="text-sm font-semibold text-primary">{completed}/{STEPS.length}</span>
        </div>
        <Progress value={progress} className="mt-2 h-2 bg-primary/20" />
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {STEPS.map((step) => {
            const isComplete = readiness[step.id];
            return (
              <Link key={step.id} href={step.href} className="group flex gap-3 rounded-md border bg-card p-3 shadow-sm transition-colors hover:border-primary/50 hover:bg-muted/30">
                {isComplete
                  ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                  : <CircleDashed className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 text-sm font-medium">
                    {step.label}
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {isComplete ? 'Complete. ' : ''}{step.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
