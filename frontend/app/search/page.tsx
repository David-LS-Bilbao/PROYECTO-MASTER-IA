'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, Loader2 } from 'lucide-react';
import { searchNews, type NewsArticle } from '@/lib/api';
import { NewsCard } from '@/components/news-card';
import { SearchBar } from '@/components/search-bar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [results, setResults] = useState<NewsArticle[]>([]);
  const [totalFound, setTotalFound] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setTotalFound(0);
      setHasSearched(false);
      return;
    }

    const performSearch = async () => {
      setIsLoading(true);
      setError(null);
      setHasSearched(true);

      try {
        const response = await searchNews(query, 20);
        setResults(response.data.results);
        setTotalFound(response.data.totalFound);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al buscar');
        setResults([]);
        setTotalFound(0);
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [query]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex-1">
              <SearchBar
                defaultValue={query}
                placeholder="Buscar noticias con IA semántica..."
                autoFocus={!query}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Initial State - No query */}
        {!query && !hasSearched && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
              Búsqueda Semántica
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto mb-4">
              Encuentra noticias usando búsqueda inteligente con IA.
              El sistema entiende el significado de tu consulta, no solo palabras clave.
            </p>
            <div className="flex flex-wrap gap-2 justify-center text-sm">
              <Badge variant="secondary">Ejemplo: cambio climático</Badge>
              <Badge variant="secondary">Ejemplo: economía española</Badge>
              <Badge variant="secondary">Ejemplo: tecnología y empleo</Badge>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Buscando con IA semántica...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="max-w-2xl mx-auto p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-2">
              Error en la búsqueda
            </h2>
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-4">
              Asegúrate de que el backend y ChromaDB están corriendo.
            </p>
          </div>
        )}

        {/* Results */}
        {!isLoading && !error && hasSearched && (
          <>
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
                  Resultados para "{query}"
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {totalFound} {totalFound === 1 ? 'resultado encontrado' : 'resultados encontrados'}
                </p>
              </div>
              <Badge variant="outline" className="hidden sm:flex">
                Búsqueda semántica
              </Badge>
            </div>

            {/* No Results */}
            {results.length === 0 && (
              <div className="text-center py-12 border rounded-lg border-dashed">
                <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h2 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                  No se encontraron resultados
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Intenta con otros términos. La búsqueda semántica funciona mejor
                  con consultas descriptivas.
                </p>
              </div>
            )}

            {/* Results Grid */}
            {results.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((article) => (
                  <NewsCard key={article.id} article={article} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 text-center text-sm text-muted-foreground">
          <p>
            Búsqueda potenciada por ChromaDB + Gemini Embeddings
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
