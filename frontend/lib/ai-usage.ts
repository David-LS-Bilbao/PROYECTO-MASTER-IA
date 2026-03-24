export type AiUsageSourceKey = 'verity' | 'mba';

export type AiRunStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMEOUT'
  | 'CANCELLED';

export interface AiUsageSourceState {
  key: AiUsageSourceKey;
  label: string;
  available: boolean;
  error?: string;
}

export interface AiUsageOverviewData {
  filters: { from: string | null; to: string | null };
  totals: {
    runs: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostMicrosEur: string;
    avgLatencyMs: number | null;
    tokenizedRuns: number;
    costedRuns: number;
    latencyRuns: number;
  };
  byStatus: Array<{ status: AiRunStatus; runs: number }>;
  byModule: Array<{
    module: string;
    runs: number;
    totalTokens: number;
    estimatedCostMicrosEur: string;
  }>;
  byOperation: Array<{
    operationKey: string;
    runs: number;
    totalTokens: number;
    estimatedCostMicrosEur: string;
  }>;
  byProviderModel: Array<{
    provider: string | null;
    model: string | null;
    runs: number;
    totalTokens: number;
    estimatedCostMicrosEur: string;
  }>;
  recentErrors: AiUsageRunError[];
}

export interface AiUsageRunError {
  id: string;
  module: string;
  operationKey: string;
  status: AiRunStatus;
  provider: string | null;
  model: string | null;
  requestId: string;
  correlationId: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  sourceSystem?: AiUsageSourceKey;
}

export interface AiUsagePromptVersionRef {
  id: string;
  module: string;
  promptKey: string;
  version: string;
  templateHash: string;
  sourceFile: string;
  isActive: boolean;
}

export interface AiUsageRunRecord {
  id: string;
  module: string;
  operationKey: string;
  provider: string | null;
  model: string | null;
  status: AiRunStatus;
  requestId: string;
  correlationId: string;
  endpoint: string | null;
  userId: string | null;
  entityType: string | null;
  entityId: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedCostMicrosEur: string | null;
  latencyMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  promptVersionId: string | null;
  createdAt: string;
  completedAt: string | null;
  metadataJson: unknown;
  promptVersion: AiUsagePromptVersionRef | null;
  sourceSystem?: AiUsageSourceKey;
}

export interface AiUsageRunsData {
  total: number;
  limit: number;
  hasMore: boolean;
  runs: AiUsageRunRecord[];
}

export interface AiUsagePromptVersionRecord {
  id: string;
  module: string;
  promptKey: string;
  version: string;
  templateHash: string;
  sourceFile: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  runs: number;
  lastUsedAt: string | null;
  sourceSystem?: AiUsageSourceKey;
}

export interface AiUsagePromptsData {
  total: number;
  limit: number;
  hasMore: boolean;
  promptVersions: AiUsagePromptVersionRecord[];
}

export interface AiUsageComparisonMetrics {
  runs: number;
  errorRuns: number;
  tokenizedRuns: number;
  costedRuns: number;
  latencyRuns: number;
  totalTokens: number;
  estimatedCostMicrosEur: string;
  totalLatencyMs: string;
  avgTokens: number | null;
  avgCostMicrosEur: string | null;
  avgLatencyMs: number | null;
  errorRate: number;
}

export interface AiUsageComparisonData {
  filters: { from: string | null; to: string | null };
  byModule: Array<{ module: string | null } & AiUsageComparisonMetrics>;
  byOperation: Array<{ operationKey: string | null } & AiUsageComparisonMetrics>;
  byProvider: Array<{ provider: string | null } & AiUsageComparisonMetrics>;
  byModel: Array<{ model: string | null } & AiUsageComparisonMetrics>;
}

export interface AiUsageEnvelope<T> {
  sources: AiUsageSourceState[];
  data: T;
}

type AiUsageGroupedTotal = {
  runs: number;
  totalTokens: number;
  estimatedCostMicrosEur: bigint;
};

type AiUsageProviderModelTotal = {
  provider: string | null;
  model: string | null;
  runs: number;
  totalTokens: number;
  estimatedCostMicrosEur: bigint;
};

type AiUsageComparisonRow<K extends string> = AiUsageComparisonMetrics & Record<K, string | null>;

export function mergeOverviewPayloads(
  payloads: Array<{ sourceSystem: AiUsageSourceKey; data: AiUsageOverviewData }>
): AiUsageOverviewData {
  let totalRuns = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let estimatedCostMicrosEur = BigInt(0);
  let latencyRuns = 0;
  let totalLatencyWeighted = 0;
  let tokenizedRuns = 0;
  let costedRuns = 0;

  const byStatus = new Map<AiRunStatus, number>();
  const byModule = new Map<string, AiUsageGroupedTotal>();
  const byOperation = new Map<string, AiUsageGroupedTotal>();
  const byProviderModel = new Map<string, AiUsageProviderModelTotal>();
  const recentErrors: AiUsageRunError[] = [];

  for (const payload of payloads) {
    totalRuns += payload.data.totals.runs;
    promptTokens += payload.data.totals.promptTokens;
    completionTokens += payload.data.totals.completionTokens;
    totalTokens += payload.data.totals.totalTokens;
    estimatedCostMicrosEur += parseBigInt(payload.data.totals.estimatedCostMicrosEur);
    tokenizedRuns += payload.data.totals.tokenizedRuns ?? 0;
    costedRuns += payload.data.totals.costedRuns ?? 0;
    latencyRuns += payload.data.totals.latencyRuns ?? 0;
    totalLatencyWeighted +=
      (payload.data.totals.avgLatencyMs ?? 0) * (payload.data.totals.latencyRuns ?? 0);

    for (const entry of payload.data.byStatus) {
      byStatus.set(entry.status, (byStatus.get(entry.status) ?? 0) + entry.runs);
    }

    for (const entry of payload.data.byModule) {
      const current = byModule.get(entry.module) ?? {
        runs: 0,
        totalTokens: 0,
        estimatedCostMicrosEur: BigInt(0),
      };
      current.runs += entry.runs;
      current.totalTokens += entry.totalTokens;
      current.estimatedCostMicrosEur += parseBigInt(entry.estimatedCostMicrosEur);
      byModule.set(entry.module, current);
    }

    for (const entry of payload.data.byOperation) {
      const current = byOperation.get(entry.operationKey) ?? {
        runs: 0,
        totalTokens: 0,
        estimatedCostMicrosEur: BigInt(0),
      };
      current.runs += entry.runs;
      current.totalTokens += entry.totalTokens;
      current.estimatedCostMicrosEur += parseBigInt(entry.estimatedCostMicrosEur);
      byOperation.set(entry.operationKey, current);
    }

    for (const entry of payload.data.byProviderModel) {
      const key = `${entry.provider ?? '__null__'}::${entry.model ?? '__null__'}`;
      const current = byProviderModel.get(key) ?? {
        provider: entry.provider,
        model: entry.model,
        runs: 0,
        totalTokens: 0,
        estimatedCostMicrosEur: BigInt(0),
      };
      current.runs += entry.runs;
      current.totalTokens += entry.totalTokens;
      current.estimatedCostMicrosEur += parseBigInt(entry.estimatedCostMicrosEur);
      byProviderModel.set(key, current);
    }

    recentErrors.push(
      ...payload.data.recentErrors.map((entry) => ({
        ...entry,
        sourceSystem: payload.sourceSystem,
      }))
    );
  }

  return {
    filters: {
      from: payloads[0]?.data.filters.from ?? null,
      to: payloads[0]?.data.filters.to ?? null,
    },
    totals: {
      runs: totalRuns,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostMicrosEur: estimatedCostMicrosEur.toString(),
      avgLatencyMs: latencyRuns > 0 ? Math.round(totalLatencyWeighted / latencyRuns) : null,
      tokenizedRuns,
      costedRuns,
      latencyRuns,
    },
    byStatus: Array.from(byStatus.entries())
      .map(([status, runs]) => ({ status, runs }))
      .sort((a, b) => b.runs - a.runs),
    byModule: Array.from(byModule.entries())
      .map(([module, entry]) => ({
        module,
        runs: entry.runs,
        totalTokens: entry.totalTokens,
        estimatedCostMicrosEur: entry.estimatedCostMicrosEur.toString(),
      }))
      .sort((a, b) => b.runs - a.runs),
    byOperation: Array.from(byOperation.entries())
      .map(([operationKey, entry]) => ({
        operationKey,
        runs: entry.runs,
        totalTokens: entry.totalTokens,
        estimatedCostMicrosEur: entry.estimatedCostMicrosEur.toString(),
      }))
      .sort((a, b) => b.runs - a.runs),
    byProviderModel: Array.from(byProviderModel.values())
      .map((entry) => ({
        provider: entry.provider,
        model: entry.model,
        runs: entry.runs,
        totalTokens: entry.totalTokens,
        estimatedCostMicrosEur: entry.estimatedCostMicrosEur.toString(),
      }))
      .sort((a, b) => b.runs - a.runs),
    recentErrors: recentErrors
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 10),
  };
}

export function mergeRunsPayloads(
  payloads: Array<{ sourceSystem: AiUsageSourceKey; data: { total: number; runs: AiUsageRunRecord[] } }>,
  limit: number
): AiUsageRunsData {
  const runs = payloads
    .flatMap((payload) =>
      payload.data.runs.map((run) => ({
        ...run,
        sourceSystem: payload.sourceSystem,
      }))
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);

  const total = payloads.reduce((acc, payload) => acc + payload.data.total, 0);

  return {
    total,
    limit,
    hasMore: total > limit,
    runs,
  };
}

export function mergePromptPayloads(
  payloads: Array<{
    sourceSystem: AiUsageSourceKey;
    data: { total: number; promptVersions: AiUsagePromptVersionRecord[] };
  }>,
  limit: number
): AiUsagePromptsData {
  const promptVersions = payloads
    .flatMap((payload) =>
      payload.data.promptVersions.map((promptVersion) => ({
        ...promptVersion,
        sourceSystem: payload.sourceSystem,
      }))
    )
    .sort((a, b) => {
      const left = a.lastUsedAt ? Date.parse(a.lastUsedAt) : Date.parse(a.updatedAt);
      const right = b.lastUsedAt ? Date.parse(b.lastUsedAt) : Date.parse(b.updatedAt);
      return right - left;
    })
    .slice(0, limit);

  const total = payloads.reduce((acc, payload) => acc + payload.data.total, 0);

  return {
    total,
    limit,
    hasMore: total > limit,
    promptVersions,
  };
}

export function mergeComparisonPayloads(
  payloads: Array<{ sourceSystem: AiUsageSourceKey; data: AiUsageComparisonData }>
): AiUsageComparisonData {
  return {
    filters: {
      from: payloads[0]?.data.filters.from ?? null,
      to: payloads[0]?.data.filters.to ?? null,
    },
    byModule: mergeComparisonDimension(payloads.map((payload) => payload.data.byModule), 'module'),
    byOperation: mergeComparisonDimension(
      payloads.map((payload) => payload.data.byOperation),
      'operationKey'
    ),
    byProvider: mergeComparisonDimension(
      payloads.map((payload) => payload.data.byProvider),
      'provider'
    ),
    byModel: mergeComparisonDimension(payloads.map((payload) => payload.data.byModel), 'model'),
  };
}

function mergeComparisonDimension<K extends string>(
  payloads: Array<Array<AiUsageComparisonRow<K>>>,
  keyField: K
): Array<AiUsageComparisonRow<K>> {
  const merged = new Map<string, AiUsageComparisonRow<K>>();

  for (const payload of payloads) {
    for (const entry of payload) {
      const keyValue = entry[keyField];
      const mapKey = keyValue ?? '__null__';
      const current = merged.get(mapKey);

      if (!current) {
        merged.set(mapKey, { ...entry });
        continue;
      }

      current.runs += entry.runs;
      current.errorRuns += entry.errorRuns;
      current.tokenizedRuns += entry.tokenizedRuns;
      current.costedRuns += entry.costedRuns;
      current.latencyRuns += entry.latencyRuns;
      current.totalTokens += entry.totalTokens;
      current.estimatedCostMicrosEur = (
        parseBigInt(current.estimatedCostMicrosEur) + parseBigInt(entry.estimatedCostMicrosEur)
      ).toString();
      current.totalLatencyMs = (
        parseBigInt(current.totalLatencyMs) + parseBigInt(entry.totalLatencyMs)
      ).toString();
      current.avgTokens =
        current.tokenizedRuns > 0
          ? Math.round(current.totalTokens / current.tokenizedRuns)
          : null;
      current.avgCostMicrosEur =
        current.costedRuns > 0
          ? (parseBigInt(current.estimatedCostMicrosEur) / BigInt(current.costedRuns)).toString()
          : null;
      current.avgLatencyMs =
        current.latencyRuns > 0
          ? Number(parseBigInt(current.totalLatencyMs) / BigInt(current.latencyRuns))
          : null;
      current.errorRate = current.runs > 0 ? current.errorRuns / current.runs : 0;
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.runs - a.runs);
}

export function parseBigInt(value: string | bigint | number | null | undefined): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return BigInt(value);
  }

  return BigInt(0);
}

export function formatMicrosEur(
  value: string | null | undefined,
  options: { fallback?: string; fractionDigits?: number } = {}
): string {
  if (!value) {
    return options.fallback ?? 'Sin datos';
  }

  const micros = parseBigInt(value);
  const sign = micros < 0 ? '-' : '';
  const absolute = micros < 0 ? -micros : micros;
  const microsPerEuro = BigInt(1000000);
  const fractionDigits =
    options.fractionDigits ??
    (absolute > BigInt(0) && absolute < BigInt(10000) ? 6 : 4);
  const integerPart = absolute / microsPerEuro;
  const fractionalPart = absolute % microsPerEuro;
  const fraction = fractionalPart
    .toString()
    .padStart(6, '0')
    .slice(0, Math.min(Math.max(fractionDigits, 0), 6));

  const formattedInteger = new Intl.NumberFormat('es-ES').format(Number(integerPart));
  const decimals = fractionDigits > 0 ? `,${fraction}` : '';

  return `${sign}${formattedInteger}${decimals} €`;
}

export function formatTokenMetric(value: number | null | undefined): string {
  if (typeof value !== 'number') {
    return 'Sin datos del proveedor';
  }

  return new Intl.NumberFormat('es-ES').format(value);
}

export function formatLatency(value: number | null | undefined): string {
  if (typeof value !== 'number') {
    return 'Sin datos';
  }

  return `${new Intl.NumberFormat('es-ES').format(value)} ms`;
}

export function formatErrorRate(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatRunIdentifier(run: Pick<AiUsageRunRecord, 'requestId' | 'correlationId'>): string {
  if (run.requestId) {
    return run.requestId;
  }

  return run.correlationId;
}

export function formatEntityLabel(run: Pick<AiUsageRunRecord, 'entityType' | 'entityId'>): string {
  if (!run.entityType && !run.entityId) {
    return 'Sin entidad';
  }

  return [run.entityType ?? 'entity', run.entityId ?? 'sin-id'].join(':');
}

export function getErrorRunsCount(overview: AiUsageOverviewData): number {
  return overview.byStatus
    .filter((entry) => ['FAILED', 'TIMEOUT', 'CANCELLED'].includes(entry.status))
    .reduce((acc, entry) => acc + entry.runs, 0);
}

export function buildDateRangeParams(from: string, to: string): {
  from?: string;
  to?: string;
} {
  const params: { from?: string; to?: string } = {};

  if (from) {
    params.from = `${from}T00:00:00.000Z`;
  }
  if (to) {
    params.to = `${to}T23:59:59.999Z`;
  }

  return params;
}
