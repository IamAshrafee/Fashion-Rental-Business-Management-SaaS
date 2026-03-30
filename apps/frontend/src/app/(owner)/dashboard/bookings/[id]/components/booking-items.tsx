'use client';

import { useState } from 'react';
import { BookingItem } from '../../types';
import { format, parseISO } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, ShieldAlert } from 'lucide-react';
import { ManageDepositModal } from '../../components/modals/manage-deposit-modal';
import { ReportDamageModal } from '../../components/modals/report-damage-modal';

interface BookingItemsProps {
  items: BookingItem[];
  bookingId: string;
  bookingStatus: string;
}

export function BookingItems({ items, bookingId, bookingStatus }: BookingItemsProps) {
  const [depositModal, setDepositModal] = useState<{ open: boolean; item: BookingItem | null }>({ open: false, item: null });
  const [damageModal, setDamageModal] = useState<{ open: boolean; item: BookingItem | null }>({ open: false, item: null });

  if (!items || items.length === 0) return <div>No items</div>;

  return (
    <>
      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Item</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Pricing</TableHead>
              <TableHead>Deposit</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className="align-top">
                {/* ITEM CELL */}
                <TableCell className="w-[30%]">
                  <div className="flex items-start gap-4">
                    <div className="h-16 w-16 bg-muted rounded-md overflow-hidden shrink-0 border">
                      {item.featuredImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.featuredImageUrl} alt={item.productName} className="object-cover h-full w-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground bg-muted">No IMG</div>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold">{item.productName}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {item.variantName}{item.sizeInfo ? ` • ${item.sizeInfo}` : ''}
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* DATES CELL */}
                <TableCell>
                  <div className="font-medium">
                    {format(parseISO(item.startDate), 'MMM d, yyyy')}
                  </div>
                  <div className="text-muted-foreground text-sm flex items-center gap-2">
                    <span>↓ to ↓</span>
                  </div>
                  <div className="font-medium">
                    {format(parseISO(item.endDate), 'MMM d, yyyy')}
                  </div>
                  <Badge variant="outline" className="mt-2 font-normal shadow-none">{item.rentalDays} Days</Badge>
                </TableCell>

                {/* PRICING CELL */}
                <TableCell className="text-sm">
                  <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                    <span className="text-muted-foreground">Rental:</span>
                    <span className="text-right">৳{(item.baseRental + item.extendedCost).toLocaleString()}</span>
                    
                    {item.cleaningFee > 0 && (
                      <>
                        <span className="text-muted-foreground">Cleaning:</span>
                        <span className="text-right">৳{item.cleaningFee.toLocaleString()}</span>
                      </>
                    )}
                    
                    {item.backupSizeFee > 0 && (
                      <>
                        <span className="text-muted-foreground">Backup Size:</span>
                        <span className="text-right">৳{item.backupSizeFee.toLocaleString()}</span>
                      </>
                    )}
                    
                    {item.lateFee > 0 && (
                      <>
                        <span className="text-red-500 flex items-center">Late Fee:</span>
                        <span className="text-right text-red-500 font-semibold">৳{item.lateFee.toLocaleString()}</span>
                      </>
                    )}
                  </div>
                </TableCell>

                {/* DEPOSIT CELL */}
                <TableCell>
                  <div className="font-medium">৳{item.depositAmount.toLocaleString()}</div>
                  <div className="mt-1">
                    {item.depositStatus === 'pending' && <Badge variant="outline" className="text-yellow-600 bg-yellow-50 border-yellow-200 shadow-none">Pending</Badge>}
                    {item.depositStatus === 'collected' && <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200 shadow-none">Collected</Badge>}
                    {item.depositStatus === 'held' && <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200 shadow-none">Held</Badge>}
                    {item.depositStatus === 'refunded' && <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200 shadow-none">Refunded</Badge>}
                    {item.depositStatus === 'partially_refunded' && <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200 shadow-none">Partial Refund</Badge>}
                    {item.depositStatus === 'forfeited' && <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200 shadow-none">Forfeited</Badge>}
                  </div>
                  
                  {/* Manage Deposit Button */}
                  {item.depositAmount > 0 && (
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2 shadow-none border-dashed bg-background hover:bg-muted"
                        onClick={() => setDepositModal({ open: true, item })}
                      >
                        <ShieldAlert className="h-3 w-3 mr-1" />
                        Manage Deposit
                      </Button>
                    </div>
                  )}

                  {/* Damage report indicator */}
                  {item.damageReport && (
                    <div className="mt-2 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 p-1.5 rounded border border-orange-200 dark:border-orange-800">
                      ⚠ Damage reported: {item.damageReport.damageLevel}
                    </div>
                  )}
                </TableCell>

                {/* TOTAL CELL */}
                <TableCell className="text-right">
                  <div className="text-lg font-bold">
                    ৳{item.itemTotal.toLocaleString()}
                  </div>
                  
                  {(bookingStatus === 'returned' || bookingStatus === 'inspected') && !item.damageReport && (
                    <Button
                      variant="default"
                      size="sm"
                      className="mt-4 h-8 text-xs bg-orange-600 hover:bg-orange-700 shadow-none"
                      onClick={() => setDamageModal({ open: true, item })}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Inspect Item
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modals */}
      {depositModal.item && (
        <ManageDepositModal
          isOpen={depositModal.open}
          onOpenChange={(open) => setDepositModal({ open, item: open ? depositModal.item : null })}
          bookingId={bookingId}
          itemId={depositModal.item.id}
          depositAmount={depositModal.item.depositAmount}
          depositStatus={depositModal.item.depositStatus}
        />
      )}

      {damageModal.item && (
        <ReportDamageModal
          isOpen={damageModal.open}
          onOpenChange={(open) => setDamageModal({ open, item: open ? damageModal.item : null })}
          bookingId={bookingId}
          itemId={damageModal.item.id}
          productName={damageModal.item.productName}
          variantName={damageModal.item.variantName}
          depositAmount={damageModal.item.depositAmount}
        />
      )}
    </>
  );
}
