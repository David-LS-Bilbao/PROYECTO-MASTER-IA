'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useInView } from 'react-intersection-observer';
import { Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { type NewsArticle, type BiasDistribution } from '@/lib/api';
import { NewsGrid } from '@/components/news/news-grid';
import { Sidebar, DashboardDrawer } from '@/components/layout';
import { SourcesDrawer } from '@/components/sources-drawer';
import { GeneralChatDrawer } from '@/components/general-chat-drawer';
import { SearchBar } from '@/components/search-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateSeparator } from '@/components/date-separator';
import { ScrollToTop } from '@/components/ui/scroll-to-top';
import { useNewsInfinite } from '@/hooks/useNewsInfinite';
import { useInvalidateNews } from '@/hooks/useNews';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { groupArticlesByDate } from '@/lib/date-utils';

const INFINITE_PAGE_SIZE = 20;
const INFINITE_SCROLL_ROOT_MARGIN = '100px';
const SKELETON_CARD_COUNT = 6;


/**
 * InfiniteScrollSentinel - Componente que detecta cuando el usuario llega al final
 * y dispara la carga de más noticias automáticamente
 *
 * SPRINT 20: Infinite Scroll
 */
interface InfiniteScrollSentinelProps {
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

function InfiniteScrollSentinel({ hasNextPage, isFetchingNextPage, fetchNextPage }: InfiniteScrollSentinelProps) {
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: INFINITE_SCROLL_ROOT_MARGIN, // Trigger before reaching the element
  });

  // Auto-fetch when sentinel comes into view
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Si estamos cargando la siguiente página, mostrar spinner
  if (isFetchingNextPage) {
    return (
      <div className="mt-8 text-center py-8">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">Cargando más noticias...</p>
        </div>
      </div>
    );
  }

  // Si ya no hay más páginas, mostrar mensaje final
  if (!hasNextPage) {
    return (
      <div className="mt-8 mb-8 text-center py-8">
        <div className="flex flex-col items-center gap-2">
          <div className="text-4xl mb-2">✨</div>
          <p className="text-sm font-medium text-zinc-900 dark:text-white">
            Has visto todo por hoy
          </p>
          <p className="text-xs text-muted-foreground">
            Vuelve más tarde para ver nuevas noticias
          </p>
        </div>
      </div>
    );
  }

  // Elemento invisible que actúa como "centinela"
  // Cuando entra en el viewport, dispara la carga
  return <div ref={ref} className="h-20" />;
}

/**
 * Sprint 22: Map topic slugs to readable titles
 * Returns a human-readable title for each topic
 */
function getTopicTitle(topic: string | null): string {
  const titleMap: Record<string, string> = {
    'general': 'Últimas Noticias',
    'espana': 'Noticias de España',
    'internacional': 'Noticias Internacionales',
    'local': 'Actualidad Local',
    'economia': 'Economía',
    'ciencia-tecnologia': 'Ciencia y Tecnología',
    'ciencia': 'Ciencia',
    'tecnologia': 'Tecnología',
    'entretenimiento': 'Entretenimiento',
    'deportes': 'Deportes',
    'salud': 'Salud',
    'politica': 'Política',
    'cultura': 'Cultura',
    'favorites': 'Tus Favoritos',
  };

  return titleMap[topic || 'general'] || 'Últimas Noticias';
}

function HomeContent() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Sprint 22: Leer 'topic' en lugar de 'category' (conectado con Sidebar)
  const urlTopic = searchParams.get('topic');

  // =========================================================================
  // UI STATE: Drawers (no server state)
  // =========================================================================
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Topic state (UI state, synced with URL)
  // Si no hay topic en URL, mostrar 'general' (portada)
  const [topic, setTopic] = useState<string>(() => {
    return urlTopic || 'general';
  });

  // Track if we're actively changing topics (for smooth UX without flashing old data)
  const [isChangingTopic, setIsChangingTopic] = useState(false);
  const previousTopicRef = useRef<string>(topic);

  // =========================================================================
  // REACT QUERY: Infinite Scroll con useInfiniteQuery
  // Sprint 20: Eliminamos paginación estática y usamos carga bajo demanda
  // Sprint 22: Ahora usa 'topic' en lugar de 'category'
  // =========================================================================
  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    isError,
    error: queryError,
    fetchNextPage,
    hasNextPage,
  } = useNewsInfinite({
    category: topic, // El hook todavía espera 'category', pero le pasamos 'topic'
    limit: INFINITE_PAGE_SIZE, // Páginas de 20 artículos
  });

  // Flatten pages into single array + remove duplicates (Sprint 20 FIX)
  const newsData = data ? {
    data: (() => {
      const allArticles = data.pages.flatMap(page => page.data);
      // Remove duplicates by ID (in case backend returns same article in multiple pages)
      const seen = new Set<string>();
      return allArticles.filter(article => {
        if (seen.has(article.id)) {
          console.warn(`[InfiniteScroll] ⚠️ Duplicate article removed: ${article.id.substring(0, 8)}...`);
          return false;
        }
        seen.add(article.id);
        return true;
      });
    })(),
    pagination: data.pages[data.pages.length - 1]?.pagination || {
      total: 0,
      hasMore: false,
      limit: INFINITE_PAGE_SIZE,
      offset: 0,
    },
  } : null;

  // =========================================================================
  // REACT QUERY: Dashboard stats con auto-refresh cada 5 minutos
  // =========================================================================
  const { data: stats } = useDashboardStats();

  // =========================================================================
  // REACT QUERY: Invalidación manual de caché para forzar refetch
  // =========================================================================
  const invalidateNews = useInvalidateNews();

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
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  // =========================================================================
  // SYNC: Topic con URL (cuando cambia el search param externo desde Sidebar)
  // Sprint 22: Ahora sincroniza con 'topic' en lugar de 'category'
  // =========================================================================
  useEffect(() => {
    const targetTopic = urlTopic || 'general';

    // Solo actualizar si el topic cambió (evitar loops infinitos)
    if (targetTopic !== topic) {
      setTopic(targetTopic);
    }
  }, [urlTopic, topic]);

  // =========================================================================
  // Invalidar caché de React Query al cambiar de topic
  // El backend auto-fill se encarga de ingestar si la categoría está vacía
  // =========================================================================
  const isFirstMount = useRef(true);
  useEffect(() => {
    // Skip primera carga - useNewsInfinite ya hace el fetch inicial
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    // Invalidar caché para que React Query re-fetch con el nuevo topic
    invalidateNews(topic);
  }, [topic, invalidateNews]);

  // =========================================================================
  // Sprint 22: Ya no necesitamos handleCategoryChange - el Sidebar usa Links directos
  // Detectar cuando termine el fetch del nuevo topic (para suavizar transiciones)
  // =========================================================================
  useEffect(() => {
    if (isChangingTopic && !isLoading && !isFetching) {
      // Datos nuevos cargados, desactivar loading state
      setIsChangingTopic(false);
      previousTopicRef.current = topic;
    }
  }, [isChangingTopic, isLoading, isFetching, topic]);

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
        onOpenChat={() => setIsChatOpen(true)}
        isMobileOpen={isMobileSidebarOpen}
        onMobileOpenChange={setIsMobileSidebarOpen}
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

      {/* General Chat Drawer (Sprint 19.6) */}
      <GeneralChatDrawer
        isOpen={isChatOpen}
        onOpenChange={setIsChatOpen}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Header - Google News Style */}
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="px-4 sm:px-6 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              {/* Brand Row (Mobile) */}
              <div className="flex items-center gap-3 shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden h-9 w-9 rounded-full bg-white/90 dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800 shadow-sm mt-1 sm:mt-0"
                  aria-label="Abrir menú"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
                    Verity News
                  </h1>
                  <Badge variant="secondary" className="hidden sm:inline-flex">Beta</Badge>
                </div>
              </div>

              {/* Search Bar - Full Width on Mobile */}
              <div className="w-full sm:flex-1 sm:max-w-2xl -mx-4 sm:mx-0 px-4 sm:px-0 sm:min-w-0">
                <SearchBar
                  placeholder="Buscar temas, noticias..."
                  className="w-full"
                />
              </div>

              {/* Stats - Right (optional, hidden on small screens) */}
              {stats && (
                <div className="hidden lg:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  <span>
                    <strong className="text-foreground">{stats.totalArticles}</strong> noticias
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span>
                    <strong className="text-foreground">{stats.analyzedCount}</strong> analizadas
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
            {!error && newsData && newsData.data.length === 0 && !isFetching && (
              <div className="max-w-2xl mx-auto text-center py-16">
                <div className="text-6xl mb-4">
                  {topic === 'favorites' ? '❤️' : '📰'}
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                  {topic === 'favorites'
                    ? 'No tienes favoritos todavía'
                    : `No hay noticias de ${getTopicTitle(topic)}`}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {topic === 'favorites'
                    ? 'Marca noticias como favoritas para verlas aquí'
                    : 'Prueba con otro tema o espera a que se ingesten noticias'}
                </p>
              </div>
            )}

            {/* Sprint 22: CategoryPills ELIMINADO - Navegación ahora en Sidebar */}

            {/* Loading State - Carga inicial O cambio de topic */}
            {(isLoading || isChangingTopic) && (
              <div className="max-w-7xl mx-auto">
                {/* Loading message */}
                <div className="flex items-center justify-center gap-3 mb-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent"></div>
                  <p className="text-lg font-medium text-zinc-900 dark:text-white">
                    {isChangingTopic ? 'Cargando noticias frescas...' : 'Cargando noticias...'}
                  </p>
                </div>

                {/* Skeleton cards */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {[...Array(SKELETON_CARD_COUNT)].map((_, i) => (
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

            {/* News Grid - Solo mostrar cuando NO estamos cambiando topic */}
            {!error && !isChangingTopic && newsData && newsData.data.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-6 max-w-7xl mx-auto">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                      {getTopicTitle(topic)}
                    </h2>
                    {/* Indicador discreto de refetch en background */}
                    {isFetching && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                        <span className="hidden sm:inline">Actualizando...</span>
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Mostrando {newsData.data.length} de {newsData.pagination.total}
                  </span>
                </div>

                {/* Sprint 19.5: Date Separators + Grouped News Grid */}
                <div className="max-w-7xl mx-auto">
                  {groupArticlesByDate(newsData.data).map((group, groupIndex) => (
                    <div key={group.date}>
                      {/* Date Separator */}
                      <DateSeparator label={group.label} articleCount={group.articles.length} />

                      {/* Articles Grid for this date */}
                      <NewsGrid articles={group.articles} />
                    </div>
                  ))}
                </div>

                {/* Infinite Scroll Component */}
                <InfiniteScrollSentinel
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  fetchNextPage={fetchNextPage}
                />
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="hidden sm:block border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="px-4 sm:px-6 py-0.5 text-center text-[10px] leading-tight sm:text-xs text-muted-foreground">
            <p>
              Verity News - Análisis de sesgo en noticias con IA{' '}
              <span className="text-zinc-400 dark:text-zinc-600">|</span>{' '}
              Powered by Gemini 2.5 Flash
            </p>
          </div>
        </footer>

        {/* Scroll to Top Button (Sprint 19.6) */}
        <ScrollToTop />
      </main>
    </div>
  );
}

/**
 * Page wrapper with Suspense boundary for useSearchParams()
 * Next.js 13+ requires this to avoid SSR bailout warnings
 */
export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-600 border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">Cargando Verity News...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
