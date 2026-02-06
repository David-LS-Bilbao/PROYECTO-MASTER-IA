'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { type NewsArticle, type BiasDistribution } from '@/lib/api';
import { NewsCard } from '@/components/news-card';
import { Sidebar, DashboardDrawer } from '@/components/layout';
import { SourcesDrawer } from '@/components/sources-drawer';
import { SearchBar } from '@/components/search-bar';
import { Badge } from '@/components/ui/badge';
import { CategoryPills, type CategoryId, CATEGORIES } from '@/components/category-pills';
import { useNews, useInvalidateNews } from '@/hooks/useNews';
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

  // Sprint 16: Track si es la primera carga para evitar ingesta innecesaria
  const isFirstMount = useRef(true);

  // Sprint 16: Track si el backend está disponible para auto-ingesta
  const [isBackendAvailable, setIsBackendAvailable] = useState(true);

  // =========================================================================
  // REACT QUERY: Fetch de noticias con caché automático (30s stale time)
  // Sprint 16: Freshness strategy con auto-ingesta al cambiar categoría
  // =========================================================================
  const {
    data: newsData,
    isLoading,
    isFetching,
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
      console.log('🔒 Usuario no autenticado. Redirigiendo a /login...');
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // =========================================================================
  // SYNC: Categoría con URL (cuando cambia el search param externo)
  // FIX: Manejar caso de 'general' donde urlCategory es null
  // =========================================================================
  useEffect(() => {
    const validCategories = CATEGORIES.map(c => c.id);
    const targetCategory = urlCategory && validCategories.includes(urlCategory) ? urlCategory : 'general';
    
    // Solo actualizar si la categoría cambió (evitar loops infinitos)
    if (targetCategory !== category) {
      console.log(`🔗 [URL SYNC] URL cambió: Actualizando category de "${category}" a "${targetCategory}"`);
      setCategory(targetCategory);
    }
  }, [urlCategory, category]);

  // =========================================================================
  // SPRINT 16: Health Check del Backend (una sola vez al montar)
  // Verifica si el backend está disponible para habilitar auto-ingesta
  // =========================================================================
  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(`${API_BASE_URL}/health/check`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log('✅ [HEALTH CHECK] Backend disponible para auto-ingesta');
          setIsBackendAvailable(true);
        } else {
          console.warn('⚠️ [HEALTH CHECK] Backend respondió con error:', response.status);
          setIsBackendAvailable(false);
        }
      } catch (error) {
        console.warn('🔌 [HEALTH CHECK] Backend no disponible - Auto-ingesta deshabilitada');
        setIsBackendAvailable(false);
      }
    };

    checkBackendHealth();
  }, []); // Solo ejecutar una vez al montar

  // =========================================================================
  // SPRINT 16: Auto-Ingesta al cambiar de categoría
  // Dispara ingesta RSS + invalidación + refetch (como botón "Últimas noticias")
  // Solo se ejecuta en cambios de categoría, NO en primera carga
  // =========================================================================
  useEffect(() => {
    // Skip primera carga - solo queremos ingesta en cambios de categoría
    if (isFirstMount.current) {
      isFirstMount.current = false;
      console.log(`🚀 [AUTO-INGESTA] Primera carga de categoría: ${category} (sin ingesta)`);
      return;
    }

    // Skip favoritos - no necesitan ingesta RSS, solo invalidar para refetch
    if (category === 'favorites') {
      console.log('⭐ [AUTO-INGESTA] Categoría FAVORITOS: invalidando para refetch (sin ingesta RSS)');
      invalidateNews(category);
      return;
    }

    // Skip si backend no está disponible - solo hacer refetch de BD
    if (!isBackendAvailable) {
      console.log('🔌 [AUTO-INGESTA] Backend no disponible - Solo refetch de BD');
      invalidateNews(category);
      return;
    }

    // Debounce: Esperar 300ms para evitar múltiples ingestas rápidas al cambiar categorías
    const timeoutId = setTimeout(async () => {
      // =========================================================================
      // SMART INGESTION: Verificar TTL de 1 hora antes de disparar ingesta
      // Optimización de costes - Solo ingestar si no hay datos o son antiguos
      // =========================================================================
      const latestArticle = newsData?.data?.[0]; // Artículo más reciente (ordenado por fecha desc)
      const lastUpdate = latestArticle?.publishedAt
        ? new Date(latestArticle.publishedAt).getTime()
        : 0;
      const now = Date.now();
      const oneHour = 60 * 60 * 1000; // 1 hora en milisegundos
      const ageInMinutes = Math.round((now - lastUpdate) / (60 * 1000));

      const shouldAutoRefresh = !latestArticle || (now - lastUpdate > oneHour);

      if (!shouldAutoRefresh) {
        console.log(`💰 [SMART INGESTION] Datos frescos en BD (${ageInMinutes} min) - SALTANDO ingesta automática`);
        console.log(`   → Ahorro: ~50 artículos × análisis IA no procesados innecesariamente`);
        console.log(`   → Última noticia: "${latestArticle?.title?.substring(0, 60)}..."`);
        // Solo invalidar caché para refetch de BD, sin ingesta RSS
        invalidateNews(category);
        return;
      }

      console.log(`📥 [AUTO-INGESTA] Iniciando ingesta (datos > 1h o vacíos)`);
      console.log(`   → Antigüedad: ${ageInMinutes > 60 ? `${Math.round(ageInMinutes / 60)}h` : `${ageInMinutes}min`}`);

      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

        const requestBody: any = {
          pageSize: 50, // Aumentado de 20 a 50 para mejor cobertura y más artículos frescos
          category: category, // ✅ SIEMPRE enviar category, incluso si es 'general'
        };

        // ✅ CAMBIO: 'general' ahora es una categoría INDEPENDIENTE (no un agregador)
        // Se envía explícitamente para que backend filtre solo noticias de fuentes de portada

        // Fetch con timeout de 5 segundos para evitar hangs
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${API_BASE_URL}/api/ingest/news`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          console.log('✅ [AUTO-INGESTA] Completada:', data.message);
          console.log('📊 [AUTO-INGESTA] Nuevos artículos:', data.data?.newArticles || 0);
          console.log('♻️  [AUTO-INGESTA] Artículos actualizados:', data.data?.duplicates || 0);

          if (data.data?.newArticles === 0) {
            console.log('💰 [SMART INGESTION] Sin artículos nuevos - próxima vez se saltará por TTL');
          } else {
            console.log('🔄 [SMART INGESTION] Artículos frescos ingresados - BD actualizada');
          }

          // CRÍTICO: Invalidar TODAS las categorías, no solo la actual
          // Razón: Una noticia puede aparecer en múltiples feeds RSS y actualizarse
          // Ejemplo: Noticia de inflación aparece en "general" y "economía"
          invalidateNews(category, true); // true = invalidateAll
        } else {
          console.warn(`⚠️ [AUTO-INGESTA] Error HTTP ${response.status}:`, response.statusText);
          // Aún así, invalidar todas las categorías por si hay cambios previos
          invalidateNews(category, true);
        }
      } catch (error) {
        // Manejo de errores más específico
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            console.warn('⏱️ [AUTO-INGESTA] Timeout (5s) - Backend puede estar lento o no disponible');
          } else if (error.message.includes('fetch')) {
            console.warn('🔌 [AUTO-INGESTA] Backend no disponible - Mostrando datos de BD actual');
          } else {
            console.warn('❌ [AUTO-INGESTA] Error:', error.message);
          }
        } else {
          console.warn('❌ [AUTO-INGESTA] Error desconocido:', error);
        }

        // Siempre invalidar TODAS las categorías, incluso si falla ingesta
        // Esto asegura refetch de BD con los últimos datos disponibles
        invalidateNews(category, true);
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timeoutId);
  }, [category, invalidateNews, isBackendAvailable]); // Ejecutar cada vez que cambia la categoría o disponibilidad del backend

  // =========================================================================
  // HANDLER: Cambio de categoría (UI state + URL navigation)
  // Sprint 16 FIX: Usar router.replace para evitar re-renders que causan doble fetch
  // =========================================================================
  const handleCategoryChange = (newCategory: CategoryId) => {
    if (newCategory === category) return;

    console.log(`🔄 [CATEGORY CHANGE] ${category} → ${newCategory}`);

    // 1. PRIMERO actualizar URL (shallow replace, sin re-render completo)
    const url = newCategory === 'general' ? '/' : `/?category=${newCategory}`;
    router.replace(url, { scroll: false });

    // 2. LUEGO actualizar estado local (esto dispara useNews y auto-ingesta)
    // El useEffect de sync se ejecutará DESPUÉS y verá que category ya está actualizado
    setCategory(newCategory);
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
        {/* Header - Google News Style */}
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="px-4 sm:px-6 py-3">
            <div className="flex items-center gap-4">
              {/* Logo/Brand */}
              <div className="flex items-center gap-3 shrink-0">
                <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
                  Verity News
                </h1>
                <Badge variant="secondary" className="hidden sm:inline-flex">Beta</Badge>
              </div>

              {/* Search Bar - Center/Flexible */}
              <div className="flex-1 max-w-2xl">
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
                disabled={isFetching}
              />
            </div>

            {/* Loading State - Solo mostrar en carga inicial (sin datos en caché) */}
            {isLoading && !newsData && (
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

            {/* News Grid - Mostrar mientras haya datos (viejos o nuevos) */}
            {!error && newsData && newsData.data.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-6 max-w-7xl mx-auto">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                      {category === 'favorites' ? 'Tus favoritos' : 'Últimas noticias'}
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
