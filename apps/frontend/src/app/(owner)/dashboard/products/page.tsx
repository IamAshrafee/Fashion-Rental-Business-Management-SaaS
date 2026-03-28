'use client';

import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, FolderTree } from 'lucide-react';
import Link from 'next/link';
import { ProductsDataTable, ProductRow } from './components/product-list/data-table';

// Temporary mock data for the prototype
const MOCK_DATA: ProductRow[] = [
  {
    id: 'prod_1',
    name: 'Royal Banarasi Silk Saree',
    categoryId: 'Saree',
    status: 'published',
    price: 3500,
    targetRentals: 10,
    totalOrders: 15,
  },
  {
    id: 'prod_2',
    name: 'Georgette Lehenga Choli',
    categoryId: 'Lehenga',
    status: 'draft',
    price: 4500,
    targetRentals: 8,
    totalOrders: 0,
  },
  {
    id: 'prod_3',
    name: 'Premium Velvet Sherwani',
    categoryId: 'Sherwani',
    status: 'published',
    price: 5500,
    targetRentals: 20,
    totalOrders: 42,
  },
];

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Products"
          description="Manage your inventory and rental catalog"
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/products/categories">
              <FolderTree className="h-4 w-4 mr-2" />
              Categories
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/products/trash">
              <Trash2 className="h-4 w-4 mr-2" />
              Trash
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/products/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      <div className="bg-card text-card-foreground">
        <ProductsDataTable data={MOCK_DATA} />
      </div>
    </div>
  );
}
