export interface MbaAiObservabilityContext {
  requestId?: string;
  correlationId?: string;
  endpoint?: string | null;
  userId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface NormalizedMbaAiObservabilityContext {
  requestId: string;
  correlationId: string;
  endpoint?: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export function normalizeMbaAiObservabilityContext(
  context: MbaAiObservabilityContext | undefined,
  defaults: {
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  } = {}
): NormalizedMbaAiObservabilityContext {
  const requestId = normalizeObservabilityId(context?.requestId);
  const correlationId = normalizeObservabilityText(context?.correlationId, 120) ?? requestId;

  return {
    requestId,
    correlationId,
    endpoint: normalizeObservabilityText(context?.endpoint ?? undefined, 120),
    userId: normalizeObservabilityText(context?.userId ?? undefined, 80),
    entityType:
      normalizeObservabilityText(context?.entityType ?? undefined, 80) ??
      normalizeObservabilityText(defaults.entityType, 80),
    entityId:
      normalizeObservabilityText(context?.entityId ?? undefined, 120) ??
      normalizeObservabilityText(defaults.entityId, 120),
    metadata: normalizeMetadata(context?.metadata, defaults.metadata),
  };
}

export function createGeneratedObservabilityId(prefix: string = 'ai'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeObservabilityId(value: string | undefined): string {
  const normalized = normalizeObservabilityText(value, 120);
  if (normalized) {
    return normalized;
  }

  return createGeneratedObservabilityId('req');
}

function normalizeObservabilityText(
  value: string | null | undefined,
  maxLength: number
): string | undefined {
  if (!value || typeof value !== 'string') {
    return undefined;
  }

  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return undefined;
  }

  return compact.slice(0, maxLength);
}

function normalizeMetadata(
  contextMetadata: Record<string, unknown> | undefined,
  defaultMetadata: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const merged = {
    ...(defaultMetadata ?? {}),
    ...(contextMetadata ?? {}),
  };

  return Object.keys(merged).length > 0 ? merged : undefined;
}
