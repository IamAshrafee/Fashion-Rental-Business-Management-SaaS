'use client';

import { FormEvent, useDeferredValue, useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { CreateCustomerDto } from '@closetrent/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CustomerDataTable } from './components/customer-data-table';
import { useCreateCustomer, useCustomers, useCustomerTags } from './hooks/use-customers';

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [tagId, setTagId] = useState('all');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('last_booking_at_desc');
  const [createOpen, setCreateOpen] = useState(false);
  const createCustomer = useCreateCustomer();
  const { data: tagsResponse } = useCustomerTags();
  const tags = tagsResponse?.data ?? [];
  const deferredSearch = useDeferredValue(search);
  const filters = useMemo(() => ({ page, limit: 25, search: deferredSearch.trim() || undefined, tagId: tagId === 'all' ? undefined : tagId, status: status === 'all' ? undefined : status, sort }), [deferredSearch, page, sort, status, tagId]);
  const { data, isLoading } = useCustomers(filters);

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const addressLine1 = String(form.get('addressLine1') ?? '').trim();
    const payload: CreateCustomerDto = {
      fullName: String(form.get('fullName') ?? '').trim(),
      identities: [
        { kind: 'phone', value: String(form.get('phone') ?? '').trim(), isPrimary: true },
        ...(email ? [{ kind: 'email' as const, value: email, isPrimary: true }] : []),
      ],
      preferredContactChannel: String(form.get('preferredContactChannel') ?? 'phone') as CreateCustomerDto['preferredContactChannel'],
      source: String(form.get('source') ?? '').trim() || 'walk-in',
      note: String(form.get('note') ?? '').trim() || undefined,
      address: addressLine1 ? {
        kind: 'delivery', label: 'Primary', addressLine1,
        area: String(form.get('area') ?? '').trim() || undefined,
        city: String(form.get('city') ?? '').trim() || undefined,
        state: String(form.get('state') ?? '').trim() || undefined,
        postalCode: String(form.get('postalCode') ?? '').trim() || undefined,
        country: 'BD', isDefault: true,
      } : undefined,
    };
    createCustomer.mutate(payload, { onSuccess: () => { setCreateOpen(false); setPage(1); } });
  };

  return (
    <main className="flex flex-1 flex-col gap-6 ">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Operational profiles, booking value, contact history, consent, and account readiness.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button><UserPlus data-icon="inline-start" />Add customer</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create customer profile</DialogTitle>
              <DialogDescription>A phone or email can belong to only one customer. Existing identities are never overwritten silently.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2"><Label htmlFor="customer-name">Full name</Label><Input id="customer-name" name="fullName" required minLength={2} autoComplete="name" /></div>
                <div className="flex flex-col gap-2"><Label htmlFor="customer-phone">Primary phone</Label><Input id="customer-phone" name="phone" required placeholder="01712345678" autoComplete="tel" /></div>
                <div className="flex flex-col gap-2"><Label htmlFor="customer-email">Email</Label><Input id="customer-email" name="email" type="email" autoComplete="email" /></div>
                <div className="flex flex-col gap-2"><Label htmlFor="customer-channel">Preferred contact</Label><Select name="preferredContactChannel" defaultValue="phone"><SelectTrigger id="customer-channel"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="phone">Phone call</SelectItem><SelectItem value="sms">SMS</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="email">Email</SelectItem></SelectGroup></SelectContent></Select></div>
                <div className="flex flex-col gap-2"><Label htmlFor="customer-source">Source</Label><Select name="source" defaultValue="walk-in"><SelectTrigger id="customer-source"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="walk-in">Walk-in</SelectItem><SelectItem value="phone">Phone inquiry</SelectItem><SelectItem value="social">Social media</SelectItem><SelectItem value="referral">Referral</SelectItem><SelectItem value="storefront">Storefront</SelectItem></SelectGroup></SelectContent></Select></div>
              </div>
              <div className="flex flex-col gap-3">
                <h3 className="font-medium">Optional delivery address</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="customer-address">Address</Label><Input id="customer-address" name="addressLine1" autoComplete="street-address" /></div>
                  <div className="flex flex-col gap-2"><Label htmlFor="customer-area">Area</Label><Input id="customer-area" name="area" /></div>
                  <div className="flex flex-col gap-2"><Label htmlFor="customer-city">City</Label><Input id="customer-city" name="city" /></div>
                  <div className="flex flex-col gap-2"><Label htmlFor="customer-state">District / state</Label><Input id="customer-state" name="state" /></div>
                  <div className="flex flex-col gap-2"><Label htmlFor="customer-postal">Postal code</Label><Input id="customer-postal" name="postalCode" /></div>
                </div>
              </div>
              <div className="flex flex-col gap-2"><Label htmlFor="customer-note">Internal note</Label><Textarea id="customer-note" name="note" maxLength={2000} /></div>
              <DialogFooter><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" disabled={createCustomer.isPending}>{createCustomer.isPending ? 'Creating…' : 'Create profile'}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardDescription>Profiles in this view</CardDescription><CardTitle>{data?.meta.total ?? 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Repeat customers on this page</CardDescription><CardTitle>{data?.data.filter((customer) => customer.totalBookings > 1).length ?? 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Customer accounts on this page</CardDescription><CardTitle>{data?.data.filter((customer) => customer.account).length ?? 0}</CardTitle></CardHeader></Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Customer directory</CardTitle>
          <CardDescription>Search normalized phone numbers, emails, or names. Open a profile for its complete operating history.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_180px_200px]">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="pl-9" placeholder="Name, phone, or email" aria-label="Search customers" /></div>
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="blocked">Blocked</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectGroup></SelectContent></Select>
            <Select value={tagId} onValueChange={(value) => { setTagId(value); setPage(1); }}><SelectTrigger><SelectValue placeholder="Tag" /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">All tags</SelectItem>{tags.map((tag) => <SelectItem key={tag.id} value={tag.id}>{tag.name} ({tag._count?.assignments ?? 0})</SelectItem>)}</SelectGroup></SelectContent></Select>
            <Select value={sort} onValueChange={setSort}><SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="last_booking_at_desc">Recently booked</SelectItem><SelectItem value="name_asc">Name A–Z</SelectItem><SelectItem value="total_bookings_desc">Most bookings</SelectItem><SelectItem value="total_spent_desc">Highest value</SelectItem></SelectGroup></SelectContent></Select>
          </div>
          <CustomerDataTable data={data?.data ?? []} isLoading={isLoading} meta={data?.meta} onPageChange={setPage} sort={sort} onSortChange={setSort} />
        </CardContent>
      </Card>
    </main>
  );
}
