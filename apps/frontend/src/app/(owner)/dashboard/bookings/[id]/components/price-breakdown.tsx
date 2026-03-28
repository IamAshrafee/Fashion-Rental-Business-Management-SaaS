import { Booking } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export function PriceBreakdown({ booking }: { booking: Booking }) {
  return (
    <Card className="shadow-none border h-full">
      <CardHeader className="pb-3 bg-muted/30">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex justify-between items-center">
          Payment Summary
          <span className="text-foreground text-base capitalize">{booking.paymentMethod}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">৳{booking.subtotal.toLocaleString()}</span>
          </div>
          
          {booking.cleaningFeeTotal > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Cleaning Fee</span>
              <span>৳{booking.cleaningFeeTotal.toLocaleString()}</span>
            </div>
          )}
          
          {booking.backupSizeFeeTotal > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Backup Size Fee</span>
              <span>৳{booking.backupSizeFeeTotal.toLocaleString()}</span>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Shipping</span>
            <span>{booking.shippingFee === 0 ? 'Free' : `৳${booking.shippingFee.toLocaleString()}`}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Security Deposit</span>
            <span>৳{booking.depositTotal.toLocaleString()}</span>
          </div>

          {booking.lateFeeTotal > 0 && (
            <div className="flex justify-between items-center text-red-600 font-medium">
              <span>Late Fees</span>
              <span>+৳{booking.lateFeeTotal.toLocaleString()}</span>
            </div>
          )}

          {booking.discount > 0 && (
            <div className="flex justify-between items-center text-green-600 font-medium">
              <span>Discount</span>
              <span>-৳{booking.discount.toLocaleString()}</span>
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
            <span>৳{booking.amountPaid.toLocaleString()}</span>
          </div>
          
          <div className="flex justify-between items-center text-sm font-semibold mt-1">
            <span className="text-muted-foreground">Balance Due</span>
            <span className="text-lg">৳{booking.balance.toLocaleString()}</span>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
