'use client';

import React, { useState } from 'react';
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
import { GripVertical, Edit2, Trash2, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type CategoryItem = {
  id: string;
  name: string;
  productCount: number;
};

const SORTABLE_CATEGORIES: CategoryItem[] = [
  { id: '1', name: 'Saree', productCount: 45 },
  { id: '2', name: 'Lehenga', productCount: 32 },
  { id: '3', name: 'Sherwani', productCount: 18 },
  { id: '4', name: 'Jewelry', productCount: 110 },
  { id: '5', name: 'Accessories', productCount: 25 },
];

function SortableCategoryRow({ category }: { category: CategoryItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card ref={setNodeRef} style={style} className="mb-2 relative group bg-card">
      <CardContent className="p-3 flex items-center gap-4">
        <button
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing p-1 rounded-md hover:bg-muted"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <Folder className="h-5 w-5 text-primary opacity-70" />
        <div className="flex-1 font-medium text-sm">
          {category.name}
        </div>
        <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {category.productCount} items
        </div>
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CategoryManager() {
  const [categories, setCategories] = useState<CategoryItem[]>(SORTABLE_CATEGORIES);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setCategories((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={categories.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {categories.map((category) => (
            <SortableCategoryRow key={category.id} category={category} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
