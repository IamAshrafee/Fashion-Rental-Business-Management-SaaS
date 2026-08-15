'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Payment } from '../../types';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RecordPaymentModal } from '../../components/modals/record-payment-modal';
import { formatMinorMoney } from '@/lib/money';
import { bookingApi } from '@/lib/api/bookings';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/api-error';

interface PaymentHistoryProps {
  payments: Payment[];
  bookingId: string;
  balanceDue: number;
  depositBalance: number;
}

export function PaymentHistory({ payments, bookingId, balanceDue, depositBalance }: PaymentHistoryProps) {
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [rejectingPayment, setRejectingPayment] = useState<Payment | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const queryClient = useQueryClient();
  const reviewClaim = useMutation({
    mutationFn: ({ paymentId, approve, reason }: { paymentId: string; approve: boolean; reason?: string }) =>
      bookingApi.reviewPaymentClaim(bookingId, paymentId, { approve, reason }),
    onSuccess: (_, variables) => {
      toast.success(variables.approve ? 'Payment claim verified' : 'Payment claim rejected');
      queryClient.invalidateQueries({ queryKey: ['bookings', 'detail', bookingId] });
      if (!variables.approve) {
        setRejectingPayment(null);
        setRejectionReason('');
      }
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'Could not review payment claim')),
  });

  return (
    <>
      <Card className="shadow-none border h-full">
        <CardHeader className="pb-3 flex-row items-center justify-between border-b space-y-0">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Payment Transactions
          </CardTitle>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setShowRecordModal(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Record
          </Button>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          
          {(!payments || payments.length === 0) ? (
            <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
              No payments recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map(payment => (
                <div key={payment.id} className="p-3 bg-muted/40 rounded-lg flex flex-col gap-2 relative">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-base">{formatMinorMoney(payment.amount)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Rental {formatMinorMoney(payment.rentalAmount)} · Deposit {formatMinorMoney(payment.depositAmount)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px] font-normal px-1.5 shadow-none bg-background border uppercase">{payment.method}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center">
                          {payment.status === 'verified' ? (
                            <span className="text-green-600 flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> Verified</span>
                          ) : payment.status === 'pending' ? (
                            <span className="text-yellow-600 flex items-center"><Clock className="h-3 w-3 mr-1" /> Pending</span>
                          ) : (
                            <span className="text-red-500 uppercase">{payment.status}</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-foreground">{format(parseISO(payment.createdAt), 'MMM d, h:mm a')}</div>
                      {payment.recordedBy && <div className="text-[10px] text-muted-foreground mt-1 text-right">By {payment.recordedBy}</div>}
                    </div>
                  </div>
                  {payment.transactionId && (
                    <div className="text-xs text-muted-foreground bg-background px-2 py-1 rounded inline-block w-max mt-1 border">
                      Txn: <span className="font-mono">{payment.transactionId}</span>
                    </div>
                  )}
                  {payment.notes && (
                    <div className="text-xs text-muted-foreground italic mt-1">{payment.notes}</div>
                  )}
                  {payment.status === 'pending' && (payment.method === 'bkash' || payment.method === 'nagad') && (
                    <div className="mt-2 flex gap-2 border-t pt-3">
                      <Button size="sm" className="h-8" disabled={reviewClaim.isPending} onClick={() => reviewClaim.mutate({ paymentId: payment.id, approve: true })}>
                        {reviewClaim.isPending && reviewClaim.variables?.paymentId === payment.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle className="mr-1 h-3 w-3" />} Verify
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-destructive" disabled={reviewClaim.isPending} onClick={() => setRejectingPayment(payment)}>
                        <XCircle className="mr-1 h-3 w-3" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </CardContent>
      </Card>

      <RecordPaymentModal
        isOpen={showRecordModal}
        onOpenChange={setShowRecordModal}
        bookingId={bookingId}
        balanceDue={balanceDue}
        depositBalance={depositBalance}
      />

      <Dialog open={Boolean(rejectingPayment)} onOpenChange={(open) => !open && setRejectingPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject payment claim</DialogTitle>
            <DialogDescription>
              Explain why the submitted mobile-payment claim could not be verified. This reason is stored in the payment audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="payment-rejection-reason">Rejection reason</Label>
            <Textarea
              id="payment-rejection-reason"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Example: The transaction ID was not found in the store's bKash statement."
              maxLength={1000}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingPayment(null)} disabled={reviewClaim.isPending}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={reviewClaim.isPending || !rejectionReason.trim() || !rejectingPayment}
              onClick={() => rejectingPayment && reviewClaim.mutate({ paymentId: rejectingPayment.id, approve: false, reason: rejectionReason.trim() })}
            >
              {reviewClaim.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
