'use client';

import { useState } from 'react';
import { Payment } from '../../types';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Clock, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RecordPaymentModal } from '../../components/modals/record-payment-modal';

interface PaymentHistoryProps {
  payments: Payment[];
  bookingId: string;
  balanceDue: number;
}

export function PaymentHistory({ payments, bookingId, balanceDue }: PaymentHistoryProps) {
  const [showRecordModal, setShowRecordModal] = useState(false);

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
                      <div className="font-semibold text-base">৳{(payment.amount).toLocaleString()}</div>
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
      />
    </>
  );
}
