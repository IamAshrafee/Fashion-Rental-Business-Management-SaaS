'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useSizeCharts, useSizeChartMutations } from '../hooks/use-product-apis';
import { SizeSchemaData, SizeInstanceData } from '@/lib/api/products';
import { SizeSchemaDefinition } from '@closetrent/types';

export function SizeChartDialog({
  schema,
  open,
  onOpenChange,
}: {
  schema: SizeSchemaData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: existingCharts, isLoading: isLoadingCharts } = useSizeCharts(schema?.id);
  const mutations = useSizeChartMutations();

  // Internal state for grid inputs [sizeLabel][dimension.code] = string
  const [gridData, setGridData] = useState<Record<string, Record<string, string>>>({});
  const [chartId, setChartId] = useState<string | null>(null);

  const def = schema?.definition as SizeSchemaDefinition;
  const dimensions = def?.dimensions || [];
  // For MVP, if instances aren't easily populated, we might not show them.
  // Wait, SizeSchemaData type has optional instances. Let's make sure backend actually includes them.
  // We'll rely on schema.instances.
  const instances = schema?.instances || [];

  useEffect(() => {
    if (!open || !schema) return;

    if (existingCharts && existingCharts.length > 0) {
      // Use the first chart for simplicity (global schema scope)
      const chart = existingCharts[0];
      setChartId(chart.id);

      const parsedGrid: Record<string, Record<string, string>> = {};
      chart.rows.forEach(row => {
        parsedGrid[row.sizeLabel] = (row.measurements as Record<string, string>) || {};
      });
      setGridData(parsedGrid);
    } else {
      setChartId(null);
      setGridData({});
    }
  }, [open, schema, existingCharts]);

  const handleInputChange = (sizeLabel: string, dimCode: string, value: string) => {
    setGridData(prev => ({
      ...prev,
      [sizeLabel]: {
        ...(prev[sizeLabel] || {}),
        [dimCode]: value
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schema) return;

    const rows = instances.map((inst, idx) => ({
      sizeLabel: inst.displayLabel,
      measurements: gridData[inst.displayLabel] || {},
      sortOrder: idx
    }));

    if (chartId) {
      // Delete old chart and recreate for simplicity in MVP, or normally we'd update.
      // Since backend doesn't have an update endpoint, we will drop and recreate:
      mutations.deleteChart.mutate(chartId, {
        onSuccess: () => {
          mutations.createChart.mutate({
            sizeSchemaId: schema.id,
            title: `${schema.name} Size Guide`,
            rows
          }, {
            onSuccess: () => onOpenChange(false)
          });
        }
      });
    } else {
      mutations.createChart.mutate({
        sizeSchemaId: schema.id,
        title: `${schema.name} Size Guide`,
        rows
      }, {
        onSuccess: () => onOpenChange(false)
      });
    }
  };

  if (!schema) return null;

  const isSubmitting = mutations.createChart.isPending || mutations.deleteChart.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Manage Size Guide: {schema.name}</DialogTitle>
            <DialogDescription>
              Input measurements for each size. This table will be displayed on the storefront for users to find their fit. You can input ranges (e.g. &quot;32-34&quot;).
            </DialogDescription>
          </DialogHeader>

          {isLoadingCharts ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : dimensions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed mt-4">
              This schema has no dimensions defined. Edit the schema to add tracking fields like Chest, Waist, etc.
            </div>
          ) : instances.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed mt-4">
              This schema has no size instances (e.g. XS, S, M) defined. You must recreate the schema to populate initial instances.
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto border rounded-md">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-muted-foreground border-b border-border">
                    <th className="font-medium p-3 text-left w-32 border-r">Size</th>
                    {dimensions.map(dim => (
                      <th key={dim.code} className="font-medium p-3 text-left">
                        {dim.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {instances.map(inst => (
                    <tr key={inst.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                      <td className="p-3 font-semibold text-foreground border-r bg-muted/5">
                        {inst.displayLabel}
                      </td>
                      {dimensions.map(dim => (
                        <td key={dim.code} className="p-2">
                          <Input
                            placeholder="e.g. 96-100"
                            className="h-8 shadow-none"
                            value={gridData[inst.displayLabel]?.[dim.code] || ''}
                            onChange={(e) => handleInputChange(inst.displayLabel, dim.code, e.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <DialogFooter className="mt-6">
            {chartId && (
              <Button
                type="button"
                variant="destructive"
                className="mr-auto"
                disabled={isSubmitting}
                onClick={() => {
                  mutations.deleteChart.mutate(chartId, {
                    onSuccess: () => onOpenChange(false)
                  });
                }}
              >
                Delete Guide
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || instances.length === 0 || dimensions.length === 0}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Size Guide
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
