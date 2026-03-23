'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Bot,
  ChevronLeft,
  Database,
  Gauge,
  RefreshCw,
  TableProperties,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAiUsageComparison, useAiUsageOverview, useAiUsagePrompts, useAiUsageRuns } from '@/hooks/useAiUsage';
import {
  type AiUsageComparisonMetrics,
  type AiRunStatus,
  buildDateRangeParams,
  formatEntityLabel,
  formatErrorRate,
  formatLatency,
  formatMicrosEur,
  formatRunIdentifier,
  formatTokenMetric,
  getErrorRunsCount,
  type AiUsageRunRecord,
} from '@/lib/ai-usage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type PromptStateFilter = 'all' | 'active' | 'inactive';

const RUN_STATUS_OPTIONS = ['PENDING', 'COMPLETED', 'FAILED', 'TIMEOUT', 'CANCELLED'] as const;

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'FAILED':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'TIMEOUT':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'CANCELLED':
      return 'bg-zinc-200 text-zinc-700 border-zinc-300';
    default:
      return 'bg-blue-100 text-blue-700 border-blue-200';
  }
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function truncateValue(value: string | null | undefined, maxLength = 24): string {
  if (!value) {
    return 'Sin dato';
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function SectionTable<K extends string>({
  title,
  description,
  rows,
  labelKey,
}: {
  title: string;
  description: string;
  rows: Array<Record<K, string | null> & AiUsageComparisonMetrics>;
  labelKey: K;
}) {
  return (
    <Card className="border-zinc-200/80 bg-white/95">
      <CardHeader className="border-b border-zinc-100">
        <CardTitle className="text-base text-zinc-900">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {rows.length === 0 && (
            <p className="text-sm text-zinc-500">No hay datos agregados para este bloque.</p>
          )}
          {rows.slice(0, 6).map((row) => {
            const labelValue = row[labelKey];
            const runs = row.runs as number;
            const errorRate = row.errorRate as number;

            return (
              <div key={`${labelKey}-${String(labelValue)}`} className="rounded-lg border border-zinc-200 p-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {labelValue ? String(labelValue) : 'Sin dato'}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {runs} runs · {formatTokenMetric((row.avgTokens as number | null) ?? null)} tokens medios
                    </p>
                  </div>
                  <div className="text-right text-xs text-zinc-500">
                    <div>{formatMicrosEur(row.avgCostMicrosEur as string | null)}</div>
                    <div>{formatLatency((row.avgLatencyMs as number | null) ?? null)}</div>
                    <div>{formatErrorRate(errorRate)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SourceStatusCard({
  label,
  available,
  error,
}: {
  label: string;
  available: boolean;
  error?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 text-sm',
        available
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-800'
      )}
    >
      <div className="font-medium">{label}</div>
      <div className="text-xs">{available ? 'Fuente disponible' : error ?? 'Fuente no disponible'}</div>
    </div>
  );
}

export function AiUsageManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [moduleFilter, setModuleFilter] = useState('');
  const [operationFilter, setOperationFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<AiRunStatus | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [runsLimit, setRunsLimit] = useState(20);
  const [promptLimit, setPromptLimit] = useState(20);
  const [promptStateFilter, setPromptStateFilter] = useState<PromptStateFilter>('all');
  const [selectedRun, setSelectedRun] = useState<AiUsageRunRecord | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  const queryFilters = {
    module: moduleFilter || undefined,
    operationKey: operationFilter || undefined,
    provider: providerFilter || undefined,
    model: modelFilter || undefined,
    status: statusFilter || undefined,
    ...buildDateRangeParams(fromDate, toDate),
  };

  const promptsFilters = {
    module: moduleFilter || undefined,
    isActive:
      promptStateFilter === 'all'
        ? undefined
        : promptStateFilter === 'active',
    limit: promptLimit,
  };

  const overviewQuery = useAiUsageOverview(queryFilters, !!user && !authLoading);
  const runsQuery = useAiUsageRuns({ ...queryFilters, limit: runsLimit }, !!user && !authLoading);
  const promptsQuery = useAiUsagePrompts(promptsFilters, !!user && !authLoading);
  const comparisonQuery = useAiUsageComparison(queryFilters, !!user && !authLoading);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-base font-medium text-zinc-700">Cargando gestión de uso de IA...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const overview = overviewQuery.data?.data;
  const runs = runsQuery.data?.data;
  const prompts = promptsQuery.data?.data;
  const comparison = comparisonQuery.data?.data;
  const sourceStatus = overviewQuery.data?.sources ?? runsQuery.data?.sources ?? [];
  const totalErrors = overview ? getErrorRunsCount(overview) : 0;
  const moduleOptions = overview?.byModule.map((entry) => entry.module) ?? [];
  const operationOptions = overview?.byOperation.map((entry) => entry.operationKey) ?? [];
  const providerOptions = Array.from(
    new Set((overview?.byProviderModel ?? []).map((entry) => entry.provider).filter(Boolean))
  ) as string[];
  const modelOptions = Array.from(
    new Set((overview?.byProviderModel ?? []).map((entry) => entry.model).filter(Boolean))
  ) as string[];

  const handleRefresh = async () => {
    await Promise.all([
      overviewQuery.refetch(),
      runsQuery.refetch(),
      promptsQuery.refetch(),
      comparisonQuery.refetch(),
    ]);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8fb_0%,#ffffff_100%)]">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
                Interno
              </Badge>
              <h1 className="text-2xl font-bold text-zinc-900">Gestión de uso de Inteligencia Artificial</h1>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Consulta unificada de observabilidad IA para Verity y Media Bias Atlas.
            </p>
          </div>
          <Button variant="outline" onClick={() => void handleRefresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refrescar
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
        <Card className="border-zinc-200 bg-white/95">
          <CardHeader className="border-b border-zinc-100">
            <CardTitle className="text-base">Filtros operativos</CardTitle>
            <CardDescription>
              La tabla y los agregados usan solo métricas reales persistidas. Si un proveedor no reporta tokens o coste, la UI lo muestra como dato ausente.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-7">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Desde</label>
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Hasta</label>
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Módulo</label>
              <select
                value={moduleFilter}
                onChange={(event) => setModuleFilter(event.target.value)}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
              >
                <option value="">Todos</option>
                {moduleOptions.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Operación</label>
              <select
                value={operationFilter}
                onChange={(event) => setOperationFilter(event.target.value)}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
              >
                <option value="">Todas</option>
                {operationOptions.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Provider</label>
              <select
                value={providerFilter}
                onChange={(event) => setProviderFilter(event.target.value)}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
              >
                <option value="">Todos</option>
                {providerOptions.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Modelo</label>
              <select
                value={modelFilter}
                onChange={(event) => setModelFilter(event.target.value)}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
              >
                <option value="">Todos</option>
                {modelOptions.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Estado</label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter((event.target.value || '') as AiRunStatus | '')}
                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm"
              >
                <option value="">Todos</option>
                {RUN_STATUS_OPTIONS.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {sourceStatus.map((source) => {
            const { key: sourceKey, ...sourceState } = source;
            return <SourceStatusCard key={sourceKey} {...sourceState} />;
          })}
        </div>

        {(overviewQuery.error || runsQuery.error || promptsQuery.error || comparisonQuery.error) && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-start gap-3 pt-6 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Hay secciones que no se han podido cargar.</p>
                <p>
                  {overviewQuery.error?.message ||
                    runsQuery.error?.message ||
                    promptsQuery.error?.message ||
                    comparisonQuery.error?.message}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-zinc-200 bg-white/95">
            <CardHeader>
              <CardDescription>Total de runs</CardDescription>
              <CardTitle className="text-3xl">{overview ? overview.totals.runs : '...'}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-zinc-200 bg-white/95">
            <CardHeader>
              <CardDescription>Total de tokens conocidos</CardDescription>
              <CardTitle className="text-3xl">
                {overview ? formatTokenMetric(overview.totals.totalTokens) : '...'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-zinc-200 bg-white/95">
            <CardHeader>
              <CardDescription>Coste estimado conocido</CardDescription>
              <CardTitle className="text-3xl">
                {overview ? formatMicrosEur(overview.totals.estimatedCostMicrosEur) : '...'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-zinc-200 bg-white/95">
            <CardHeader>
              <CardDescription>Runs con error</CardDescription>
              <CardTitle className="text-3xl">{overview ? totalErrors : '...'}</CardTitle>
            </CardHeader>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="border-zinc-200 bg-white/95">
            <CardHeader className="border-b border-zinc-100">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-blue-600" />
                Distribución por módulo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {(overview?.byModule ?? []).map((entry) => (
                <div key={entry.module}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-900">{entry.module}</span>
                    <span className="text-zinc-500">{entry.runs} runs</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100">
                    <div
                      className="h-2 rounded-full bg-blue-600"
                      style={{
                        width: `${overview ? Math.max((entry.runs / Math.max(overview.totals.runs, 1)) * 100, 4) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white/95">
            <CardHeader className="border-b border-zinc-100">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4 text-blue-600" />
                Distribución por operación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {(overview?.byOperation ?? []).slice(0, 6).map((entry) => (
                <div key={entry.operationKey} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-medium text-zinc-900">{entry.operationKey}</div>
                    <div className="text-zinc-500">{formatMicrosEur(entry.estimatedCostMicrosEur)}</div>
                  </div>
                  <Badge variant="outline">{entry.runs} runs</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white/95">
            <CardHeader className="border-b border-zinc-100">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="h-4 w-4 text-blue-600" />
                Provider / modelo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {(overview?.byProviderModel ?? []).slice(0, 6).map((entry) => (
                <div key={`${entry.provider}-${entry.model}`} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-medium text-zinc-900">
                      {entry.provider ?? 'Sin provider'} / {entry.model ?? 'Sin modelo'}
                    </div>
                    <div className="text-zinc-500">{formatTokenMetric(entry.totalTokens)}</div>
                  </div>
                  <Badge variant="outline">{entry.runs} runs</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="border-zinc-200 bg-white/95">
            <CardHeader className="border-b border-zinc-100">
              <CardTitle className="flex items-center gap-2 text-base">
                <TableProperties className="h-4 w-4 text-blue-600" />
                Tabla de ejecuciones
              </CardTitle>
              <CardDescription>
                El detalle de un run se abre en panel lateral y usa metadatos saneados. Las métricas nulas se muestran sin inventar valores.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Módulo</th>
                      <th className="px-3 py-2">Operación</th>
                      <th className="px-3 py-2">Provider</th>
                      <th className="px-3 py-2">Modelo</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Prompt</th>
                      <th className="px-3 py-2">Completion</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Coste</th>
                      <th className="px-3 py-2">Latencia</th>
                      <th className="px-3 py-2">Request/Correlation</th>
                      <th className="px-3 py-2">Entidad</th>
                      <th className="px-3 py-2">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(runs?.runs ?? []).map((run) => (
                      <tr key={`${run.sourceSystem}-${run.id}`} className="border-b border-zinc-100 align-top">
                        <td className="px-3 py-3 text-zinc-600">{formatDateTime(run.createdAt)}</td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-zinc-900">{run.module}</div>
                          <div className="text-xs text-zinc-500">{run.sourceSystem}</div>
                        </td>
                        <td className="px-3 py-3 text-zinc-700">{run.operationKey}</td>
                        <td className="px-3 py-3 text-zinc-700">{run.provider ?? 'Sin dato'}</td>
                        <td className="px-3 py-3 text-zinc-700">{run.model ?? 'Sin dato'}</td>
                        <td className="px-3 py-3">
                          <Badge className={cn('border', getStatusBadgeClass(run.status))}>{run.status}</Badge>
                        </td>
                        <td className="px-3 py-3 text-zinc-700">{formatTokenMetric(run.promptTokens)}</td>
                        <td className="px-3 py-3 text-zinc-700">{formatTokenMetric(run.completionTokens)}</td>
                        <td className="px-3 py-3 text-zinc-700">{formatTokenMetric(run.totalTokens)}</td>
                        <td className="px-3 py-3 text-zinc-700">{formatMicrosEur(run.estimatedCostMicrosEur)}</td>
                        <td className="px-3 py-3 text-zinc-700">{formatLatency(run.latencyMs)}</td>
                        <td className="px-3 py-3 text-zinc-600">{truncateValue(formatRunIdentifier(run))}</td>
                        <td className="px-3 py-3 text-zinc-600">{truncateValue(formatEntityLabel(run), 28)}</td>
                        <td className="px-3 py-3">
                          <Button variant="outline" size="sm" onClick={() => setSelectedRun(run)}>
                            Ver
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {runs?.runs.length === 0 && (
                <div className="py-8 text-center text-sm text-zinc-500">
                  No hay ejecuciones que cumplan los filtros actuales.
                </div>
              )}

              {runs?.hasMore && (
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" onClick={() => setRunsLimit((current) => Math.min(current + 20, 100))}>
                    Cargar 20 runs más
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <Card className="border-zinc-200 bg-white/95">
            <CardHeader className="border-b border-zinc-100">
              <CardTitle className="text-base">Catálogo de prompts</CardTitle>
              <CardDescription>
                Versiones registradas sin exponer prompts interpolados ni respuestas completas.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="mb-4 flex flex-wrap gap-2">
                <Button
                  variant={promptStateFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPromptStateFilter('all')}
                >
                  Todos
                </Button>
                <Button
                  variant={promptStateFilter === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPromptStateFilter('active')}
                >
                  Activos
                </Button>
                <Button
                  variant={promptStateFilter === 'inactive' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPromptStateFilter('inactive')}
                >
                  Inactivos
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-2">Módulo</th>
                      <th className="px-3 py-2">Prompt key</th>
                      <th className="px-3 py-2">Versión</th>
                      <th className="px-3 py-2">Hash</th>
                      <th className="px-3 py-2">Source file</th>
                      <th className="px-3 py-2">Activo</th>
                      <th className="px-3 py-2">Runs</th>
                      <th className="px-3 py-2">Último uso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(prompts?.promptVersions ?? []).map((prompt) => (
                      <tr key={`${prompt.sourceSystem}-${prompt.id}`} className="border-b border-zinc-100">
                        <td className="px-3 py-3 text-zinc-700">{prompt.module}</td>
                        <td className="px-3 py-3 font-medium text-zinc-900">{prompt.promptKey}</td>
                        <td className="px-3 py-3 text-zinc-700">{prompt.version}</td>
                        <td className="px-3 py-3 text-zinc-600">{truncateValue(prompt.templateHash, 20)}</td>
                        <td className="px-3 py-3 text-zinc-600">{truncateValue(prompt.sourceFile, 28)}</td>
                        <td className="px-3 py-3">
                          <Badge variant="outline">{prompt.isActive ? 'Sí' : 'No'}</Badge>
                        </td>
                        <td className="px-3 py-3 text-zinc-700">{prompt.runs}</td>
                        <td className="px-3 py-3 text-zinc-600">{formatDateTime(prompt.lastUsedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {prompts?.hasMore && (
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" onClick={() => setPromptLimit((current) => Math.min(current + 20, 100))}>
                    Cargar 20 prompts más
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white/95">
            <CardHeader className="border-b border-zinc-100">
              <CardTitle className="text-base">Errores recientes</CardTitle>
              <CardDescription>
                Últimos runs fallidos, timeout o cancelados en ambos módulos.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {(overview?.recentErrors ?? []).map((entry) => (
                  <div key={`${entry.sourceSystem}-${entry.id}`} className="rounded-lg border border-zinc-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-zinc-900">{entry.operationKey}</div>
                        <div className="text-xs text-zinc-500">
                          {entry.module} · {entry.provider ?? 'sin provider'} / {entry.model ?? 'sin modelo'}
                        </div>
                      </div>
                      <Badge className={cn('border', getStatusBadgeClass(entry.status))}>{entry.status}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-zinc-600">
                      {entry.errorCode ?? 'Sin código'} · {truncateValue(entry.errorMessage, 80)}
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">{formatDateTime(entry.createdAt)}</div>
                  </div>
                ))}
                {(overview?.recentErrors.length ?? 0) === 0 && (
                  <p className="text-sm text-zinc-500">No hay errores recientes en el rango actual.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <SectionTable
            title="Comparador por módulo"
            description="Runs, medias y tasa de error por módulo."
            rows={comparison?.byModule ?? []}
            labelKey="module"
          />
          <SectionTable
            title="Comparador por operación"
            description="Comparativa de coste, latencia y errores por operación."
            rows={comparison?.byOperation ?? []}
            labelKey="operationKey"
          />
          <SectionTable
            title="Comparador por provider"
            description="Indicadores agregados por proveedor."
            rows={comparison?.byProvider ?? []}
            labelKey="provider"
          />
          <SectionTable
            title="Comparador por modelo"
            description="Indicadores agregados por modelo."
            rows={comparison?.byModel ?? []}
            labelKey="model"
          />
        </section>
      </main>

      <Sheet open={Boolean(selectedRun)} onOpenChange={(open) => !open && setSelectedRun(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader className="border-b border-zinc-200">
            <SheetTitle>Detalle de ejecución IA</SheetTitle>
            <SheetDescription>
              Metadatos operativos saneados del run seleccionado.
            </SheetDescription>
          </SheetHeader>

          {selectedRun && (
            <ScrollArea className="h-[calc(100vh-96px)]">
              <div className="space-y-6 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <DetailCard label="Fecha" value={formatDateTime(selectedRun.createdAt)} />
                  <DetailCard label="Status" value={selectedRun.status} />
                  <DetailCard label="Módulo" value={selectedRun.module} />
                  <DetailCard label="Operación" value={selectedRun.operationKey} />
                  <DetailCard label="Provider" value={selectedRun.provider ?? 'Sin dato'} />
                  <DetailCard label="Modelo" value={selectedRun.model ?? 'Sin dato'} />
                  <DetailCard label="Request ID" value={selectedRun.requestId || 'Sin dato'} />
                  <DetailCard label="Correlation ID" value={selectedRun.correlationId || 'Sin dato'} />
                  <DetailCard label="Endpoint" value={selectedRun.endpoint ?? 'Sin endpoint'} />
                  <DetailCard label="Entidad" value={formatEntityLabel(selectedRun)} />
                  <DetailCard label="Prompt tokens" value={formatTokenMetric(selectedRun.promptTokens)} />
                  <DetailCard label="Completion tokens" value={formatTokenMetric(selectedRun.completionTokens)} />
                  <DetailCard label="Total tokens" value={formatTokenMetric(selectedRun.totalTokens)} />
                  <DetailCard label="Coste estimado" value={formatMicrosEur(selectedRun.estimatedCostMicrosEur)} />
                  <DetailCard label="Latencia" value={formatLatency(selectedRun.latencyMs)} />
                  <DetailCard label="Origen" value={selectedRun.sourceSystem ?? 'Sin dato'} />
                </div>

                <Card className="border-zinc-200 bg-zinc-50/80">
                  <CardHeader>
                    <CardTitle className="text-base">Prompt version</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    <DetailCard label="Prompt key" value={selectedRun.promptVersion?.promptKey ?? 'Sin promptVersion'} />
                    <DetailCard label="Versión" value={selectedRun.promptVersion?.version ?? 'Sin promptVersion'} />
                    <DetailCard label="Template hash" value={selectedRun.promptVersion?.templateHash ?? 'Sin promptVersion'} />
                    <DetailCard label="Source file" value={selectedRun.promptVersion?.sourceFile ?? 'Sin promptVersion'} />
                  </CardContent>
                </Card>

                {(selectedRun.errorCode || selectedRun.errorMessage) && (
                  <Card className="border-red-200 bg-red-50">
                    <CardHeader>
                      <CardTitle className="text-base text-red-700">Error</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-red-700">
                      <div><span className="font-medium">Código:</span> {selectedRun.errorCode ?? 'Sin código'}</div>
                      <div><span className="font-medium">Mensaje:</span> {selectedRun.errorMessage ?? 'Sin mensaje'}</div>
                    </CardContent>
                  </Card>
                )}

                <Card className="border-zinc-200 bg-zinc-50/80">
                  <CardHeader>
                    <CardTitle className="text-base">Metadata JSON saneada</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-xs text-zinc-100">
                      {JSON.stringify(selectedRun.metadataJson ?? {}, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 break-words text-sm text-zinc-900">{value}</div>
    </div>
  );
}
