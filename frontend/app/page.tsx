'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { type NewsArticle, type BiasDistribution } from '@/lib/api';
import { NewsCard } from '@/components/news-card';
import { Sidebar, DashboardDrawer } from '@/components/layout';
import { SourcesDrawer } from '@/components/sources-drawer';
import { Badge } from '@/components/ui/badge';
import { CategoryPills, type CategoryId, CATEGORIES } from '@/components/category-pills';
import { useNews } from '@/hooks/useNews';
import { useDashboardStats } from '@/hooks/useDashboardStats';


export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlCategory = searchParams.get('category') as CategoryId | null;

  // =========================================================================
  // UI STATE: Drawers (no server state)
  // =========================================================================
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  
  // Category state (UI state, synced with URL)
  const [category, setCategory] = useState<CategoryId>(() => {
    const validCategories = CATEGORIES.map(c => c.id);
    return urlCategory && validCategories.includes(urlCategory) ? urlCategory : 'general';
  });

  // =========================================================================
  // REACT QUERY: Fetch de noticias con caché automático (60s stale time)
  // =========================================================================
  const {
    data: newsData,
    isLoading,
    isError,
    error: queryError,
  } = useNews({
    category,
    limit: 50,
    offset: 0,
  });

  // =========================================================================
  // REACT QUERY: Dashboard stats con auto-refresh cada 5 minutos
  // =========================================================================
  const { data: stats } = useDashboardStats();

  // =========================================================================
  // COMPUTED: Error message (compatible con código legacy)
  // =========================================================================
  const error = isError && queryError
    ? queryError instanceof Error
      ? queryError.message
      : 'Error al cargar las noticias'
    : null;

  // =========================================================================
  // PROTECCIÓN DE RUTA: Redirigir a /login si no hay usuario autenticado
  // =========================================================================
  useEffect(() => {
    if (!authLoading && !user) {
      console.log('🔒 Usuario no autenticado. Redirigiendo a /login...');
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // =========================================================================
  // SYNC: Categoría con URL (cuando cambia el search param externo)
  // =========================================================================
  useEffect(() => {
    const validCategories = CATEGORIES.map(c => c.id);
    if (urlCategory && validCategories.includes(urlCategory) && urlCategory !== category) {
      setCategory(urlCategory);
    }
  }, [urlCategory, category]);

  // =========================================================================
  // HANDLER: Cambio de categoría (UI state + URL navigation)
  // =========================================================================
  const handleCategoryChange = (newCategory: CategoryId) => {
    if (newCategory === category) return;
    setCategory(newCategory);

    const url = newCategory === 'general' ? '/' : `/?category=${newCategory}`;
    router.push(url, { scroll: false });
    // React Query auto-refetches when category changes (dynamic queryKey)
  };

  // =========================================================================
  // COMPUTED: Bias distribution (calculado desde newsData si existe)
  // =========================================================================
  function calculateBiasDistribution(articles: NewsArticle[]): BiasDistribution {
    const analyzedArticles = articles.filter((article) => article.biasScore !== null);

    return analyzedArticles.reduce(
      (acc, article) => {
        const score = article.biasScore ?? 0;
        if (score < 0.34) {
          acc.left += 1;
        } else if (score < 0.67) {
          acc.neutral += 1;
        } else {
          acc.right += 1;
        }
        return acc;
      },
      { left: 0, neutral: 0, right: 0 }
    );
  }
  
  const fallbackBiasDistribution: BiasDistribution = {
    left: 0,
    neutral: 0,
    right: 0,
  };

  const biasDistribution = newsData
    ? calculateBiasDistribution(newsData.data)
    : fallbackBiasDistribution;

  const resolvedBiasDistribution = stats?.biasDistribution &&
    (stats.biasDistribution.left > 0 ||
      stats.biasDistribution.neutral > 0 ||
      stats.biasDistribution.right > 0)
    ? stats.biasDistribution
    : biasDistribution;

  // =========================================================================
  // LOADING STATE: Mostrar esqueleto mientras se verifica autenticación
  // =========================================================================
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-zinc-900 dark:text-white">Cargando Verity...</p>
          <p className="text-sm text-muted-foreground mt-2">Verificando sesión</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // NO AUTENTICADO: No renderizar nada (el useEffect redirige a /login)
  // =========================================================================
  if (!user) {
    return null;
  }

  // =========================================================================
  // AUTENTICADO: Renderizar Dashboard completo
  // =========================================================================
  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <Sidebar 
        onOpenDashboard={() => setIsDashboardOpen(true)}
        onOpenSources={() => setIsSourcesOpen(true)}
      />

      {/* Dashboard Drawer */}
      {stats && (
        <DashboardDrawer
          isOpen={isDashboardOpen}
          onOpenChange={setIsDashboardOpen}
          totalArticles={stats.totalArticles ?? 0}
          analyzedCount={stats.analyzedCount ?? 0}
          coverage={stats.coverage ?? 0}
          biasDistribution={resolvedBiasDistribution}
          isLoading={isLoading}
        />
      )}

      {/* Sources Drawer */}
      <SourcesDrawer
        isOpen={isSourcesOpen}
        onOpenChange={setIsSourcesOpen}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                  Verity News
                </h1>
                <Badge variant="secondary">Beta</Badge>
              </div>
              {stats && (
                <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    <strong className="text-foreground">{stats.totalArticles}</strong> noticias
                  </span>
                  <span>
                    <strong className="text-foreground">{stats.analyzedCount}</strong> analizadas
                  </span>
                  <span>
                    <strong className="text-foreground">{stats.coverage}%</strong> cobertura
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 py-8">
            {/* Error State */}
            {error && (
              <div className="max-w-2xl mx-auto p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <h2 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-2">
                  Error al cargar las noticias
                </h2>
                <p className="text-red-700 dark:text-red-300">{error}</p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-4">
                  Asegúrate de que el backend está corriendo en{' '}
                  <code className="bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded">
                    http://localhost:3000
                  </code>
                </p>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && newsData && newsData.data.length === 0 && (
              <div className="max-w-2xl mx-auto text-center py-16">
                <div className="text-6xl mb-4">
                  {category === 'favorites' ? '❤️' : '📰'}
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                  {category === 'favorites'
                    ? 'No tienes favoritos todavía'
                    : `No hay noticias en ${category}`}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {category === 'favorites'
                    ? 'Marca noticias como favoritas para verlas aquí'
                    : 'Prueba con otra categoría o espera a que se ingesten noticias'}
                </p>
              </div>
            )}

            {/* Category Pills */}
            <div className="max-w-7xl mx-auto mb-6">
              <CategoryPills
                selectedCategory={category}
                onSelect={handleCategoryChange}
                disabled={isLoading}
              />
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="max-w-7xl mx-auto">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-pulse">
                      <div className="h-48 bg-zinc-200 dark:bg-zinc-800" />
                      <div className="p-4 space-y-3">
                        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
                        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
                        <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* News Grid */}
            {!isLoading && !error && newsData && newsData.data.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-6 max-w-7xl mx-auto">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                    {category === 'favorites' ? 'Tus favoritos' : 'Últimas noticias'}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    Mostrando {newsData.data.length} de {newsData.pagination.total}
                  </span>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
                  {newsData.data.map((article: NewsArticle) => (
                    <NewsCard key={article.id} article={article} />
                  ))}
                </div>

                {/* Load More */}
                {newsData.pagination.hasMore && (
                  <div className="mt-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Hay más noticias disponibles. Implementa paginación para verlas.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="px-4 sm:px-6 py-4 text-center text-sm text-muted-foreground">
            <p>
              Verity News - Análisis de sesgo en noticias con IA{' '}
              <span className="text-zinc-400 dark:text-zinc-600">|</span>{' '}
              Powered by Gemini 2.5 Flash
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
