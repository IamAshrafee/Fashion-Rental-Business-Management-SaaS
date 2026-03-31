'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api-admin';
import { SubscriptionPayment, PlatformInvoice, SubscriptionHistoryEntry } from '@closetrent/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  CreditCard, FileText, History, Plus, Loader2,
  ArrowUpRight, CalendarPlus, Download, Check,
} from 'lucide-react';

/** Money formatter — converts paisa to human-readable BDT */
function formatMoney(paisa: number) {
  return `৳${(paisa / 100).toLocaleString('en-BD', { minimumFractionDigits: 0 })}`;
}

interface BillingTabProps {
  tenantId: string;
  subscription: {
    id: string;
    status: string;
    billingCycle: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEndsAt: string | null;
    computedStatus: string;
    daysRemaining: number;
  } | null;
  planName: string | null;
  onSubscriptionUpdated: () => void;
}

const PAYMENT_METHODS = [
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export function BillingTab({
  tenantId,
  subscription,
  planName,
  onSubscriptionUpdated,
}: BillingTabProps) {
  const [activeTab, setActiveTab] = useState('payments');
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [history, setHistory] = useState<SubscriptionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment dialog
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '', method: 'bkash', reference: '', notes: '', extendMonths: '1',
  });

  // Invoice dialog
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    description: '', amount: '', dueDate: '', notes: '',
  });

  // Extend dialog
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendSaving, setExtendSaving] = useState(false);
  const [extendForm, setExtendForm] = useState({ months: '1', reason: '' });

  const loadTab = useCallback(async (tab: string) => {
    setLoading(true);
    try {
      if (tab === 'payments') {
        const res = await adminApi.getPaymentHistory(tenantId, { limit: 20 });
        setPayments(res.data);
      } else if (tab === 'invoices') {
        const res = await adminApi.getInvoices(tenantId, { limit: 20 });
        setInvoices(res.data);
      } else if (tab === 'history') {
        const res = await adminApi.getSubscriptionHistory(tenantId, { limit: 20 });
        setHistory(res.data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { loadTab(activeTab); }, [activeTab, loadTab]);

  // --- Record Payment ---
  async function handleRecordPayment() {
    const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setPaymentSaving(true);
    try {
      await adminApi.recordPayment(tenantId, {
        amount: Math.round(amount * 100), // Convert to paisa
        method: paymentForm.method,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
        extendMonths: parseInt(paymentForm.extendMonths) || 1,
      });
      toast.success('Payment recorded & subscription extended');
      setPaymentOpen(false);
      setPaymentForm({ amount: '', method: 'bkash', reference: '', notes: '', extendMonths: '1' });
      loadTab('payments');
      onSubscriptionUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to record payment');
    } finally { setPaymentSaving(false); }
  }

  // --- Generate Invoice ---
  async function handleGenerateInvoice() {
    const amount = parseFloat(invoiceForm.amount);
    if (!amount || !invoiceForm.dueDate) { toast.error('Amount and due date required'); return; }
    setInvoiceSaving(true);
    try {
      const amountPaisa = Math.round(amount * 100);
      await adminApi.generateInvoice(tenantId, {
        amount: amountPaisa,
        dueDate: new Date(invoiceForm.dueDate).toISOString(),
        lineItems: [{
          description: invoiceForm.description || 'Subscription Fee',
          quantity: 1,
          rate: amountPaisa,
          amount: amountPaisa,
        }],
        notes: invoiceForm.notes || undefined,
      });
      toast.success('Invoice generated');
      setInvoiceOpen(false);
      setInvoiceForm({ description: '', amount: '', dueDate: '', notes: '' });
      loadTab('invoices');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to generate invoice');
    } finally { setInvoiceSaving(false); }
  }

  // --- Extend Subscription ---
  async function handleExtend() {
    setExtendSaving(true);
    try {
      await adminApi.extendSubscription(tenantId, {
        months: parseInt(extendForm.months) || 1,
        reason: extendForm.reason || undefined,
      });
      toast.success('Subscription extended');
      setExtendOpen(false);
      setExtendForm({ months: '1', reason: '' });
      onSubscriptionUpdated();
      loadTab('history');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to extend');
    } finally { setExtendSaving(false); }
  }

  // --- Mark Invoice Paid/Void ---
  async function updateInvoiceStatus(id: string, status: string) {
    try {
      await adminApi.updateInvoiceStatus(id, { status });
      toast.success(`Invoice marked as ${status}`);
      loadTab('invoices');
    } catch { toast.error('Failed to update invoice'); }
  }

  // Status badge color
  function statusColor(status: string) {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-600 border-green-200';
      case 'trial': return 'bg-blue-500/10 text-blue-600 border-blue-200';
      case 'grace_period': return 'bg-amber-500/10 text-amber-600 border-amber-200';
      case 'expired': return 'bg-red-500/10 text-red-600 border-red-200';
      default: return '';
    }
  }

  return (
    <div className="space-y-6">
      {/* Subscription Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Subscription</CardTitle>
              <CardDescription>Current plan: {planName || 'None'}</CardDescription>
            </div>
            <div className="flex gap-2">
              {/* Extend Button */}
              <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <CalendarPlus className="mr-1 h-3.5 w-3.5" />Extend
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Extend Subscription</DialogTitle>
                    <DialogDescription>
                      Extend without changing the plan. Used for grace extensions or renewals.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Months</Label>
                      <Input type="number" min={1} max={24} value={extendForm.months}
                        onChange={e => setExtendForm(p => ({ ...p, months: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Reason</Label>
                      <Input placeholder="Optional reason..."
                        value={extendForm.reason}
                        onChange={e => setExtendForm(p => ({ ...p, reason: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setExtendOpen(false)}>Cancel</Button>
                    <Button onClick={handleExtend} disabled={extendSaving}>
                      {extendSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Extend
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        {subscription && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Status</p>
                <Badge variant="outline" className={statusColor(subscription.computedStatus)}>
                  {subscription.computedStatus}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Billing Cycle</p>
                <p className="font-medium capitalize">{subscription.billingCycle}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Period End</p>
                <p className="font-medium">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Days Left</p>
                <p className={`font-bold ${subscription.daysRemaining < 7 ? 'text-red-600' : 'text-green-600'}`}>
                  {subscription.daysRemaining > 36000 ? '∞' : subscription.daysRemaining}
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Billing Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="payments" className="gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />Payments
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />Invoices
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-3.5 w-3.5" />History
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            {activeTab === 'payments' && (
              <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" />Record Payment</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Manual Payment</DialogTitle>
                    <DialogDescription>
                      Record a payment received from this tenant. The subscription will auto-extend.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Amount (৳) *</Label>
                        <Input type="number" min={1} placeholder="5000"
                          value={paymentForm.amount}
                          onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Method *</Label>
                        <Select value={paymentForm.method}
                          onValueChange={v => setPaymentForm(p => ({ ...p, method: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map(m => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Reference/Transaction ID</Label>
                      <Input placeholder="TXN123456..."
                        value={paymentForm.reference}
                        onChange={e => setPaymentForm(p => ({ ...p, reference: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Extend Months</Label>
                      <Input type="number" min={1} max={12}
                        value={paymentForm.extendMonths}
                        onChange={e => setPaymentForm(p => ({ ...p, extendMonths: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea placeholder="Optional notes..."
                        value={paymentForm.notes}
                        onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
                    <Button onClick={handleRecordPayment} disabled={paymentSaving}>
                      {paymentSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Record Payment
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            {activeTab === 'invoices' && (
              <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" />Generate Invoice</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Generate Invoice</DialogTitle>
                    <DialogDescription>Create an invoice for this tenant.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input placeholder="Monthly subscription fee"
                        value={invoiceForm.description}
                        onChange={e => setInvoiceForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Amount (৳) *</Label>
                        <Input type="number" min={1} placeholder="5000"
                          value={invoiceForm.amount}
                          onChange={e => setInvoiceForm(p => ({ ...p, amount: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Due Date *</Label>
                        <Input type="date"
                          value={invoiceForm.dueDate}
                          onChange={e => setInvoiceForm(p => ({ ...p, dueDate: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea placeholder="Optional notes..."
                        value={invoiceForm.notes}
                        onChange={e => setInvoiceForm(p => ({ ...p, notes: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setInvoiceOpen(false)}>Cancel</Button>
                    <Button onClick={handleGenerateInvoice} disabled={invoiceSaving}>
                      {invoiceSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Generate
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Payments Tab */}
        <TabsContent value="payments" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : payments.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              No payments recorded yet
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {payments.map(p => (
                <Card key={p.id}>
                  <CardContent className="flex items-center justify-between py-3 px-4">
                    <div className="flex items-center gap-4">
                      <div className="h-9 w-9 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                        <CreditCard className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">{formatMoney(p.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.method.toUpperCase()} • {p.reference || 'No ref'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {new Date(p.periodStart).toLocaleDateString()} — {new Date(p.periodEnd).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleString()} • {p.recorder?.fullName}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : invoices.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              No invoices generated yet
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {invoices.map(inv => (
                <Card key={inv.id}>
                  <CardContent className="flex items-center justify-between py-3 px-4">
                    <div className="flex items-center gap-4">
                      <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{inv.invoiceNo}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(inv.amount)} • Due {new Date(inv.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={inv.status === 'paid' ? 'default' :
                        inv.status === 'void' ? 'secondary' : 'destructive'}>
                        {inv.status}
                      </Badge>
                      {inv.status === 'unpaid' && (
                        <>
                          <Button size="sm" variant="outline"
                            onClick={() => updateInvoiceStatus(inv.id, 'paid')}>
                            <Check className="mr-1 h-3 w-3" />Paid
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => updateInvoiceStatus(inv.id, 'void')}>
                            Void
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : history.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              No subscription changes yet
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {history.map(h => (
                <Card key={h.id}>
                  <CardContent className="flex items-center justify-between py-3 px-4">
                    <div className="flex items-center gap-4">
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center ${
                        h.action === 'upgraded' ? 'bg-green-100 dark:bg-green-900/20' :
                        h.action === 'downgraded' ? 'bg-red-100 dark:bg-red-900/20' :
                        'bg-muted'
                      }`}>
                        {h.action === 'upgraded' ? (
                          <ArrowUpRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <History className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{h.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {h.oldPlan ? `${h.oldPlan.name} →` : ''} {h.newPlan?.name || 'N/A'}
                          {h.reason && ` • ${h.reason}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{h.actor?.fullName || 'System'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(h.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
