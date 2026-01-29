'use client';

import { useState, useEffect } from 'react';
import { fetchNews, fetchDashboardStats, type NewsArticle, type BiasDistribution } from '@/lib/api';
import { NewsCard } from '@/components/news-card';
import { Sidebar, DashboardDrawer } from '@/components/layout';
import { Badge } from '@/components/ui/badge';

export default function Home() {
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [newsData, setNewsData] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data on mount
  useEffect(() => {
    (async () => {
      try {
        const [newsResponse, statsResponse] = await Promise.all([
          fetchNews(50, 0),
          fetchDashboardStats(),
        ]);
        setNewsData(newsResponse);
        setStats(statsResponse);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar las noticias');
        console.error('Error fetching data:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

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

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <Sidebar onOpenDashboard={() => setIsDashboardOpen(true)} />

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
            {!error && newsData && newsData.data.length === 0 && (
              <div className="max-w-2xl mx-auto text-center py-16">
                <div className="text-6xl mb-4">📰</div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                  No hay noticias todavía
                </h2>
                <p className="text-muted-foreground mb-6">
                  Usa el endpoint de ingesta para cargar noticias desde NewsAPI
                </p>
                <code className="block bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg text-sm text-left overflow-x-auto">
                  curl -X POST http://localhost:3000/api/ingest/news \{'\n'}
                  {'  '}-H &quot;Content-Type: application/json&quot; \{'\n'}
                  {'  '}-d &apos;{'{'}
                  &quot;query&quot;: &quot;technology&quot;, &quot;pageSize&quot;: 20{'}'}
                  &apos;
                </code>
              </div>
            )}

            {/* News Grid */}
            {!error && newsData && newsData.data.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-6 max-w-7xl mx-auto">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                    Últimas noticias
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
