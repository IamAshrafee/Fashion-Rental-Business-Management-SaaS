import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TopViewedProduct } from '@closetrent/types';
import { ArrowRight } from 'lucide-react';

export function TopViewedProducts({ data }: { data?: TopViewedProduct[] }) {
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Viewed Products</CardTitle>
        <CardDescription>Products generating the most traffic and their cart conversion performance.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No product views tracked yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Total Views</TableHead>
                  <TableHead className="text-right">Cart Adds</TableHead>
                  <TableHead className="text-right">View-to-Cart</TableHead>
                  <TableHead className="text-right">Checkouts Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((product) => (
                  <TableRow key={product.productId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {product.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.thumbnailUrl}
                            alt={product.name}
                            className="h-10 w-10 rounded-md object-cover border"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground border">
                            No Img
                          </div>
                        )}
                        <span className="font-medium text-sm line-clamp-1 max-w-[200px]">
                          {product.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{product.views}</TableCell>
                    <TableCell className="text-right">{product.cartAdds}</TableCell>
                    <TableCell className="text-right">
                      <span className={`inline-flex items-center text-xs font-semibold px-2 py-1 rounded-full ${
                        product.viewToCartRate > 10 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {product.viewToCartRate}% <ArrowRight className="h-3 w-3 ml-1" />
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{product.checkoutStarts}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
