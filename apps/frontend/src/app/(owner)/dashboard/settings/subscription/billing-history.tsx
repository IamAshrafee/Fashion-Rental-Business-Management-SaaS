'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/lib/api/settings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Banknote, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function BillingHistoryTable() {
  const { data: historyRes, isLoading } = useQuery({
    queryKey: ['billing-history'],
    queryFn: settingsApi.getBillingHistory,
  });

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-muted rounded-md mt-6" />;
  }

  const payments = historyRes?.data || [];

  if (payments.length === 0) {
    return (
      <Card className="mt-8 border-dashed shadow-none bg-transparent">
        <CardContent className="pt-6 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
          <Banknote className="w-8 h-8 mb-4 opacity-50" />
          <h4 className="text-sm font-medium text-foreground">No Purchase History</h4>
          <p className="text-xs mt-1">There are no recorded transactions for this store yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8 shadow-sm">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-lg">Transaction History</CardTitle>
        <CardDescription>View your past subscription payments and invoices.</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 px-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="pl-6">Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right pr-6">Invoice</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment: any) => (
              <TableRow key={payment.id}>
                <TableCell className="pl-6 font-medium whitespace-nowrap">
                  {format(new Date(payment.createdAt), 'MMM dd, yyyy')}
                </TableCell>
                <TableCell>
                  ৳{(payment.amount).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize text-xs font-normal">
                    {payment.method.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                  {format(new Date(payment.periodStart), 'MMM d, yyyy')} - {format(new Date(payment.periodEnd), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="text-right pr-6">
                  {payment.invoice ? (
                    <div className="flex items-center justify-end gap-2">
                       <Badge variant={payment.invoice.status === 'paid' ? 'default' : 'secondary'} className="text-[10px]">
                        {payment.invoice.status}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
