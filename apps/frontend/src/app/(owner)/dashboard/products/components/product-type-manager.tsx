'use client';

import React, { useState, useEffect } from 'react';
import {
  Edit2,
  Trash2,
  Tag,
  Plus,
  Loader2,
  AlertCircle,
  PackageSearch
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useProductTypes, useProductTypeMutations, useSizeSchemas } from '../hooks/use-product-apis';
import type { ProductTypeData } from '@/lib/api/products';

// ─── Name Dialog (create/edit) ───────────────────────────────────────────────

type DialogMode =
  | { type: 'create-product-type' }
  | { type: 'edit-product-type'; productType: ProductTypeData };

function ProductTypeDialog({
  mode,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: {
  mode: DialogMode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; description: string; defaultSizeSchemaId: string }) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultSizeSchemaId, setDefaultSizeSchemaId] = useState('');

  const { data: schemas } = useSizeSchemas();
  const activeSchemas = schemas?.filter((s) => s.status === 'active') || [];

  useEffect(() => {
    if (!open || !mode) return;
    if (mode.type === 'edit-product-type') {
      setName(mode.productType.name);
      setDescription(mode.productType.description || '');
      setDefaultSizeSchemaId(mode.productType.defaultSizeSchema?.id || '');
    } else {
      setName('');
      setDescription('');
      setDefaultSizeSchemaId('');
    }
  }, [open, mode]);

  if (!mode) return null;

  const isEdit = mode.type === 'edit-product-type';
  const title = isEdit ? 'Edit Product Type' : 'New Product Type';
  const descriptionText = isEdit
    ? 'Update the product type properties below'
    : 'Define a new kind of product and its default sizing schema.';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      defaultSizeSchemaId: defaultSizeSchemaId || '',
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

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="product-type-name">Name</Label>
              <Input
                id="product-type-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dresses, Shoes, Suits"
                maxLength={100}
                minLength={2}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="product-type-desc">Description (optional)</Label>
              <Input
                id="product-type-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. All kinds of formal dresses"
                maxLength={255}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product-type-schema">Default Size Schema (optional)</Label>
              <select
                id="product-type-schema"
                value={defaultSizeSchemaId}
                onChange={(e) => setDefaultSizeSchemaId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">-- No Default Schema --</option>
                {activeSchemas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.schemaType})
                  </option>
                ))}
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

interface ProductTypeManagerProps {
  onAddClick?: boolean;
  onAddHandled?: () => void;
}

export function ProductTypeManager({ onAddClick, onAddHandled }: ProductTypeManagerProps) {
  const { data: productTypes, isLoading, isError } = useProductTypes();
  const mutations = useProductTypeMutations();

  // Dialog state
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (onAddClick) {
      setDialogMode({ type: 'create-product-type' });
      setDialogOpen(true);
      onAddHandled?.();
    }
  }, [onAddClick, onAddHandled]);

  const handleDialogSubmit = (data: { name: string; description: string; defaultSizeSchemaId: string }) => {
    if (!dialogMode) return;

    if (dialogMode.type === 'create-product-type') {
      mutations.createProductType.mutate(
        data,
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      mutations.updateProductType.mutate(
        { id: dialogMode.productType.id, ...data },
        { onSuccess: () => setDialogOpen(false) },
      );
    }
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    mutations.deleteProductType.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const isDialogSubmitting = mutations.createProductType.isPending || mutations.updateProductType.isPending;
  const isDeletePending = mutations.deleteProductType.isPending;

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
        <p className="text-sm">Failed to load product types. Please try again.</p>
      </div>
    );
  }

  if (!productTypes || productTypes.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-48 gap-4 text-muted-foreground">
          <PackageSearch className="h-12 w-12 opacity-30" />
          <div className="text-center">
            <p className="font-medium text-foreground">No product types yet</p>
            <p className="text-sm mt-1">Create product types to standardize sizing structures</p>
          </div>
          <Button
            onClick={() => {
              setDialogMode({ type: 'create-product-type' });
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Product Type
          </Button>
        </div>

        <ProductTypeDialog
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
      <div className="w-full max-w-3xl mx-auto space-y-2">
        {productTypes.map((pt) => (
          <Card key={pt.id} className="relative group transition-shadow hover:shadow-md">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 bg-primary/10 text-primary rounded-md shrink-0">
                <Tag className="h-5 w-5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-foreground truncate">{pt.name}</h4>
                <p className="text-xs text-muted-foreground truncate">
                  {pt.description || 'No description'}
                </p>
              </div>

              <div className="hidden sm:block shrink-0 px-3 border-l text-xs">
                <p className="text-muted-foreground">Default Schema</p>
                <p className="font-medium">{pt.defaultSizeSchema?.name || 'None'}</p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setDialogMode({ type: 'edit-product-type', productType: pt });
                    setDialogOpen(true);
                  }}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget({ id: pt.id, name: pt.name })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ProductTypeDialog
        mode={dialogMode}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleDialogSubmit}
        isSubmitting={isDialogSubmitting}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete product type?"
        description={`"${deleteTarget?.name}" will be permanently removed. Products using this type will lose their default sizing associations.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        loading={isDeletePending}
      />
    </>
  );
}
