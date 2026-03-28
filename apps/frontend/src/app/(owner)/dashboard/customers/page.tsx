'use client';

import { useState } from 'react';
import { useCustomers } from './hooks/use-customers';
import { CustomerDataTable } from './components/customer-data-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('name_asc');

  const { data, isLoading } = useCustomers({
    page,
    limit: 20,
    search: search.trim() || undefined,
    tag: tagFilter !== 'all' ? tagFilter : undefined,
    sort
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Customers</h2>
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

        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            <SelectItem value="VIP">VIP</SelectItem>
            <SelectItem value="Frequent">Frequent</SelectItem>
            <SelectItem value="New">New</SelectItem>
            <SelectItem value="Blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-md border shadow-sm">
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
