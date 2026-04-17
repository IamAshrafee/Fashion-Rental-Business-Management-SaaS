'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api-admin';
import { PageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Banknote, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function GlobalRevenuePage() {
  const { data: res, isLoading } = useQuery({
    queryKey: ['admin', 'revenue', 'payments'],
    queryFn: () => adminApi.getGlobalPayments(),
  });

  const payments = res?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue Ledger"
        description="Global view of all manual subscription payments recorded across the platform."
      />

      <Card className="rounded-lg shadow-sm border border-border">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : payments.length === 0 ? (
          <CardContent className="pt-6 flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <Banknote className="w-10 h-10 mb-4 opacity-50" />
            <h4 className="text-base font-medium text-foreground">No Revenue Recorded</h4>
            <p className="text-sm mt-1">There are no subscription payments recorded yet.</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="pl-6 whitespace-nowrap">Date & Time</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method & Ref</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right pr-6">Recorded By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment: any) => (
                  <TableRow key={payment.id} className="cursor-default hover:bg-muted/30">
                    <TableCell className="pl-6 whitespace-nowrap text-sm">
                      {format(new Date(payment.createdAt), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/tenants/${payment.tenant.id}`} className="font-medium text-primary hover:underline block">
                        {payment.tenant.businessName}
                      </Link>
                      <span className="text-xs text-muted-foreground font-mono">{payment.tenant.subdomain}</span>
                    </TableCell>
                    <TableCell className="font-medium text-green-700 dark:text-green-400 font-mono text-sm">
                      ৳{(payment.amount / 100).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant="outline" className="capitalize text-[10px] uppercase font-semibold">
                          {payment.method.replace('_', ' ')}
                        </Badge>
                        {payment.reference && (
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 rounded-sm">
                            {payment.reference}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {payment.invoice ? (
                        <div className="text-xs">
                          <span className="font-mono block">{payment.invoice.invoiceNo}</span>
                          <Badge variant={payment.invoice.status === 'paid' ? 'default' : 'secondary'} className="text-[9px] mt-1 uppercase">
                            {payment.invoice.status}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <span className="text-sm block">{payment.recorder?.fullName}</span>
                      <span className="text-[10px] text-muted-foreground">{payment.recorder?.email}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
