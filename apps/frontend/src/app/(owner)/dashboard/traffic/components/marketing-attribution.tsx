import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AttributionSource } from '@closetrent/types';

export function MarketingAttribution({ data }: { data?: AttributionSource[] }) {
  if (!data) return null;

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>Marketing Attribution</CardTitle>
        <CardDescription>Track where your traffic is coming from via UTM tags.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No marketing data collected in this period.
          </div>
        ) : (
          <div className="overflow-auto max-h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Checkouts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, idx) => (
                  <TableRow key={`${item.source}-${item.campaign}-${idx}`}>
                    <TableCell className="font-medium">{item.source}</TableCell>
                    <TableCell className="text-muted-foreground">{item.campaign}</TableCell>
                    <TableCell className="text-right">{item.views}</TableCell>
                    <TableCell className="text-right font-semibold">{item.checkouts}</TableCell>
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
