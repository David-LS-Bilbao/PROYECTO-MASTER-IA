'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  className?: string;
  placeholder?: string;
  defaultValue?: string;
  onSearch?: (query: string) => void;
  autoFocus?: boolean;
}

export function SearchBar({
  className,
  placeholder = 'Buscar noticias...',
  defaultValue = '',
  onSearch,
  autoFocus = false,
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmedQuery = query.trim();

      if (!trimmedQuery) return;

      setIsSearching(true);

      if (onSearch) {
        onSearch(trimmedQuery);
      } else {
        router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
      }

      setIsSearching(false);
    },
    [query, onSearch, router]
  );

  const handleClear = useCallback(() => {
    setQuery('');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSearch();
      }
    },
    [handleSearch]
  );

  return (
    <form onSubmit={handleSearch} className={cn('relative', className)}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="pl-9 pr-20 h-12 rounded-2xl"
          aria-label="Buscar noticias"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="absolute right-12 h-6 w-6"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={!query.trim() || isSearching}
          className="absolute right-1 h-9 rounded-xl"
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Buscar'
          )}
        </Button>
      </div>
    </form>
  );
}
