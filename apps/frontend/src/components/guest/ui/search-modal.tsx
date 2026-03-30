'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Loader2, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { suggestProducts, type SearchSuggestion } from '@/lib/api/guest-products';
import { cn } from '@/lib/utils';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setSuggestions([]);
    }
  }, [open]);

  // Debounced search
  const handleInputChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await suggestProducts(value.trim());
        setSuggestions(result.suggestions || []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/products?search=${encodeURIComponent(query.trim())}`);
      onClose();
    }
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    if (suggestion.type === 'product') {
      router.push(`/products/${suggestion.slug}`);
    } else {
      router.push(`/products?category=${suggestion.slug}`);
    }
    onClose();
  };

  // Close on escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl mx-4 bg-white shadow-2xl border border-gray-100 animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Search Input */}
        <form onSubmit={handleSubmit} className="flex items-center border-b">
          <Search className="mx-4 h-5 w-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search products, categories..."
            className="flex-1 py-4 pr-4 text-lg outline-none placeholder:text-gray-400"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
          />
          {loading && <Loader2 className="mr-4 h-5 w-5 animate-spin text-gray-400" />}
          <button
            type="button"
            onClick={onClose}
            className="mr-4 rounded-full p-1 text-gray-400 hover:text-black transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </form>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="max-h-80 overflow-y-auto py-2">
            {suggestions.map((s, idx) => (
              <button
                key={`${s.type}-${s.slug}-${idx}`}
                type="button"
                onClick={() => handleSuggestionClick(s)}
                className="flex w-full items-center justify-between px-6 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                      s.type === 'product'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-blue-50 text-blue-600',
                    )}
                  >
                    {s.type}
                  </span>
                  <span className="text-sm text-gray-900">{s.text}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300" />
              </button>
            ))}
          </div>
        )}

        {/* Empty search hint */}
        {query.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-gray-400">
            Start typing to search our collection...
          </div>
        )}

        {/* No results */}
        {query.length >= 2 && !loading && suggestions.length === 0 && (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-gray-500 mb-2">No results for &quot;{query}&quot;</p>
            <button
              type="button"
              onClick={handleSubmit}
              className="text-sm font-medium text-black underline hover:no-underline"
            >
              Search all products
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
