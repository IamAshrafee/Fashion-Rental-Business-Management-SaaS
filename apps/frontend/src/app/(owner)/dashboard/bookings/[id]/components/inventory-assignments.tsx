'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { bookingApi, type BookingDetailItem } from '@/lib/api/bookings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

function apiErrorMessage(error: unknown, fallback: string) {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

function AssignmentRow({ bookingId, item }: { bookingId: string; item: BookingDetailItem }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const queryKey = ['inventory-assignments', bookingId, item.id];
  const options = useQuery({ queryKey, queryFn: () => bookingApi.getAssignmentOptions(bookingId, item.id) });
  const remaining = Math.max(0, (options.data?.required ?? item.quantity) - (options.data?.assigned.length ?? 0));

  useEffect(() => {
    setSelected((current) => current.slice(0, remaining));
  }, [remaining]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ['bookings', 'detail', bookingId] }),
    ]);
  };

  const assign = useMutation({
    mutationFn: () => bookingApi.assignStockUnits(bookingId, item.id, selected),
    onSuccess: async () => {
      setSelected([]);
      await refresh();
      toast.success('Physical unit assigned');
    },
    onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Could not assign unit')),
  });

  const release = useMutation({
    mutationFn: (assignmentId: string) => bookingApi.releaseStockUnit(bookingId, item.id, assignmentId, 'Released from booking workspace'),
    onSuccess: async () => {
      await refresh();
      toast.success('Assignment released');
    },
    onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Could not release assignment')),
  });

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle className="text-base">{item.productName}</CardTitle><CardDescription>{item.variantName} · {item.variantSize?.sizeInstance.displayLabel || item.sizeInfo}</CardDescription></div>
          <Badge variant={remaining === 0 ? 'default' : 'secondary'}>{options.data?.assigned.length ?? 0}/{options.data?.required ?? item.quantity} assigned</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {options.isLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading eligible units…</div> : (
          <>
            {(options.data?.assigned.length ?? 0) > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assigned</p>
                {options.data?.assigned.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
                    <div><p className="font-mono text-sm font-medium">{assignment.stockUnit.assetCode}</p><p className="text-xs text-muted-foreground">{assignment.stockUnit.condition} · {assignment.stockUnit.locationLabel || 'No location'}</p></div>
                    <Button size="sm" variant="outline" disabled={release.isPending} onClick={() => release.mutate(assignment.id)}>Release</Button>
                  </div>
                ))}
              </div>
            )}

            {remaining > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Eligible units</p>
                {(options.data?.eligible.length ?? 0) === 0 ? <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No unblocked active unit is eligible for these rental dates.</p> : options.data?.eligible.map((unit) => {
                  const checked = selected.includes(unit.id);
                  return (
                    <label key={unit.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/30">
                      <Checkbox checked={checked} onCheckedChange={(value) => setSelected((current) => value ? [...current, unit.id].slice(0, remaining) : current.filter((id) => id !== unit.id))} />
                      <span className="flex-1"><span className="block font-mono text-sm font-medium">{unit.assetCode}</span><span className="block text-xs text-muted-foreground">{unit.condition} · {unit.locationLabel || 'No location'}</span></span>
                    </label>
                  );
                })}
                <Button disabled={selected.length === 0 || assign.isPending} onClick={() => assign.mutate()}>{assign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Assign selected ({selected.length})</Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function InventoryAssignments({ bookingId, items }: { bookingId: string; items: BookingDetailItem[] }) {
  const serializedItems = items.filter((item) => item.variantSize?.trackingMode === 'SERIALIZED' && item.inventoryReservation);
  if (serializedItems.length === 0) return null;

  return (
    <section className="space-y-4">
      <div><h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Boxes className="h-5 w-5" />Physical unit assignments</h2><p className="text-sm text-muted-foreground">Choose the exact serialized pieces that staff will prepare for this booking.</p></div>
      <div className="grid gap-4 xl:grid-cols-2">{serializedItems.map((item) => <AssignmentRow key={item.id} bookingId={bookingId} item={item} />)}</div>
    </section>
  );
}
