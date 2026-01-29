'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BiasDistributionChart } from '@/components/dashboard/bias-distribution-chart';

interface BiasDistribution {
  left: number;
  neutral: number;
  right: number;
}

interface StatsOverviewProps {
  totalArticles: number;
  analyzedCount: number;
  coverage: number;
  biasDistribution: BiasDistribution;
  isLoading?: boolean;
}

export function StatsOverview({
  totalArticles,
  analyzedCount,
  coverage,
  biasDistribution,
  isLoading = false,
}: StatsOverviewProps) {
  const total = biasDistribution.left + biasDistribution.neutral + biasDistribution.right;
  const lowBiasCount = biasDistribution.neutral; // Consideramos neutral como bajo sesgo
  const truthIndex = total > 0 ? Math.round((lowBiasCount / total) * 100) : 0;

  if (isLoading) {
    return (
      <section className="mb-10">
        <div className="mb-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:col-span-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-50 w-full" />
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-10">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">
          Inteligencia de Medios
        </h2>
        <p className="text-sm text-muted-foreground">
          Resumen de cobertura y distribución de sesgo en las noticias analizadas.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* KPI Cards - 40% width on desktop */}
        <div className="grid gap-4 grid-cols-2 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Noticias Totales</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{totalArticles}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Analizadas con IA</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{analyzedCount}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Cobertura IA</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{coverage}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Índice de Veracidad</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{truthIndex}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                Noticias sin sesgo alto
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Bias Chart - 60% width on desktop */}
        <div className="lg:col-span-3">
          <BiasDistributionChart data={biasDistribution} />
        </div>
      </div>
    </section>
  );
}
