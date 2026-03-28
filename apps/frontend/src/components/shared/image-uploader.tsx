'use client';

import { useCallback, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Upload, X } from 'lucide-react';

interface ImageUploaderProps {
  /** Current image URLs (already uploaded) */
  images?: string[];
  /** Called when files are selected from the browser file picker */
  onFilesSelected: (files: File[]) => void;
  /** Called to remove an already-uploaded image by URL */
  onRemove?: (url: string) => void;
  /** Maximum number of images allowed */
  maxFiles?: number;
  /** Accepted MIME types */
  accept?: string;
  className?: string;
  disabled?: boolean;
}

export function ImageUploader({
  images = [],
  onFilesSelected,
  onRemove,
  maxFiles = 10,
  accept = 'image/jpeg,image/png,image/webp',
  className,
  disabled = false,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const canAddMore = images.length < maxFiles;

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled || !canAddMore) return;

      const files = Array.from(e.dataTransfer.files).filter((f: File) =>
        f.type.startsWith('image/'),
      );
      if (files.length) onFilesSelected(files as File[]);
    },
    [disabled, canAddMore, onFilesSelected],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []) as File[];
      if (files.length) onFilesSelected(files);
      // Reset so the same file can be selected again
      e.target.value = '';
    },
    [onFilesSelected],
  );

  return (
    <div className={cn('space-y-3', className)}>
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => canAddMore && inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          disabled && 'cursor-not-allowed opacity-50',
          canAddMore && !disabled && 'cursor-pointer',
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">
            {canAddMore
              ? 'Click or drag images to upload'
              : `Maximum ${maxFiles} images reached`}
          </p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, WebP · Max 5 MB each
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || !canAddMore}
        />
      </div>

      {/* Image previews */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {images.map((url) => (
            <div
              key={url}
              className="group relative aspect-square rounded-lg border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Uploaded"
                className="h-full w-full rounded-lg object-cover"
              />
              {onRemove && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -right-1 -top-1 h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(url);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
