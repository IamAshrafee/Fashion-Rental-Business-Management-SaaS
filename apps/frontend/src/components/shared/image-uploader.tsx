'use client';

import React, { useState, useRef } from 'react';
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
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Upload, X, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface ImageFile {
  id: string; // unique string id
  url: string; // preview url
  file?: File;
  isFeatured?: boolean;
}

interface SortableImageItemProps {
  image: ImageFile;
  onRemove: (id: string) => void;
  onSetFeatured: (id: string) => void;
}

function SortableImageItem({ image, onRemove, onSetFeatured }: SortableImageItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "relative group aspect-square rounded-md overflow-hidden bg-muted border-2 touch-none",
        isDragging ? "border-primary shadow-lg" : "border-transparent",
        image.isFeatured && "ring-2 ring-primary ring-offset-2"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt="Thumbnail"
        className="w-full h-full object-cover"
        onDragStart={(e) => e.preventDefault()}
      />
      
      {image.isFeatured && (
        <div className="absolute top-1 left-1 bg-yellow-500 text-white rounded-full p-0.5">
          <Star className="h-4 w-4 fill-current" />
        </div>
      )}

      {/* Overlay Actions - don't trigger drag */}
      <div 
        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent pt-6 pb-2 px-2 opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-center"
        onPointerDown={(e) => e.stopPropagation()} 
      >
        {!image.isFeatured ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white hover:bg-white/20 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              onSetFeatured(image.id);
            }}
            title="Set as featured"
          >
            <Star className="h-4 w-4" />
          </Button>
        ) : (
          <div /> // spacer
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-white hover:bg-destructive hover:text-white ml-auto"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(image.id);
          }}
          title="Remove image"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface ImageUploaderProps {
  images: ImageFile[];
  onChange: (images: ImageFile[]) => void;
  maxImages?: number;
  className?: string;
  disabled?: boolean;
}

export function ImageUploader({ images = [], onChange, maxImages = 10, className, disabled }: ImageUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = images.findIndex((img) => img.id === active.id);
      const newIndex = images.findIndex((img) => img.id === over.id);
      
      const moved = arrayMove(images, oldIndex, newIndex);
      onChange(moved);
    }
  };

  const handleFiles = (files: FileList | File[] | null) => {
    if (!files || disabled) return;
    const newImages: ImageFile[] = [];

    Array.from(files).forEach((file) => {
      if (images.length + newImages.length >= maxImages) return;
      if (!file.type.startsWith('image/')) return;

      newImages.push({
        id: Math.random().toString(36).substring(7),
        url: URL.createObjectURL(file), // note: this creates a memory leak if not revoked, but simplifies component for now
        file,
        isFeatured: images.length === 0 && newImages.length === 0,
      });
    });

    if (newImages.length > 0) {
      onChange([...images, ...newImages]);
    }
  };

  const handleRemove = (id: string) => {
    let updated = images.filter((img) => img.id !== id);
    // If we removed the featured image and there are still images left, make the first one featured
    if (images.find((img) => img.id === id)?.isFeatured && updated.length > 0) {
      updated[0].isFeatured = true;
    }
    onChange(updated);
  };

  const handleSetFeatured = (id: string) => {
    onChange(
      images.map((img) => ({
        ...img,
        isFeatured: img.id === id,
      }))
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div 
        className={cn(
          "w-full rounded-lg border-2 border-dashed p-6 flex flex-col items-center justify-center transition-colors text-center cursor-pointer",
          isDragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
          (images.length >= maxImages || disabled) && "opacity-50 cursor-not-allowed hidden"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => {
          if (images.length < maxImages && !disabled) {
            inputRef.current?.click();
          }
        }}
      >
        <Upload className="h-8 w-8 text-muted-foreground mb-4" />
        <h3 className="text-sm font-semibold">Click or drag images here</h3>
        <p className="text-xs text-muted-foreground mt-2">
          JPEG, PNG, WebP up to 5MB. Max {maxImages} images.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          disabled={disabled || images.length >= maxImages}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = ''; // reset
          }}
        />
      </div>

      {images.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
            <SortableContext
              items={images.map(img => img.id)}
              strategy={horizontalListSortingStrategy}
            >
              {images.map((image) => (
                <SortableImageItem 
                  key={image.id} 
                  image={image} 
                  onRemove={handleRemove}
                  onSetFeatured={handleSetFeatured}
                />
              ))}
            </SortableContext>
          </div>
        </DndContext>
      )}
    </div>
  );
}
