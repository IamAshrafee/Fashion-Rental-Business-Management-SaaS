'use client';

import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Edit2,
  Trash2,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Loader2,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
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
import { useCategories, useCategoryMutations } from '../hooks/use-product-apis';
import type { OwnerCategory, OwnerSubcategory } from '@/lib/api/products';

// ─── Sortable Row ─────────────────────────────────────────────────────────────

function SortableCategoryRow({
  category,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onToggleActive,
  onAddSubcategory,
  onEditSubcategory,
  onDeleteSubcategory,
  onToggleSubActive,
}: {
  category: OwnerCategory;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (checked: boolean) => void;
  onAddSubcategory: () => void;
  onEditSubcategory: (sub: OwnerSubcategory) => void;
  onDeleteSubcategory: (sub: OwnerSubcategory) => void;
  onToggleSubActive: (sub: OwnerSubcategory, checked: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };

  const hasSubcategories = category.subcategories.length > 0;

  return (
    <div ref={setNodeRef} style={style} className="mb-2">
      {/* Main category row */}
      <Card className={`relative group transition-shadow ${isDragging ? 'shadow-lg ring-2 ring-primary/20' : ''} ${!category.isActive ? 'opacity-60' : ''}`}>
        <CardContent className="p-3 flex items-center gap-3">
          {/* Drag handle */}
          <button
            className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing p-1 rounded-md hover:bg-muted transition-colors shrink-0"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>

          {/* Expand/collapse chevron */}
          <button
            onClick={onToggleExpand}
            className="p-1 rounded-md hover:bg-muted transition-colors shrink-0 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {/* Icon */}
          {isExpanded ? (
            <FolderOpen className="h-5 w-5 text-primary shrink-0" />
          ) : (
            <Folder className="h-5 w-5 text-primary/70 shrink-0" />
          )}

          {/* Name */}
          <button
            onClick={onToggleExpand}
            className="flex-1 text-left font-medium text-sm hover:text-primary transition-colors cursor-pointer"
          >
            {category.icon && <span className="mr-1.5">{category.icon}</span>}
            {category.name}
          </button>

          {/* Subcategory count */}
          {hasSubcategories && (
            <div className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0 hidden sm:block">
              {category.subcategories.length} sub
            </div>
          )}

          {/* Product count */}
          <div className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
            {category._count.products} items
          </div>

          {/* Active toggle */}
          <Switch
            checked={category.isActive}
            onCheckedChange={onToggleActive}
            className="shrink-0"
          />

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={onEdit}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Expanded subcategories */}
      {isExpanded && (
        <div className="ml-12 mt-1 space-y-1 mb-3">
          {category.subcategories
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((sub) => (
              <div
                key={sub.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card transition-colors group/sub ${!sub.isActive ? 'opacity-60' : ''}`}
              >
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-medium">
                  {sub.name}
                </span>
                <Switch
                  checked={sub.isActive}
                  onCheckedChange={(checked) => onToggleSubActive(sub, checked)}
                  className="shrink-0"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => onEditSubcategory(sub)}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => onDeleteSubcategory(sub)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}

          {/* Add subcategory button */}
          <button
            onClick={onAddSubcategory}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/50 transition-all w-full cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add subcategory
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Name Dialog (shared for create/edit of both categories and subcategories) ─

type DialogMode =
  | { type: 'create-category' }
  | { type: 'edit-category'; category: OwnerCategory }
  | { type: 'create-subcategory'; categoryId: string; categoryName: string }
  | { type: 'edit-subcategory'; subcategory: OwnerSubcategory };

function NameDialog({
  mode,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: {
  mode: DialogMode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, icon?: string) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');

  // Sync initial values when dialog opens
  useEffect(() => {
    if (!open || !mode) return;
    if (mode.type === 'edit-category') {
      setName(mode.category.name);
      setIcon(mode.category.icon || '');
    } else if (mode.type === 'edit-subcategory') {
      setName(mode.subcategory.name);
      setIcon('');
    } else {
      setName('');
      setIcon('');
    }
  }, [open, mode]);

  if (!mode) return null;

  const isCategory = mode.type === 'create-category' || mode.type === 'edit-category';
  const isEdit = mode.type === 'edit-category' || mode.type === 'edit-subcategory';
  const title = isEdit
    ? isCategory ? 'Edit Category' : 'Edit Subcategory'
    : isCategory ? 'New Category' : 'New Subcategory';
  const description = mode.type === 'create-subcategory'
    ? `Add a subcategory under "${mode.categoryName}"`
    : isEdit
      ? 'Update the name below'
      : 'Enter a name for the new category';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), isCategory ? icon.trim() || undefined : undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isCategory ? 'e.g. Saree, Lehenga' : 'e.g. Banarasi, Kanjivaram'}
                maxLength={100}
                minLength={2}
                required
              />
            </div>

            {isCategory && (
              <div className="grid gap-2">
                <Label htmlFor="category-icon">Icon (emoji, optional)</Label>
                <Input
                  id="category-icon"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="e.g. 👗 🎭 💎"
                  maxLength={4}
                />
              </div>
            )}
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

interface CategoryManagerProps {
  onAddClick?: boolean; // trigger from parent
  onAddHandled?: () => void;
}

export function CategoryManager({ onAddClick, onAddHandled }: CategoryManagerProps) {
  const { data: categories, isLoading, isError } = useCategories();
  const mutations = useCategoryMutations();

  // Drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Local ordered list for drag
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  useEffect(() => {
    if (categories) {
      setOrderedIds(categories.map((c) => c.id));
    }
  }, [categories]);

  // Expand state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'subcategory'; id: string; name: string; productCount?: number } | null>(null);

  // Handle parent's "Add Category" button click
  useEffect(() => {
    if (onAddClick) {
      setDialogMode({ type: 'create-category' });
      setDialogOpen(true);
      onAddHandled?.();
    }
  }, [onAddClick, onAddHandled]);

  // Drag end handler — auto-save new order
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !categories) return;

    const oldIndex = orderedIds.indexOf(active.id as string);
    const newIndex = orderedIds.indexOf(over.id as string);
    const newOrder = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(newOrder);

    // Persist each changed position
    newOrder.forEach((id, index) => {
      const cat = categories.find((c) => c.id === id);
      if (cat && cat.displayOrder !== index) {
        mutations.updateCategory.mutate({ id, displayOrder: index });
      }
    });
  };

  // Toggle expand
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Dialog submit handler
  const handleDialogSubmit = (name: string, icon?: string) => {
    if (!dialogMode) return;

    switch (dialogMode.type) {
      case 'create-category':
        mutations.createCategory.mutate(
          { name, icon, displayOrder: categories?.length ?? 0 },
          { onSuccess: () => setDialogOpen(false) },
        );
        break;

      case 'edit-category':
        mutations.updateCategory.mutate(
          { id: dialogMode.category.id, name, icon },
          { onSuccess: () => setDialogOpen(false) },
        );
        break;

      case 'create-subcategory': {
        const parent = categories?.find((c) => c.id === dialogMode.categoryId);
        mutations.createSubcategory.mutate(
          {
            categoryId: dialogMode.categoryId,
            name,
            displayOrder: parent?.subcategories.length ?? 0,
          },
          {
            onSuccess: () => {
              setDialogOpen(false);
              setExpandedIds((prev) => new Set(prev).add(dialogMode.categoryId));
            },
          },
        );
        break;
      }

      case 'edit-subcategory':
        mutations.updateSubcategory.mutate(
          { id: dialogMode.subcategory.id, name },
          { onSuccess: () => setDialogOpen(false) },
        );
        break;
    }
  };

  // Delete confirm handler
  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'category') {
      mutations.deleteCategory.mutate(deleteTarget.id, {
        onSuccess: () => setDeleteTarget(null),
      });
    } else {
      mutations.deleteSubcategory.mutate(deleteTarget.id, {
        onSuccess: () => setDeleteTarget(null),
      });
    }
  };

  const isDialogSubmitting =
    mutations.createCategory.isPending ||
    mutations.updateCategory.isPending ||
    mutations.createSubcategory.isPending ||
    mutations.updateSubcategory.isPending;

  const isDeletePending =
    mutations.deleteCategory.isPending || mutations.deleteSubcategory.isPending;

  // Build ordered categories list
  const orderedCategories = orderedIds
    .map((id) => categories?.find((c) => c.id === id))
    .filter(Boolean) as OwnerCategory[];

  // ─── Render ───────────────────────────────────────────────────────────────────

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
        <p className="text-sm">Failed to load categories. Please try again.</p>
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-48 gap-4 text-muted-foreground">
          <Folder className="h-12 w-12 opacity-30" />
          <div className="text-center">
            <p className="font-medium text-foreground">No categories yet</p>
            <p className="text-sm mt-1">Create your first category to organize products</p>
          </div>
          <Button
            onClick={() => {
              setDialogMode({ type: 'create-category' });
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>

        <NameDialog
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
      <div className="w-full max-w-3xl mx-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedIds}
            strategy={verticalListSortingStrategy}
          >
            {orderedCategories.map((category) => (
              <SortableCategoryRow
                key={category.id}
                category={category}
                isExpanded={expandedIds.has(category.id)}
                onToggleExpand={() => toggleExpand(category.id)}
                onEdit={() => {
                  setDialogMode({ type: 'edit-category', category });
                  setDialogOpen(true);
                }}
                onDelete={() =>
                  setDeleteTarget({
                    type: 'category',
                    id: category.id,
                    name: category.name,
                    productCount: category._count.products,
                  })
                }
                onToggleActive={(checked) =>
                  mutations.updateCategory.mutate({ id: category.id, isActive: checked })
                }
                onAddSubcategory={() => {
                  setDialogMode({
                    type: 'create-subcategory',
                    categoryId: category.id,
                    categoryName: category.name,
                  });
                  setDialogOpen(true);
                }}
                onEditSubcategory={(sub) => {
                  setDialogMode({ type: 'edit-subcategory', subcategory: sub });
                  setDialogOpen(true);
                }}
                onDeleteSubcategory={(sub) =>
                  setDeleteTarget({
                    type: 'subcategory',
                    id: sub.id,
                    name: sub.name,
                  })
                }
                onToggleSubActive={(sub, checked) =>
                  mutations.updateSubcategory.mutate({ id: sub.id, isActive: checked })
                }
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Create / Edit dialog */}
      <NameDialog
        mode={dialogMode}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleDialogSubmit}
        isSubmitting={isDialogSubmitting}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={`Delete ${deleteTarget?.type === 'category' ? 'category' : 'subcategory'}?`}
        description={
          deleteTarget?.productCount && deleteTarget.productCount > 0
            ? `"${deleteTarget?.name}" has ${deleteTarget.productCount} products. You must move or delete them before removing this category.`
            : `"${deleteTarget?.name}" will be permanently removed. This action cannot be undone.`
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        loading={isDeletePending}
      />
    </>
  );
}
