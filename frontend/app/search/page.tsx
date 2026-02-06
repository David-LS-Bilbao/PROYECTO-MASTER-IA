/**
 * Search Results Page - Sprint 19: Waterfall Search Engine
 *
 * Implements 3-level waterfall search strategy:
 * - LEVEL 1: Quick DB search (Full-Text Search / LIKE)
 * - LEVEL 2: Reactive ingestion + retry (8s timeout)
 * - LEVEL 3: Google News suggestion fallback
 *
 * Features:
 * - Debounced search (500ms)
 * - Per-user favorite enrichment
 * - Responsive UI with loading states
 * - External fallback when no results found
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, ExternalLink, AlertCircle, Zap, RefreshCw, Sparkles } from 'lucide-react';
import { SearchBar } from '@/components/search-bar';
import { NewsCard } from '@/components/news-card';
import { useNewsSearch } from '@/hooks/useNewsSearch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

function SearchResults() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);

  // Update query when URL changes
  useEffect(() => {
    const urlQuery = searchParams.get('q') || '';
    if (urlQuery !== query) {
      setQuery(urlQuery);
    }
  }, [searchParams]);

  const { data, isLoading, error, isFetching } = useNewsSearch(query);

  const hasResults = data && data.data && data.data.length > 0;
  const hasSuggestion = data && data.suggestion;

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 via-white to-blue-50/30 dark:from-zinc-950 dark:via-zinc-900 dark:to-blue-950/20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <SearchBar
            defaultValue={query}
            autoFocus={!query}
            className="max-w-3xl mx-auto"
            onSearch={(newQuery) => {
              // Update URL when search is submitted
              const url = new URL(window.location.href);
              url.searchParams.set('q', newQuery);
              window.history.pushState({}, '', url);
              setQuery(newQuery);
            }}
          />
        </div>

        {/* Loading State */}
        {(isLoading || isFetching) && (
          <div className="space-y-6">
            <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Search className="h-4 w-4 animate-pulse" />
              <span>Buscando "{query}"...</span>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error en la búsqueda</AlertTitle>
            <AlertDescription>
              {error.message || 'No se pudo completar la búsqueda. Por favor, inténtalo de nuevo.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Results or Empty State */}
        {!isLoading && !isFetching && !error && (
          <>
            {/* Search Info Header */}
            {query && (
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">
                  Resultados de búsqueda
                </h1>
                <div className="flex items-center gap-3 flex-wrap mt-2">
                  <p className="text-sm text-muted-foreground">
                    Buscando: <span className="font-medium text-foreground">"{query}"</span>
                    {hasResults && (
                      <span className="ml-1">
                        ({data.data.length} resultado{data.data.length === 1 ? '' : 's'})
                      </span>
                    )}
                  </p>
                  {data?.level === 1 && (
                    <Badge variant="secondary" className="gap-1">
                      <Zap className="h-3 w-3" />
                      Búsqueda rápida
                    </Badge>
                  )}
                  {data?.level === 2 && (
                    <Badge variant="secondary" className="gap-1">
                      <RefreshCw className="h-3 w-3" />
                      Búsqueda profunda
                    </Badge>
                  )}
                  {data?.isFresh && (
                    <Badge variant="default" className="gap-1">
                      <Sparkles className="h-3 w-3" />
                      Artículos actualizados
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Results Grid */}
            {hasResults && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {data.data.map((article: any) => (
                  <NewsCard key={article.id} article={article} />
                ))}
              </div>
            )}

            {/* LEVEL 3 Fallback: Google News Suggestion */}
            {hasSuggestion && query && data?.suggestion && (
              <div className="max-w-2xl mx-auto">
                <Alert>
                  <Search className="h-4 w-4" />
                  <AlertTitle>No se encontraron resultados</AlertTitle>
                  <AlertDescription className="mt-2 space-y-4">
                    <p>{data.suggestion.message}</p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open(data.suggestion!.externalLink, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {data.suggestion.actionText}
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Empty Query State */}
            {!query && (
              <div className="text-center py-12">
                <Search className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Busca noticias
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  Introduce un término de búsqueda para encontrar noticias relevantes.
                  Nuestro sistema inteligente buscará en múltiples niveles para ofrecerte
                  los mejores resultados.
                </p>
                <div className="flex flex-wrap gap-2 justify-center text-sm">
                  <Badge variant="secondary" className="gap-1">
                    <Zap className="h-3 w-3" />
                    Nivel 1: Búsqueda instantánea
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <RefreshCw className="h-3 w-3" />
                    Nivel 2: Ingesta reactiva
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <ExternalLink className="h-3 w-3" />
                    Nivel 3: Fuentes externas
                  </Badge>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Wrapper with Suspense to handle useSearchParams
export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Search className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    }>
      <SearchResults />
    </Suspense>
  );
}
