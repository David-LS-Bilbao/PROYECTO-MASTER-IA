import {
  AiRunStatus,
  AiUsageComparisonData,
  AiUsageEnvelope,
  AiUsageOverviewData,
  AiUsagePromptsData,
  AiUsageRunsData,
} from '@/lib/ai-usage';

export interface AiUsageQueryFilters {
  module?: string;
  operationKey?: string;
  provider?: string;
  model?: string;
  status?: AiRunStatus;
  from?: string;
  to?: string;
}

export interface AiUsagePromptFilters {
  module?: string;
  promptKey?: string;
  isActive?: boolean;
}

type AiUsageQueryParamValue = string | number | boolean | undefined | null;

export async function fetchAiUsageOverview(
  token: string | null,
  filters: AiUsageQueryFilters
): Promise<AiUsageEnvelope<AiUsageOverviewData>> {
  return fetchInternalAiUsage<AiUsageOverviewData, AiUsageQueryFilters>(
    '/api/internal/ai-usage/overview',
    token,
    filters
  );
}

export async function fetchAiUsageRuns(
  token: string | null,
  filters: AiUsageQueryFilters & { limit: number }
): Promise<AiUsageEnvelope<AiUsageRunsData>> {
  return fetchInternalAiUsage<AiUsageRunsData, AiUsageQueryFilters & { limit: number }>(
    '/api/internal/ai-usage/runs',
    token,
    filters
  );
}

export async function fetchAiUsagePrompts(
  token: string | null,
  filters: AiUsagePromptFilters & { limit: number }
): Promise<AiUsageEnvelope<AiUsagePromptsData>> {
  return fetchInternalAiUsage<AiUsagePromptsData, AiUsagePromptFilters & { limit: number }>(
    '/api/internal/ai-usage/prompts',
    token,
    filters
  );
}

export async function fetchAiUsageComparison(
  token: string | null,
  filters: AiUsageQueryFilters
): Promise<AiUsageEnvelope<AiUsageComparisonData>> {
  return fetchInternalAiUsage<AiUsageComparisonData, AiUsageQueryFilters>(
    '/api/internal/ai-usage/compare',
    token,
    filters
  );
}

async function fetchInternalAiUsage<
  T,
  TParams extends object = Record<string, AiUsageQueryParamValue>
>(
  path: string,
  token: string | null,
  params: TParams
): Promise<AiUsageEnvelope<T>> {
  const url = new URL(path, window.location.origin);

  for (const [key, value] of Object.entries(params as Record<string, AiUsageQueryParamValue>)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
    cache: 'no-store',
  });

  const payload = (await response.json()) as
    | ({ success: true } & AiUsageEnvelope<T>)
    | { success: false; error?: string };

  if (!response.ok || !payload.success) {
    throw new Error(
      !response.ok
        ? payload && 'error' in payload && payload.error
          ? payload.error
          : `Error interno (${response.status})`
        : 'No se pudo cargar la observabilidad IA'
    );
  }

  return payload;
}
