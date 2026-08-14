'use client';

import Link from 'next/link';
import { useId } from 'react';
import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { HELP_CONTENT } from '@/lib/help/content';
import type { ContextHelpContent, ContextHelpKey } from '@/lib/help/types';

export function ContextHelp({
  helpKey,
  content,
  className,
}: {
  helpKey?: ContextHelpKey;
  content?: ContextHelpContent;
  className?: string;
}) {
  const descriptionId = useId();
  const resolved = helpKey ? HELP_CONTENT[helpKey] : content;
  if (!resolved) return null;

  return (
    <Popover>
      <span id={descriptionId} className="sr-only">
        {resolved.meaning}
      </span>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Help: ${resolved.title}`}
          aria-describedby={descriptionId}
          className={cn(
            'ml-1 inline-flex size-5 cursor-help items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            className,
          )}
        >
          <HelpCircle className="size-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[min(70vh,28rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto"
      >
        <div className="flex flex-col gap-3 text-sm">
          <p className="font-semibold">{resolved.title}</p>
          <p>{resolved.meaning}</p>
          {resolved.why ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Why it matters
              </p>
              <p>{resolved.why}</p>
            </div>
          ) : null}
          {resolved.example ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Fashion-rental example
              </p>
              <p>{resolved.example}</p>
            </div>
          ) : null}
          {resolved.effect ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Effect
              </p>
              <p>{resolved.effect}</p>
            </div>
          ) : null}
          {resolved.relatedLink ? (
            <Link
              className="font-medium underline underline-offset-4"
              href={resolved.relatedLink.href}
            >
              {resolved.relatedLink.label}
            </Link>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
