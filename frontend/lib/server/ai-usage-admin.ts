import 'server-only';

import { NextRequest } from 'next/server';
import {
  AiUsageComparisonData,
  AiUsageEnvelope,
  AiUsageOverviewData,
  AiUsagePromptsData,
  AiUsageRunsData,
  AiUsageSourceKey,
  AiUsageSourceState,
  mergeComparisonPayloads,
  mergeOverviewPayloads,
  mergePromptPayloads,
  mergeRunsPayloads,
} from '@/lib/ai-usage';

const FETCH_TIMEOUT_MS = 15000;

interface SourceConfig {
  key: AiUsageSourceKey;
  label: string;
  baseUrl: string | null;
}

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

function getSourceConfigs(): SourceConfig[] {
  const verityBaseUrl =
    process.env.AI_USAGE_VERITY_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:3000';
  const mbaBaseUrl = process.env.AI_USAGE_MBA_API_URL ?? 'http://localhost:3002';

  return [
    {
      key: 'verity',
      label: 'Verity',
      baseUrl: normalizeBaseUrl(verityBaseUrl),
    },
    {
      key: 'mba',
      label: 'Media Bias Atlas',
      baseUrl: normalizeBaseUrl(mbaBaseUrl),
    },
  ];
}

function normalizeBaseUrl(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }

  return value.replace(/\/api\/?$/, '').replace(/\/+$/, '');
}

function getAdminSecret(): string {
  const secret = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET;

  if (!secret) {
    throw new HttpError(
      'Falta ADMIN_API_SECRET o CRON_SECRET para consultar observabilidad IA interna.',
      500
    );
  }

  return secret;
}

export async function ensureAiUsageAuth(request: NextRequest): Promise<void> {
  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    throw new HttpError('No hay sesión autenticada para acceder a la gestión interna de IA.', 401);
  }

  const verityBaseUrl = getSourceConfigs().find((source) => source.key === 'verity')?.baseUrl;
  if (!verityBaseUrl) {
    throw new HttpError('No se ha configurado la URL del backend de Verity.', 500);
  }

  const response = await fetch(`${verityBaseUrl}/api/user/me`, {
    method: 'GET',
    headers: {
      Authorization: authorization,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new HttpError('La sesión no es válida para acceder a la gestión interna de IA.', 401);
  }
}

export async function getMergedOverview(
  searchParams: URLSearchParams
): Promise<AiUsageEnvelope<AiUsageOverviewData>> {
  const { availableResults, sources } = await fetchAllSources<AiUsageOverviewData>('overview', searchParams);

  return {
    sources,
    data: mergeOverviewPayloads(availableResults),
  };
}

export async function getMergedRuns(
  searchParams: URLSearchParams
): Promise<AiUsageEnvelope<AiUsageRunsData>> {
  const limit = clampNumber(searchParams.get('limit'), 20, 1, 100);
  const backendParams = new URLSearchParams(searchParams);
  backendParams.delete('limit');
  backendParams.set('page', '1');
  backendParams.set('pageSize', String(limit));

  const { availableResults, sources } = await fetchAllSources<{
    total: number;
    runs: AiUsageRunsData['runs'];
  }>('runs', backendParams);

  return {
    sources,
    data: mergeRunsPayloads(availableResults, limit),
  };
}

export async function getMergedPrompts(
  searchParams: URLSearchParams
): Promise<AiUsageEnvelope<AiUsagePromptsData>> {
  const limit = clampNumber(searchParams.get('limit'), 20, 1, 100);
  const backendParams = new URLSearchParams(searchParams);
  backendParams.delete('limit');
  backendParams.set('page', '1');
  backendParams.set('pageSize', String(limit));

  const { availableResults, sources } = await fetchAllSources<{
    total: number;
    promptVersions: AiUsagePromptsData['promptVersions'];
  }>('prompts', backendParams);

  return {
    sources,
    data: mergePromptPayloads(availableResults, limit),
  };
}

export async function getMergedComparison(
  searchParams: URLSearchParams
): Promise<AiUsageEnvelope<AiUsageComparisonData>> {
  const { availableResults, sources } = await fetchAllSources<AiUsageComparisonData>('compare', searchParams);

  return {
    sources,
    data: mergeComparisonPayloads(availableResults),
  };
}

async function fetchAllSources<T>(
  endpoint: 'overview' | 'runs' | 'prompts' | 'compare',
  searchParams: URLSearchParams
): Promise<{
  availableResults: Array<{ sourceSystem: AiUsageSourceKey; data: T }>;
  sources: AiUsageSourceState[];
}> {
  const adminSecret = getAdminSecret();
  const sourceConfigs = getSourceConfigs();

  const settled = await Promise.all(
    sourceConfigs.map((source) => fetchSource<T>(source, endpoint, searchParams, adminSecret))
  );

  const availableResults = settled
    .filter((entry): entry is { sourceSystem: AiUsageSourceKey; state: AiUsageSourceState; data: T } => Boolean(entry.data))
    .map((entry) => ({
      sourceSystem: entry.sourceSystem,
      data: entry.data as T,
    }));

  if (availableResults.length === 0) {
    const primaryError = settled.find((entry) => !entry.state.available)?.state.error;
    throw new HttpError(primaryError ?? 'No se pudo consultar ninguna fuente de observabilidad IA.', 502);
  }

  return {
    availableResults,
    sources: settled.map((entry) => entry.state),
  };
}

async function fetchSource<T>(
  source: SourceConfig,
  endpoint: 'overview' | 'runs' | 'prompts' | 'compare',
  searchParams: URLSearchParams,
  adminSecret: string
): Promise<{
  sourceSystem: AiUsageSourceKey;
  state: AiUsageSourceState;
  data?: T;
}> {
  if (!source.baseUrl) {
    return {
      sourceSystem: source.key,
      state: {
        key: source.key,
        label: source.label,
        available: false,
        error: 'URL no configurada',
      },
    };
  }

  const url = new URL(`${source.baseUrl}/api/admin/ai-usage/${endpoint}`);
  url.search = searchParams.toString();

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-admin-secret': adminSecret,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await safeReadJson(response);
      const message =
        typeof body?.error === 'string'
          ? body.error
          : typeof body?.message === 'string'
            ? body.message
            : `HTTP ${response.status}`;

      return {
        sourceSystem: source.key,
        state: {
          key: source.key,
          label: source.label,
          available: false,
          error: message,
        },
      };
    }

    const parsed = (await response.json()) as { data: T };

    return {
      sourceSystem: source.key,
      state: {
        key: source.key,
        label: source.label,
        available: true,
      },
      data: parsed.data,
    };
  } catch (error) {
    return {
      sourceSystem: source.key,
      state: {
        key: source.key,
        label: source.label,
        available: false,
        error: error instanceof Error ? error.message : 'Error de red',
      },
    };
  }
}

async function safeReadJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function clampNumber(
  rawValue: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : fallback;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

export function toApiErrorResponse(error: unknown): Response {
  const status = error instanceof HttpError ? error.status : 500;
  const message =
    error instanceof Error
      ? error.message
      : 'Error interno al consultar la observabilidad IA.';

  return Response.json(
    {
      success: false,
      error: message,
    },
    { status }
  );
}
