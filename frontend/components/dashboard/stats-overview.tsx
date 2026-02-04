'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BiasDistributionChart } from '@/components/dashboard/bias-distribution-chart';
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  const balanceScore = total > 0 ? Math.round((lowBiasCount / total) * 100) : 0;
  
  // Calcular nivel de pluralidad (qué tan balanceada está la cobertura)
  const pluralityScore = total > 0 
    ? Math.min(
        100,
        Math.round(
          100 - Math.abs((biasDistribution.left - biasDistribution.right) / total * 100)
        )
      )
    : 0;

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
    <TooltipProvider>
      <section className="mb-10">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">
            Inteligencia de Medios
          </h2>
          <p className="text-sm text-muted-foreground">
            Análisis automático de las noticias para ayudarte a identificar sesgos y tendencias.
          </p>
        </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* KPI Cards - 40% width on desktop */}
        <div className="grid gap-4 grid-cols-2 lg:col-span-2">
          {/* Total Articles */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm text-muted-foreground">Noticias Totales</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">Total de noticias ingresadas desde tus fuentes RSS activas.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{totalArticles}</p>
            </CardContent>
          </Card>

          {/* Analyzed Articles */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm text-muted-foreground">Analizadas por IA</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">Noticias que han pasado por análisis de sesgo, clickbait y veracidad con inteligencia artificial.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{analyzedCount}</p>
            </CardContent>
          </Card>

          {/* Coverage Percentage */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm text-muted-foreground">% Analizadas</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">Porcentaje de noticias que han sido verificadas automáticamente. Un valor alto indica mejor calidad de datos.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{coverage}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                {coverage >= 80 ? '✅ Excelente' : coverage >= 50 ? '⚠️ Aceptable' : '⏳ Mejorando...'}
              </p>
            </CardContent>
          </Card>

          {/* Balance Score (renamed from Truth Index) */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm text-muted-foreground">Noticias Objetivas</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs font-medium mb-1">¿Qué mide esto?</p>
                    <p className="text-xs">Porcentaje de noticias con bajo sesgo político (ni izquierda ni derecha marcada).</p>
                    <p className="text-xs mt-2 text-green-400">• 70%+ = Cobertura balanceada</p>
                    <p className="text-xs text-yellow-400">• 40-70% = Algo de sesgo</p>
                    <p className="text-xs text-red-400">• &lt;40% = Muy polarizado</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{balanceScore}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                {balanceScore >= 70 ? '✅ Muy balanceado' : balanceScore >= 40 ? '⚠️ Moderado' : '⚡ Polarizado'}
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
    </TooltipProvider>
  );
}
