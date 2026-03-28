'use client';

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

export function BookingItems({ items }: { items: BookingItem[] }) {
  if (!items || items.length === 0) return <div>No items</div>;

  return (
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
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.productName} className="object-cover h-full w-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground bg-muted">No IMG</div>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold">{item.productName}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {item.variantName} • {item.sizeName}
                    </div>
                    <div className="mt-2 inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-secondary">
                      {item.status.toUpperCase()}
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
                <Badge variant="outline" className="mt-2 font-normal shadow-none">{item.days} Days</Badge>
              </TableCell>

              {/* PRICING CELL */}
              <TableCell className="text-sm">
                <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">Rental:</span>
                  <span className="text-right">৳{item.rentalPrice}</span>
                  
                  {item.cleaningFee > 0 && (
                    <>
                      <span className="text-muted-foreground">Cleaning:</span>
                      <span className="text-right">৳{item.cleaningFee}</span>
                    </>
                  )}
                  
                  {item.backupSizeFee > 0 && (
                    <>
                      <span className="text-muted-foreground">Backup Size:</span>
                      <span className="text-right">৳{item.backupSizeFee}</span>
                    </>
                  )}
                  
                  {item.lateFee > 0 && (
                    <>
                      <span className="text-red-500 flex items-center">Late Fee:</span>
                      <span className="text-right text-red-500 font-semibold">৳{item.lateFee}</span>
                    </>
                  )}
                </div>
              </TableCell>

              {/* DEPOSIT CELL */}
              <TableCell>
                <div className="font-medium">৳{item.depositAmount}</div>
                <div className="mt-1">
                  {item.depositStatus === 'pending' && <Badge variant="outline" className="text-yellow-600 bg-yellow-50 border-yellow-200 shadow-none">Pending</Badge>}
                  {item.depositStatus === 'collected' && <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200 shadow-none">Collected</Badge>}
                  {item.depositStatus === 'held' && <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200 shadow-none">Held</Badge>}
                  {item.depositStatus === 'refunded' && <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200 shadow-none">Refunded</Badge>}
                  {item.depositStatus === 'partially_refunded' && <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200 shadow-none">Partial Refund</Badge>}
                  {item.depositStatus === 'forfeited' && <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200 shadow-none">Forfeited</Badge>}
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2 mt-3">
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2 shadow-none border-dashed bg-background hover:bg-muted">
                    <ShieldAlert className="h-3 w-3 mr-1" />
                    Manage Deposit
                  </Button>
                </div>
              </TableCell>

              {/* TOTAL CELL */}
              <TableCell className="text-right">
                <div className="text-lg font-bold">
                  ৳{item.itemTotal.toLocaleString()}
                </div>
                
                {(item.status === 'returned' || item.status === 'inspected') && (
                  <Button variant="default" size="sm" className="mt-4 h-8 text-xs bg-orange-600 hover:bg-orange-700 shadow-none">
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
  );
}
