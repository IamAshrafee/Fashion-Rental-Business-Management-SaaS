'use client';

import React, { useState, useEffect } from 'react';
import {
  Edit2,
  Trash2,
  ListTree,
  Plus,
  Loader2,
  AlertCircle,
  Shapes,
  TableProperties
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useSizeSchemas, useSizeSchemaMutations } from '../hooks/use-product-apis';
import type { SizeSchemaDefinition } from '@closetrent/types';
import { SizeChartDialog } from './size-chart-dialog';

import { type SizeSchemaData } from '@/lib/api/products';
// ─── Name Dialog (create/edit) ───────────────────────────────────────────────

type DialogMode =
  | { type: 'create-schema' }
  | { type: 'edit-schema'; schema: SizeSchemaData };

function SizeSchemaDialog({
  mode,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: {
  mode: DialogMode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { code: string; name: string; description: string; schemaType: string; definition: SizeSchemaDefinition; instances?: any[] }) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schemaType, setSchemaType] = useState('STANDARD');
  const [dimensionsInput, setDimensionsInput] = useState('');
  const [selectorType, setSelectorType] = useState<string>('grid');
  const [instancesInput, setInstancesInput] = useState('');

  useEffect(() => {
    if (!open || !mode) return;
    if (mode.type === 'edit-schema') {
      setName(mode.schema.name);
      setDescription(mode.schema.description || '');
      setSchemaType(mode.schema.schemaType);
      
      const def = mode.schema.definition as SizeSchemaDefinition;
      setDimensionsInput(def?.dimensions?.map(d => d.label).join(', ') || '');
      setSelectorType(def?.ui?.selectorType || 'grid');
      // Instances cannot be edited from this dialog (would need separate UI)
      setInstancesInput('');
    } else {
      setName('');
      setDescription('');
      setSchemaType('STANDARD');
      setDimensionsInput('Chest, Waist, Length'); // sensible default for easy MVP
      setSelectorType('grid');
      setInstancesInput('XS, S, M, L, XL'); // default instances
    }
  }, [open, mode]);

  if (!mode) return null;

  const isEdit = mode.type === 'edit-schema';
  const title = isEdit ? 'Edit Size Schema' : 'New Size Schema';
  const descriptionText = isEdit
    ? 'Update the template properties below'
    : 'Create a new template defining required measurements.';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Parse comma-separated dimensions
    const dimensions = dimensionsInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(label => ({
        code: label.toLowerCase().replace(/\s+/g, '_'),
        label,
        type: 'number' as const,
        required: false,
      }));

    // Parse instances
    const instances = instancesInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map((label, idx) => ({ displayLabel: label, sortOrder: idx }));

    const code = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');

    onSubmit({
      code,
      name: name.trim(),
      description: description.trim(),
      schemaType,
      definition: {
        dimensions,
        ui: {
          selectorType: selectorType as 'grid' | 'dropdown' | 'composite' | 'component',
          displayTemplate: '',
          dimensionOrder: dimensions.map(d => d.code)
        },
        normalization: {
          normalizedKeyTemplate: '',
        }
      },
      instances: isEdit ? undefined : instances,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{descriptionText}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
            <div className="grid gap-2">
              <Label htmlFor="schema-name">Name</Label>
              <Input
                id="schema-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Standard Tops Sizing"
                maxLength={100}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="schema-desc">Description (optional)</Label>
              <Input
                id="schema-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Used for shirts, jackets, etc."
                maxLength={255}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="schema-type">Type</Label>
              <select
                id="schema-type"
                disabled={isEdit} // Cannot change type once created
                value={schemaType}
                onChange={(e) => setSchemaType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="STANDARD">Standard</option>
                <option value="MULTI_PART">Multi-Part Components (e.g. Suits)</option>
                <option value="FREE_SIZE">Free Size / Adjustable</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="schema-dimensions">Required Dimensions</Label>
              <Input
                id="schema-dimensions"
                value={dimensionsInput}
                onChange={(e) => setDimensionsInput(e.target.value)}
                placeholder="Chest, Waist, Length (Comma separated)"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of measurement fields to track for this sizing template.
              </p>
            </div>

            {!isEdit && (
              <div className="grid gap-2 mt-2 border-t pt-4">
                <Label htmlFor="schema-instances">Available Sizes (Instances)</Label>
                <Input
                  id="schema-instances"
                  value={instancesInput}
                  onChange={(e) => setInstancesInput(e.target.value)}
                  placeholder="e.g. XS, S, M, L, XL"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of the actual sizes for this template. (e.g. 36, 38, 40)
                </p>
              </div>
            )}

            <div className="grid gap-2 mt-2">
              <Label htmlFor="schema-selector">Storefront UI Selector type</Label>
              <select
                id="schema-selector"
                value={selectorType}
                onChange={(e) => setSelectorType(e.target.value as any)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="grid">Grid Buttons (Best for ≤12 sizes)</option>
                <option value="dropdown">Dropdown Select (Best for many sizes)</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface SizeSchemaManagerProps {
  onAddClick?: boolean;
  onAddHandled?: () => void;
}

export function SizeSchemaManager({ onAddClick, onAddHandled }: SizeSchemaManagerProps) {
  const { data: schemas, isLoading, isError } = useSizeSchemas();
  const mutations = useSizeSchemaMutations();

  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [chartDialogSchema, setChartDialogSchema] = useState<SizeSchemaData | null>(null);

  useEffect(() => {
    if (onAddClick) {
      setDialogMode({ type: 'create-schema' });
      setDialogOpen(true);
      onAddHandled?.();
    }
  }, [onAddClick, onAddHandled]);

  const handleDialogSubmit = (data: { code: string; name: string; description: string; schemaType: string; definition: any; instances?: any[] }) => {
    if (!dialogMode) return;

    if (dialogMode.type === 'create-schema') {
      mutations.createSchema.mutate(
        data,
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      mutations.updateSchema.mutate(
        { id: dialogMode.schema.id, ...data },
        { onSuccess: () => setDialogOpen(false) },
      );
    }
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    mutations.deleteSchema.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const isDialogSubmitting = mutations.createSchema.isPending || mutations.updateSchema.isPending;
  const isDeletePending = mutations.deleteSchema.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
        <AlertCircle className="h-8 w-8 text-destructive/60" />
        <p className="text-sm">Failed to load size schemas. Please try again.</p>
      </div>
    );
  }

  if (!schemas || schemas.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-48 gap-4 text-muted-foreground">
          <Shapes className="h-12 w-12 opacity-30" />
          <div className="text-center">
            <p className="font-medium text-foreground">No sizing templates yet</p>
            <p className="text-sm mt-1">Create predefined sizing templates (schemas) here</p>
          </div>
          <Button
            onClick={() => {
              setDialogMode({ type: 'create-schema' });
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Size Schema
          </Button>
        </div>

        <SizeSchemaDialog
          mode={dialogMode}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleDialogSubmit}
          isSubmitting={isDialogSubmitting}
        />
      </>
    );
  }

  return (
    <>
      <div className="w-full max-w-4xl mx-auto space-y-3">
        {schemas.map((schema) => {
          const def = schema.definition as SizeSchemaDefinition;
          const dimCount = def?.dimensions?.length || 0;
          
          return (
            <Card key={schema.id} className={`transition-shadow hover:shadow-md ${schema.status !== 'active' ? 'opacity-70' : ''}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-2 bg-primary/10 text-primary rounded-md shrink-0">
                  <ListTree className="h-5 w-5" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-foreground truncate">{schema.name}</h4>
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                      {schema.schemaType}
                    </span>
                    {schema.status !== 'active' && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        {schema.status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {schema.description || 'No description provided.'}
                  </p>
                </div>

                <div className="hidden sm:block shrink-0 px-4 border-l text-xs">
                  <p className="text-muted-foreground mb-1">Fields trackable</p>
                  <div className="flex gap-1 flex-wrap max-w-[150px]">
                    {def?.dimensions?.slice(0, 2).map(d => (
                      <span key={d.code} className="bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded text-[10px]">{d.label}</span>
                    ))}
                    {dimCount > 2 && <span className="bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded text-[10px]">+{dimCount - 2}</span>}
                    {dimCount === 0 && <span className="text-muted-foreground italic">None defined</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 pl-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="mr-2"
                    onClick={() => setChartDialogSchema(schema)}
                  >
                    <TableProperties className="h-4 w-4 mr-2" />
                    Size Guide
                  </Button>
                  {schema.status === 'draft' && (
                     <Button variant="ghost" size="sm" onClick={() => mutations.activateSchema.mutate(schema.id)}>Activate</Button>
                  )}
                  {schema.status === 'active' && (
                     <Button variant="ghost" size="sm" onClick={() => mutations.deprecateSchema.mutate(schema.id)}>Deprecate</Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setDialogMode({ type: 'edit-schema', schema });
                      setDialogOpen(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget({ id: schema.id, name: schema.name })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <SizeSchemaDialog
        mode={dialogMode}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleDialogSubmit}
        isSubmitting={isDialogSubmitting}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete sizing schema?"
        description={`"${deleteTarget?.name}" will be permanently removed. Products and instances tied to this schema will have their references nullified!`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        loading={isDeletePending}
      />

      <SizeChartDialog
        schema={chartDialogSchema}
        open={!!chartDialogSchema}
        onOpenChange={(open) => { if (!open) setChartDialogSchema(null); }}
      />
    </>
  );
}
