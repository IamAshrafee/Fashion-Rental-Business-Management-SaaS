'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api-admin';
import { PromoCode, SubscriptionPlan } from '@closetrent/types';
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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Plus, Copy, Gift, Users, Calendar, Percent, Link2,
  Loader2, ToggleLeft, ToggleRight,
} from 'lucide-react';

export default function PromoCodesPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    linkedPlanId: '',
    trialDays: '',
    maxUses: '',
    expiresAt: '',
    isActive: true,
  });

  const loadData = useCallback(async () => {
    try {
      const [codesRes, plansRes] = await Promise.all([
        adminApi.getPromoCodes({ limit: 50 }),
        adminApi.getPlans(),
      ]);
      setPromoCodes(codesRes.data);
      setPlans(plansRes.data);
    } catch { toast.error('Failed to load promo codes'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleCreate() {
    if (!form.code) { toast.error('Code is required'); return; }
    setSaving(true);
    try {
      await adminApi.createPromoCode({
        code: form.code.toUpperCase(),
        linkedPlanId: form.linkedPlanId || undefined,
        trialDays: form.trialDays ? parseInt(form.trialDays) : undefined,
        maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
        expiresAt: form.expiresAt || undefined,
        isActive: form.isActive,
      });
      toast.success('Promo code created');
      setDialogOpen(false);
      setForm({ code: '', linkedPlanId: '', trialDays: '', maxUses: '', expiresAt: '', isActive: true });
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create promo code');
    } finally { setSaving(false); }
  }

  async function toggleActive(id: string, current: boolean) {
    try {
      await adminApi.updatePromoCode(id, { isActive: !current });
      toast.success(`Promo code ${!current ? 'activated' : 'deactivated'}`);
      loadData();
    } catch { toast.error('Failed to update'); }
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/register?promo=${code}`;
    navigator.clipboard.writeText(url);
    toast.success('Registration link copied!');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Promo Codes</h1>
          <p className="text-muted-foreground">
            Create marketing codes for plan-specific registration links
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Create Code</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Promo Code</DialogTitle>
              <DialogDescription>
                Create a code that auto-assigns a plan when used during registration.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  placeholder="LAUNCH2026"
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  className="uppercase tracking-wider"
                />
              </div>
              <div className="space-y-2">
                <Label>Linked Plan</Label>
                <Select value={form.linkedPlanId} onValueChange={v => setForm(p => ({ ...p, linkedPlanId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select a plan..." /></SelectTrigger>
                  <SelectContent>
                    {plans.filter(p => p.isActive).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Trial Days</Label>
                  <Input type="number" placeholder="30" value={form.trialDays}
                    onChange={e => setForm(p => ({ ...p, trialDays: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Max Uses</Label>
                  <Input type="number" placeholder="Unlimited" value={form.maxUses}
                    onChange={e => setForm(p => ({ ...p, maxUses: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Expires At</Label>
                <Input type="datetime-local" value={form.expiresAt}
                  onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={form.isActive}
                  onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {promoCodes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Gift className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">No promo codes yet</h3>
            <p className="text-muted-foreground mt-1">
              Create your first promo code to start marketing campaigns.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {promoCodes.map(promo => (
            <Card key={promo.id} className={!promo.isActive ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-mono tracking-wider">
                    {promo.code}
                  </CardTitle>
                  <Badge variant={promo.isActive ? 'default' : 'secondary'}>
                    {promo.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {promo.linkedPlan && (
                  <CardDescription className="flex items-center gap-1">
                    <Link2 className="h-3 w-3" />
                    → {(promo.linkedPlan as any).name} Plan
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {promo.currentUses}{promo.maxUses ? `/${promo.maxUses}` : ''} uses
                  </div>
                  {promo.trialDays && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {promo.trialDays}d trial
                    </div>
                  )}
                  {promo.expiresAt && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      Exp: {new Date(promo.expiresAt).toLocaleDateString()}
                    </div>
                  )}
                  {promo._count?.tenants !== undefined && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      {promo._count.tenants} tenant(s)
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" className="flex-1"
                    onClick={() => copyLink(promo.code)}>
                    <Copy className="mr-1 h-3 w-3" />Copy Link
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={() => toggleActive(promo.id, promo.isActive)}>
                    {promo.isActive
                      ? <ToggleRight className="h-4 w-4 text-green-600" />
                      : <ToggleLeft className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
