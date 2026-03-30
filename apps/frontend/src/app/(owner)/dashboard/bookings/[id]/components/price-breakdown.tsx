import { Booking } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

// Fix #8: Map payment method codes to display labels
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: 'Cash on Delivery',
  bkash: 'bKash',
  nagad: 'Nagad',
  sslcommerz: 'SSLCommerz',
};

function getPaymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] || method.toUpperCase();
}

export function PriceBreakdown({ booking }: { booking: Booking }) {
  // Compute fee breakdowns from items
  const cleaningFeeTotal = booking.items.reduce((s, i) => s + i.cleaningFee, 0);
  const backupSizeFeeTotal = booking.items.reduce((s, i) => s + i.backupSizeFee, 0);
  const lateFeeTotal = booking.items.reduce((s, i) => s + i.lateFee, 0);

  return (
    <Card className="shadow-none border h-full">
      <CardHeader className="pb-3 bg-muted/30">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex justify-between items-center">
          Payment Summary
          <Badge variant="secondary" className="text-[11px] font-medium shadow-none bg-background border">
            {getPaymentMethodLabel(booking.paymentMethod)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">৳{booking.subtotal.toLocaleString()}</span>
          </div>
          
          {cleaningFeeTotal > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Cleaning Fee</span>
              <span>৳{cleaningFeeTotal.toLocaleString()}</span>
            </div>
          )}
          
          {backupSizeFeeTotal > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Backup Size Fee</span>
              <span>৳{backupSizeFeeTotal.toLocaleString()}</span>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Shipping</span>
            <span>{booking.shippingFee === 0 ? 'Free' : `৳${booking.shippingFee.toLocaleString()}`}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Security Deposit</span>
            <span>৳{booking.totalDeposit.toLocaleString()}</span>
          </div>

          {lateFeeTotal > 0 && (
            <div className="flex justify-between items-center text-red-600 font-medium">
              <span>Late Fees</span>
              <span>+৳{lateFeeTotal.toLocaleString()}</span>
            </div>
          )}
        </div>

        <Separator />
        
        <div className="space-y-2">
          <div className="flex justify-between items-center text-lg font-bold">
            <span>Grand Total</span>
            <span>৳{booking.grandTotal.toLocaleString()}</span>
          </div>
          
          <div className="flex justify-between items-center text-sm font-medium text-green-600 mt-2">
            <span>Paid</span>
            <span>৳{booking.totalPaid.toLocaleString()}</span>
          </div>
          
          {booking.balance > 0 ? (
            <div className="flex justify-between items-center text-sm font-semibold mt-1">
              <span className="text-muted-foreground">Balance Due</span>
              <span className="text-lg text-red-600">৳{booking.balance.toLocaleString()}</span>
            </div>
          ) : (
            <div className="flex justify-between items-center text-sm font-semibold mt-1 text-green-600">
              <span>Fully Paid</span>
              <span>✓</span>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
