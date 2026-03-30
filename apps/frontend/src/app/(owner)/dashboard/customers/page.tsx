'use client';

import { useState } from 'react';
import { useCustomers, useCustomerTags, useCreateCustomer } from './hooks/use-customers';
import { CustomerDataTable } from './components/customer-data-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Plus, UserPlus } from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CreateCustomerDto } from '@closetrent/types';

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('name_asc');

  // S3: Fetch tags dynamically from backend
  const { data: tags } = useCustomerTags();

  const { data, isLoading } = useCustomers({
    page,
    limit: 20,
    search: search.trim() || undefined,
    tag: tagFilter !== 'all' ? tagFilter : undefined,
    sort
  });

  // S1: Create customer dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const createCustomer = useCreateCustomer();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload: CreateCustomerDto = {
      fullName: form.get('fullName') as string,
      phone: form.get('phone') as string,
      altPhone: (form.get('altPhone') as string) || undefined,
      email: (form.get('email') as string) || undefined,
      addressLine1: (form.get('addressLine1') as string) || undefined,
      city: (form.get('city') as string) || undefined,
      state: (form.get('state') as string) || undefined,
      postalCode: (form.get('postalCode') as string) || undefined,
      notes: (form.get('notes') as string) || undefined,
    };
    createCustomer.mutate(payload, {
      onSuccess: () => setCreateOpen(false),
    });
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Customers</h2>

        {/* S1: Add Customer button + dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Customer</DialogTitle>
              <DialogDescription>
                Create a new customer. If the phone number already exists, the existing record will be updated.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-fullName">Full Name *</Label>
                  <Input id="create-fullName" name="fullName" required minLength={2} maxLength={200} placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-phone">Phone *</Label>
                  <Input id="create-phone" name="phone" required minLength={5} maxLength={20} placeholder="01712345678" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-email">Email</Label>
                  <Input id="create-email" name="email" type="email" placeholder="john@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-altPhone">Alt Phone</Label>
                  <Input id="create-altPhone" name="altPhone" placeholder="01812345678" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-addressLine1">Address</Label>
                <Input id="create-addressLine1" name="addressLine1" placeholder="Street address" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-city">City</Label>
                  <Input id="create-city" name="city" placeholder="Dhaka" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-state">State</Label>
                  <Input id="create-state" name="state" placeholder="Dhaka" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-postalCode">Postal Code</Label>
                  <Input id="create-postalCode" name="postalCode" placeholder="1200" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-notes">Notes</Label>
                <Input id="create-notes" name="notes" placeholder="Internal notes..." />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createCustomer.isPending}>
                  {createCustomer.isPending ? 'Creating...' : 'Create Customer'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-1 items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name or phone..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary">Search</Button>
        </form>

        {/* S3: Dynamic tag filter from backend */}
        <Select value={tagFilter} onValueChange={(v) => { setTagFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {(tags?.data ?? []).map((tag: string) => (
              <SelectItem key={tag} value={tag}>{tag}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-md border shadow-sm">
        <CustomerDataTable 
            data={data?.data || []} 
            isLoading={isLoading} 
            meta={data?.meta}
            onPageChange={setPage}
            sort={sort}
            onSortChange={setSort}
        />
      </div>
    </div>
  );
}
