'use client';

import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { ManualRentalPlan } from '@/lib/api/bookings';

interface RentalLocationOption {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  canFulfillRentals: boolean;
}

interface RentalPlanStepProps {
  active: boolean;
  complete: boolean;
  today: string;
  plan: ManualRentalPlan;
  locations: RentalLocationOption[];
  locationsLoading: boolean;
  onEdit: () => void;
  onBack: () => void;
  onContinue: () => void;
  onPlanChange: (patch: Partial<ManualRentalPlan>) => void;
}

export function RentalPlanStep({ active, complete, today, plan, locations, locationsLoading, onEdit, onBack, onContinue, onPlanChange }: RentalPlanStepProps) {
  return (
    <Card className="shadow-none border">
      <CardHeader className="pb-3 bg-muted/30 cursor-pointer" onClick={complete ? onEdit : undefined}>
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className={`h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center ${complete ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground'}`}>
              {complete ? <CheckCircle className="h-3 w-3" /> : '2'}
            </span>
            Rental Plan
          </span>
          {complete && plan.startDate && plan.endDate && <span className="text-xs font-medium text-green-600">{plan.startDate} → {plan.endDate}</span>}
        </CardTitle>
      </CardHeader>
      {active && (
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rental-plan-start">Rental start *</Label>
              <Input id="rental-plan-start" type="date" min={today} value={plan.startDate} onChange={(event) => onPlanChange({ startDate: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rental-plan-end">Rental end *</Label>
              <Input id="rental-plan-end" type="date" min={plan.startDate || today} value={plan.endDate} onChange={(event) => onPlanChange({ endDate: event.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Fulfillment location *</Label>
            <Select value={plan.sourceLocationId} onValueChange={(sourceLocationId) => onPlanChange({ sourceLocationId })}>
              <SelectTrigger><SelectValue placeholder={locationsLoading ? 'Loading locations…' : 'Select a location'} /></SelectTrigger>
              <SelectContent>
                {locations.filter((location) => location.canFulfillRentals).map((location) => (
                  <SelectItem key={location.id} value={location.id}>{location.name} ({location.code}){location.isDefault ? ' · Default' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Every main item and required set component is checked against this location.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Customer handover *</Label>
              <Select value={plan.handoverMethod} onValueChange={(handoverMethod: ManualRentalPlan['handoverMethod']) => onPlanChange({ handoverMethod })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="DELIVERY">Deliver to customer</SelectItem><SelectItem value="CUSTOMER_PICKUP">Customer pickup</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Return method *</Label>
              <Select value={plan.returnMethod} onValueChange={(returnMethod: ManualRentalPlan['returnMethod']) => onPlanChange({ returnMethod })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="BUSINESS_PICKUP">Business pickup</SelectItem><SelectItem value="CUSTOMER_RETURN">Customer returns to location</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="handover-notes">Handover instructions</Label>
            <Textarea id="handover-notes" value={plan.handoverNotes ?? ''} onChange={(event) => onPlanChange({ handoverNotes: event.target.value })} placeholder="Time window, landmark, pickup contact, or preparation note…" rows={2} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="transfer-plan" className="text-sm">Show transfer recovery</Label>
              <p className="text-xs text-muted-foreground">When this location is short, identify inventory at another location. A transfer must still be completed before confirmation.</p>
            </div>
            <Switch id="transfer-plan" checked={Boolean(plan.allowTransferPlan)} onCheckedChange={(allowTransferPlan) => onPlanChange({ allowTransferPlan })} />
          </div>
          <div className="flex justify-between pt-2">
            <Button type="button" variant="outline" onClick={onBack}>Back</Button>
            <Button type="button" onClick={onContinue}>Continue to Items</Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
