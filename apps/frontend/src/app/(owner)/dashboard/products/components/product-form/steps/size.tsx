'use client';

import { useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import type { ProductFormValues } from '../schema';
import { cn } from '@/lib/utils';
import { sizingApi } from '@/lib/api/products';
import { Loader2, ChevronRight, Info, Layers, Grid3X3 } from 'lucide-react';

/**
 * SizeStep — Schema-driven product sizing.
 *
 * Flow:
 * 1. Select a product type (e.g., "Women's Dress", "Sneakers")
 * 2. Auto-loads the default size schema from product type
 * 3. Optionally override the schema
 * 4. Shows resolved size instances from the active schema
 */
export function SizeStep() {
  const { watch, setValue } = useFormContext<ProductFormValues>();
  const productTypeId = watch('productTypeId');
  const sizeSchemaOverrideId = watch('sizeSchemaOverrideId');
  const [showOverride, setShowOverride] = useState(false);

  // Load product types
  const { data: productTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: ['product-types'],
    queryFn: sizingApi.listProductTypes,
  });

  // Load schemas for override selector
  const { data: schemas = [], isLoading: schemasLoading } = useQuery({
    queryKey: ['size-schemas'],
    queryFn: () => sizingApi.listSchemas('active'),
    enabled: showOverride,
  });

  // Resolve the selected product type to get its schema + instances
  const selectedType = productTypes.find((t: any) => t.id === productTypeId);
  const activeSchemaId = sizeSchemaOverrideId || selectedType?.defaultSizeSchema?.id;

  // Load active schema details (instances)
  const { data: activeSchema, isLoading: schemaLoading } = useQuery({
    queryKey: ['size-schema-detail', activeSchemaId],
    queryFn: () => sizingApi.getSchema(activeSchemaId!),
    enabled: !!activeSchemaId,
  });

  // Auto-clear override when toggling off
  useEffect(() => {
    if (!showOverride) {
      setValue('sizeSchemaOverrideId', undefined);
    }
  }, [showOverride, setValue]);

  const instances = activeSchema?.instances || [];
  const sizeCharts = activeSchema?.sizeCharts || [];

  return (
    <div className="space-y-8">
      {/* ── Product Type Selector ───────────────────────────────────── */}
      <div>
        <label className="mb-3 block text-sm font-semibold text-gray-700">
          Product Type
        </label>
        <p className="mb-4 text-xs text-gray-500">
          Select the type of product — this determines the default sizing system.
        </p>

        {typesLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading product types...
          </div>
        ) : productTypes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            <Info className="mb-1 inline h-4 w-4" /> No product types found. 
            Please create product types in Settings → Product Types first.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {productTypes.map((type: any) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setValue('productTypeId', type.id)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-all',
                  productTypeId === type.id
                    ? 'border-black bg-gray-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                )}
              >
                <Layers className={cn('h-5 w-5', productTypeId === type.id ? 'text-black' : 'text-gray-400')} />
                <span className="text-sm font-semibold">{type.name}</span>
                {type.defaultSizeSchema && (
                  <span className="text-[10px] uppercase tracking-wider text-gray-400">
                    {type.defaultSizeSchema.name}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Schema Override Toggle ──────────────────────────────────── */}
      {productTypeId && (
        <div>
          <button
            type="button"
            onClick={() => setShowOverride(!showOverride)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-black transition-colors"
          >
            <ChevronRight className={cn('h-3 w-3 transition-transform', showOverride && 'rotate-90')} />
            Override Size Schema
          </button>

          {showOverride && (
            <div className="mt-3">
              {schemasLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {schemas.map((schema: any) => (
                    <button
                      key={schema.id}
                      type="button"
                      onClick={() => setValue('sizeSchemaOverrideId', schema.id)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm transition-all',
                        sizeSchemaOverrideId === schema.id
                          ? 'border-black bg-black text-white'
                          : 'border-gray-200 hover:border-gray-400'
                      )}
                    >
                      {schema.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Active Schema Preview ───────────────────────────────────── */}
      {activeSchemaId && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Grid3X3 className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">
              Available Sizes
              {activeSchema && <span className="ml-2 text-xs font-normal text-gray-400">({activeSchema.name})</span>}
            </h3>
          </div>

          {schemaLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading sizes...
            </div>
          ) : instances.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
              No size instances defined for this schema yet.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {instances.map((inst: any) => (
                <div
                  key={inst.id}
                  className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700"
                >
                  {inst.displayLabel}
                </div>
              ))}
            </div>
          )}

          {/* Size Chart Preview */}
          {sizeCharts.length > 0 && (
            <div className="mt-6">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Size Guide
              </h4>
              {sizeCharts.map((chart: any) => (
                <div key={chart.id} className="overflow-hidden rounded-lg border border-gray-200">
                  <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600">
                    {chart.title}
                  </div>
                  {chart.rows?.length > 0 && (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-gray-25">
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Size</th>
                          {Object.keys(chart.rows[0]?.measurements || {}).map((key) => (
                            <th key={key} className="px-3 py-2 text-left font-semibold text-gray-600 capitalize">
                              {key.replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {chart.rows.map((row: any) => (
                          <tr key={row.id} className="border-b last:border-0">
                            <td className="px-3 py-2 font-semibold text-gray-800">{row.sizeLabel}</td>
                            {Object.values(row.measurements || {}).map((val: any, idx: number) => (
                              <td key={idx} className="px-3 py-2 text-gray-600">{String(val)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SizeStep;
