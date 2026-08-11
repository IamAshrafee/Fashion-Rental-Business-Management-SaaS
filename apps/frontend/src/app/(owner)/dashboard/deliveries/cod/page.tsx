'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Banknote, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fulfillmentApi, type CodRemittance } from '@/lib/api/fulfillment';
import { useLocale } from '@/hooks/use-locale';

const FILTERS: Array<{ value?: CodRemittance['status']; label: string }> = [
  { label: 'Open' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'DISPUTED', label: 'Disputed' },
  { value: 'RECONCILED', label: 'Reconciled' },
];

export default function CodReconciliationPage() {
  const queryClient = useQueryClient();
  const { formatPrice } = useLocale();
  const [status, setStatus] = useState<CodRemittance['status'] | undefined>();
  const [selected, setSelected] = useState<CodRemittance | null>(null);
  const [form, setForm] = useState({ remittedAmount: '', feeDeducted: '', providerReference: '', remittedAt: '', notes: '', disputed: false });
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['cod-reconciliations', status],
    queryFn: () => fulfillmentApi.listCodReconciliations(status),
  });
  const rows = status ? data : data.filter((row) => ['PENDING', 'PARTIAL', 'DISPUTED'].includes(row.status));
  const reconcile = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Select a remittance');
      const remittedAmount = Math.round(Number(form.remittedAmount) * 100);
      const feeDeducted = Math.round(Number(form.feeDeducted || '0') * 100);
      if (!Number.isFinite(remittedAmount) || remittedAmount < 0 || !Number.isFinite(feeDeducted) || feeDeducted < 0) {
        throw new Error('Enter valid non-negative amounts');
      }
      return fulfillmentApi.reconcileCod(selected.id, {
        remittedAmount,
        feeDeducted,
        providerReference: form.providerReference || undefined,
        remittedAt: form.remittedAt ? new Date(`${form.remittedAt}T12:00:00`).toISOString() : undefined,
        notes: form.notes || undefined,
        disputed: form.disputed,
      });
    },
    onSuccess: () => {
      toast.success('COD reconciliation updated');
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['cod-reconciliations'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const open = (row: CodRemittance) => {
    setSelected(row);
    setForm({
      remittedAmount: (row.remittedAmount / 100).toFixed(2),
      feeDeducted: (row.feeDeducted / 100).toFixed(2),
      providerReference: row.providerReference ?? '',
      remittedAt: row.remittedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      notes: row.notes ?? '',
      disputed: row.status === 'DISPUTED',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild><Link href="/dashboard/deliveries"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <PageHeader title="COD reconciliation" description="Match courier remittances and deducted delivery fees against cash collected from customers." />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Button key={filter.label} size="sm" variant={status === filter.value ? 'default' : 'outline'} onClick={() => setStatus(filter.value)}>
            {filter.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Booking</TableHead><TableHead>Courier</TableHead><TableHead>Expected</TableHead><TableHead>Accounted</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                : isError ? <TableRow><TableCell colSpan={6} className="h-32 text-center text-destructive">Could not load COD remittances.</TableCell></TableRow>
                  : rows.length === 0 ? <TableRow><TableCell colSpan={6} className="h-40 text-center text-muted-foreground"><Banknote className="mx-auto mb-2 h-7 w-7 opacity-40" />No matching remittances.</TableCell></TableRow>
                    : rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell><Link className="font-medium text-primary hover:underline" href={`/dashboard/bookings/${row.shipment.booking.id}`}>{row.shipment.booking.bookingNumber}</Link><div className="text-xs text-muted-foreground">{row.shipment.booking.deliveryName}</div></TableCell>
                        <TableCell><span className="capitalize">{row.shipment.provider}</span><div className="font-mono text-xs text-muted-foreground">{row.shipment.trackingNumber ?? 'No tracking'}</div></TableCell>
                        <TableCell className="font-medium">{formatPrice(row.expectedAmount)}</TableCell>
                        <TableCell>{formatPrice(row.remittedAmount + row.feeDeducted)}<div className="text-xs text-muted-foreground">Fee {formatPrice(row.feeDeducted)}</div></TableCell>
                        <TableCell><Badge variant={row.status === 'RECONCILED' ? 'default' : row.status === 'DISPUTED' ? 'destructive' : 'outline'}>{row.status.toLowerCase()}</Badge></TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => open(row)}>{row.status === 'RECONCILED' ? 'Review' : 'Reconcile'}</Button></TableCell>
                      </TableRow>
                    ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(openState) => !openState && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reconcile courier remittance</DialogTitle><DialogDescription>Remitted cash plus the courier fee deduction must equal the expected COD amount to close this entry.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="remitted">Cash remitted (৳)</Label><Input id="remitted" type="number" min="0" step="0.01" value={form.remittedAmount} onChange={(event) => setForm((value) => ({ ...value, remittedAmount: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="fee">Courier fee deducted (৳)</Label><Input id="fee" type="number" min="0" step="0.01" value={form.feeDeducted} onChange={(event) => setForm((value) => ({ ...value, feeDeducted: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="reference">Settlement reference</Label><Input id="reference" value={form.providerReference} onChange={(event) => setForm((value) => ({ ...value, providerReference: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="date">Remittance date</Label><Input id="date" type="date" value={form.remittedAt} onChange={(event) => setForm((value) => ({ ...value, remittedAt: event.target.value }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" value={form.notes} onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))} /></div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.disputed} onChange={(event) => setForm((value) => ({ ...value, disputed: event.target.checked }))} />Mark this settlement as disputed</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button><Button onClick={() => reconcile.mutate()} disabled={reconcile.isPending}>{reconcile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save reconciliation</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
