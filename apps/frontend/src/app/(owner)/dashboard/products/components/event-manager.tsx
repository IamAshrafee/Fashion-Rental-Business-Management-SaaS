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
  CalendarDays,
  Plus,
  Loader2,
  AlertCircle,
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
import { useEventsManage, useEventMutations } from '../hooks/use-product-apis';
import type { OwnerEvent } from '@/lib/api/products';

// ─── Sortable Row ─────────────────────────────────────────────────────────────

function SortableEventRow({
  event,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  event: OwnerEvent;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (checked: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: event.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`mb-2 relative group transition-shadow ${isDragging ? 'shadow-lg ring-2 ring-primary/20' : ''} ${!event.isActive ? 'opacity-60' : ''}`}
    >
      <CardContent className="p-3 flex items-center gap-3">
        {/* Drag handle */}
        <button
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing p-1 rounded-md hover:bg-muted transition-colors shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>

        {/* Icon */}
        <CalendarDays className="h-5 w-5 text-primary/70 shrink-0" />

        {/* Name */}
        <div className="flex-1 font-medium text-sm">
          {event.name}
        </div>

        {/* Product count */}
        <div className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
          {event._count.products} items
        </div>

        {/* Active toggle */}
        <Switch
          checked={event.isActive}
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
  );
}

// ─── Name Dialog ──────────────────────────────────────────────────────────────

function EventNameDialog({
  mode,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: {
  mode: 'create' | { type: 'edit'; event: OwnerEvent } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open || !mode) return;
    if (mode !== 'create' && mode.type === 'edit') {
      setName(mode.event.name);
    } else {
      setName('');
    }
  }, [open, mode]);

  if (!mode) return null;

  const isEdit = mode !== 'create';
  const title = isEdit ? 'Edit Event' : 'New Event';
  const description = isEdit
    ? 'Update the event name below'
    : 'Enter a name for the new event type';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim());
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
              <Label htmlFor="event-name">Name</Label>
              <Input
                id="event-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Wedding, Engagement, Party"
                maxLength={100}
                minLength={2}
                required
              />
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

interface EventManagerProps {
  onAddClick?: boolean;
  onAddHandled?: () => void;
}

export function EventManager({ onAddClick, onAddHandled }: EventManagerProps) {
  const { data: events, isLoading, isError } = useEventsManage();
  const mutations = useEventMutations();

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Local ordered list for drag
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  useEffect(() => {
    if (events) {
      setOrderedIds(events.map((e) => e.id));
    }
  }, [events]);

  // Dialog state
  const [dialogMode, setDialogMode] = useState<'create' | { type: 'edit'; event: OwnerEvent } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; productCount: number } | null>(null);

  // Handle parent's "Add Event" button click
  useEffect(() => {
    if (onAddClick) {
      setDialogMode('create');
      setDialogOpen(true);
      onAddHandled?.();
    }
  }, [onAddClick, onAddHandled]);

  // Drag end handler — auto-save new order
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !events) return;

    const oldIndex = orderedIds.indexOf(active.id as string);
    const newIndex = orderedIds.indexOf(over.id as string);
    const newOrder = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(newOrder);

    // Persist each changed position
    newOrder.forEach((id, index) => {
      const evt = events.find((e) => e.id === id);
      if (evt && evt.displayOrder !== index) {
        mutations.updateEvent.mutate({ id, displayOrder: index });
      }
    });
  };

  // Dialog submit handler
  const handleDialogSubmit = (name: string) => {
    if (!dialogMode) return;

    if (dialogMode === 'create') {
      mutations.createEvent.mutate(
        { name, displayOrder: events?.length ?? 0 },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      mutations.updateEvent.mutate(
        { id: dialogMode.event.id, name },
        { onSuccess: () => setDialogOpen(false) },
      );
    }
  };

  // Delete confirm handler
  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    mutations.deleteEvent.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const isDialogSubmitting =
    mutations.createEvent.isPending || mutations.updateEvent.isPending;

  // Build ordered events list
  const orderedEvents = orderedIds
    .map((id) => events?.find((e) => e.id === id))
    .filter(Boolean) as OwnerEvent[];

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
        <p className="text-sm">Failed to load events. Please try again.</p>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-48 gap-4 text-muted-foreground">
          <CalendarDays className="h-12 w-12 opacity-30" />
          <div className="text-center">
            <p className="font-medium text-foreground">No events yet</p>
            <p className="text-sm mt-1">Create event types like Wedding, Engagement, Party</p>
          </div>
          <Button
            onClick={() => {
              setDialogMode('create');
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        </div>

        <EventNameDialog
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
            {orderedEvents.map((evt) => (
              <SortableEventRow
                key={evt.id}
                event={evt}
                onEdit={() => {
                  setDialogMode({ type: 'edit', event: evt });
                  setDialogOpen(true);
                }}
                onDelete={() =>
                  setDeleteTarget({
                    id: evt.id,
                    name: evt.name,
                    productCount: evt._count.products,
                  })
                }
                onToggleActive={(checked) =>
                  mutations.updateEvent.mutate({ id: evt.id, isActive: checked })
                }
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Create / Edit dialog */}
      <EventNameDialog
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
        title="Delete event?"
        description={
          deleteTarget?.productCount && deleteTarget.productCount > 0
            ? `"${deleteTarget?.name}" is used by ${deleteTarget.productCount} products. Deleting it will remove the association from those products.`
            : `"${deleteTarget?.name}" will be permanently removed. This action cannot be undone.`
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        loading={mutations.deleteEvent.isPending}
      />
    </>
  );
}
