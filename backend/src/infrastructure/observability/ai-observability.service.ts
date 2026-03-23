import { AiRunStatus, Prisma, PrismaClient } from '@prisma/client';
import { createModuleLogger } from '../logger/logger';

const logger = createModuleLogger('AIObservabilityService');

const RUN_RETENTION_DAYS = 180;
const DEBUG_PAYLOAD_RETENTION_DAYS = 30;
const MAX_METADATA_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 500;
const REDACTED_VALUE = '[REDACTED]';
const TRUNCATED_VALUE_SUFFIX = '...[TRUNCATED]';

const SENSITIVE_PAYLOAD_KEY_PATTERN =
  /(prompt|response|content|article|message|body|raw|full_text|user_input|completion_text|interpolated)/i;

export interface StartAiOperationRunInput {
  module: string;
  operationKey: string;
  provider?: string | null;
  model?: string | null;
  status?: AiRunStatus;
  promptVersionId?: string | null;
  requestId: string;
  correlationId: string;
  endpoint?: string | null;
  userId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadataJson?: Record<string, unknown>;
  debugPayloadJson?: Record<string, unknown>;
}

export interface CompleteAiOperationRunInput {
  runId: string;
  status?: AiRunStatus;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostMicrosEur?: bigint | null;
  latencyMs?: number | null;
  metadataJson?: Record<string, unknown>;
  debugPayloadJson?: Record<string, unknown>;
  completedAt?: Date;
}

export interface FailAiOperationRunInput {
  runId: string;
  status?: AiRunStatus;
  errorCode?: string;
  errorMessage?: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostMicrosEur?: bigint | null;
  latencyMs?: number | null;
  metadataJson?: Record<string, unknown>;
  debugPayloadJson?: Record<string, unknown>;
  completedAt?: Date;
}

export interface AiRunFilters {
  module?: string;
  operationKey?: string;
  provider?: string;
  model?: string;
  status?: AiRunStatus;
  requestId?: string;
  correlationId?: string;
  entityType?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
}

export interface ListAiRunsInput extends AiRunFilters {
  page?: number;
  pageSize?: number;
}

export class AIObservabilityService {
  constructor(private readonly prisma: PrismaClient) {}

  async startRun(input: StartAiOperationRunInput): Promise<string> {
    const metadataJson = this.sanitizeJsonObject(input.metadataJson);
    const debugPayloadJson = this.sanitizeJsonObject(input.debugPayloadJson);

    const createdRun = await this.prisma.aiOperationRun.create({
      data: {
        module: input.module,
        operationKey: input.operationKey,
        provider: input.provider ?? null,
        model: input.model ?? null,
        status: input.status ?? AiRunStatus.PENDING,
        promptVersionId: input.promptVersionId ?? null,
        requestId: input.requestId,
        correlationId: input.correlationId,
        endpoint: input.endpoint ?? null,
        userId: input.userId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadataJson,
        debugPayloadJson,
        debugPayloadExpiresAt: debugPayloadJson
          ? this.addDays(new Date(), DEBUG_PAYLOAD_RETENTION_DAYS)
          : null,
      },
      select: {
        id: true,
      },
    });

    return createdRun.id;
  }

  async completeRun(input: CompleteAiOperationRunInput): Promise<void> {
    try {
      const metadataJson = this.sanitizeJsonObject(input.metadataJson);
      const debugPayloadJson = this.sanitizeJsonObject(input.debugPayloadJson);

      await this.prisma.aiOperationRun.update({
        where: { id: input.runId },
        data: {
          status: input.status ?? AiRunStatus.COMPLETED,
          promptTokens: this.normalizeInteger(input.promptTokens),
          completionTokens: this.normalizeInteger(input.completionTokens),
          totalTokens: this.normalizeInteger(input.totalTokens),
          estimatedCostMicrosEur: input.estimatedCostMicrosEur ?? null,
          latencyMs: this.normalizeInteger(input.latencyMs),
          metadataJson,
          debugPayloadJson,
          debugPayloadExpiresAt: debugPayloadJson
            ? this.addDays(new Date(), DEBUG_PAYLOAD_RETENTION_DAYS)
            : undefined,
          completedAt: input.completedAt ?? new Date(),
        },
      });
    } catch (error) {
      logger.error(
        { runId: input.runId, error: error instanceof Error ? error.message : String(error) },
        'Failed to complete AI operation run'
      );
    }
  }

  async failRun(input: FailAiOperationRunInput): Promise<void> {
    try {
      const metadataJson = this.sanitizeJsonObject(input.metadataJson);
      const debugPayloadJson = this.sanitizeJsonObject(input.debugPayloadJson);

      await this.prisma.aiOperationRun.update({
        where: { id: input.runId },
        data: {
          status: input.status ?? AiRunStatus.FAILED,
          errorCode: this.sanitizeShortText(input.errorCode),
          errorMessage: this.sanitizeErrorMessage(input.errorMessage),
          promptTokens: this.normalizeInteger(input.promptTokens),
          completionTokens: this.normalizeInteger(input.completionTokens),
          totalTokens: this.normalizeInteger(input.totalTokens),
          estimatedCostMicrosEur: input.estimatedCostMicrosEur ?? null,
          latencyMs: this.normalizeInteger(input.latencyMs),
          metadataJson,
          debugPayloadJson,
          debugPayloadExpiresAt: debugPayloadJson
            ? this.addDays(new Date(), DEBUG_PAYLOAD_RETENTION_DAYS)
            : undefined,
          completedAt: input.completedAt ?? new Date(),
        },
      });
    } catch (error) {
      logger.error(
        { runId: input.runId, error: error instanceof Error ? error.message : String(error) },
        'Failed to mark AI operation run as failed'
      );
    }
  }

  async getOverview(filters: AiRunFilters = {}): Promise<{
    filters: { from: string | null; to: string | null };
    totals: {
      runs: number;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      estimatedCostMicrosEur: string;
      avgLatencyMs: number | null;
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
    recentErrors: Array<{
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
      createdAt: Date;
    }>;
  }> {
    const where = this.buildRunsWhere(filters);

    const [totals, byStatus, byModule, byOperation, byProviderModel, recentErrors] =
      await Promise.all([
      this.prisma.aiOperationRun.aggregate({
        where,
        _count: { _all: true },
        _sum: {
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          estimatedCostMicrosEur: true,
        },
        _avg: {
          latencyMs: true,
        },
      }),
      this.prisma.aiOperationRun.groupBy({
        by: ['status'],
        where,
        _count: {
          _all: true,
        },
      }),
      this.prisma.aiOperationRun.groupBy({
        by: ['module'],
        where,
        _count: {
          _all: true,
        },
        _sum: {
          totalTokens: true,
          estimatedCostMicrosEur: true,
        },
      }),
      this.prisma.aiOperationRun.groupBy({
        by: ['operationKey'],
        where,
        _count: {
          _all: true,
        },
        _sum: {
          totalTokens: true,
          estimatedCostMicrosEur: true,
        },
      }),
      this.prisma.aiOperationRun.groupBy({
        by: ['provider', 'model'],
        where,
        _count: {
          _all: true,
        },
        _sum: {
          totalTokens: true,
          estimatedCostMicrosEur: true,
        },
      }),
      this.prisma.aiOperationRun.findMany({
        where: {
          ...where,
          status: {
            in: [AiRunStatus.FAILED, AiRunStatus.TIMEOUT, AiRunStatus.CANCELLED],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          module: true,
          operationKey: true,
          status: true,
          provider: true,
          model: true,
          requestId: true,
          correlationId: true,
          errorCode: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      filters: {
        from: filters.from ? filters.from.toISOString() : null,
        to: filters.to ? filters.to.toISOString() : null,
      },
      totals: {
        runs: totals._count._all,
        promptTokens: totals._sum.promptTokens ?? 0,
        completionTokens: totals._sum.completionTokens ?? 0,
        totalTokens: totals._sum.totalTokens ?? 0,
        estimatedCostMicrosEur: (totals._sum.estimatedCostMicrosEur ?? 0n).toString(),
        avgLatencyMs:
          typeof totals._avg.latencyMs === 'number'
            ? Math.round(totals._avg.latencyMs)
            : null,
      },
      byStatus: byStatus.map((entry) => ({
        status: entry.status,
        runs: entry._count._all,
      })),
      byModule: byModule.map((entry) => ({
        module: entry.module,
        runs: entry._count._all,
        totalTokens: entry._sum.totalTokens ?? 0,
        estimatedCostMicrosEur: (entry._sum.estimatedCostMicrosEur ?? 0n).toString(),
      })),
      byOperation: byOperation.map((entry) => ({
        operationKey: entry.operationKey,
        runs: entry._count._all,
        totalTokens: entry._sum.totalTokens ?? 0,
        estimatedCostMicrosEur: (entry._sum.estimatedCostMicrosEur ?? 0n).toString(),
      })),
      byProviderModel: byProviderModel.map((entry) => ({
        provider: entry.provider,
        model: entry.model,
        runs: entry._count._all,
        totalTokens: entry._sum.totalTokens ?? 0,
        estimatedCostMicrosEur: (entry._sum.estimatedCostMicrosEur ?? 0n).toString(),
      })),
      recentErrors,
    };
  }

  async listRuns(input: ListAiRunsInput = {}): Promise<{
    page: number;
    pageSize: number;
    total: number;
    runs: Array<{
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
      createdAt: Date;
      completedAt: Date | null;
      metadataJson: Prisma.JsonValue | null;
    }>;
  }> {
    const page = input.page && input.page > 0 ? input.page : 1;
    const pageSize = input.pageSize && input.pageSize > 0 ? Math.min(input.pageSize, 100) : 20;
    const skip = (page - 1) * pageSize;
    const where = this.buildRunsWhere(input);

    const [total, runs] = await Promise.all([
      this.prisma.aiOperationRun.count({ where }),
      this.prisma.aiOperationRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          module: true,
          operationKey: true,
          provider: true,
          model: true,
          status: true,
          requestId: true,
          correlationId: true,
          endpoint: true,
          userId: true,
          entityType: true,
          entityId: true,
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          estimatedCostMicrosEur: true,
          latencyMs: true,
          errorCode: true,
          errorMessage: true,
          promptVersionId: true,
          createdAt: true,
          completedAt: true,
          metadataJson: true,
        },
      }),
    ]);

    return {
      page,
      pageSize,
      total,
      runs: runs.map((run) => ({
        ...run,
        estimatedCostMicrosEur:
          run.estimatedCostMicrosEur !== null
            ? run.estimatedCostMicrosEur.toString()
            : null,
      })),
    };
  }

  async enforceRetentionPolicies(referenceDate: Date = new Date()): Promise<{
    deletedRuns: number;
    scrubbedDebugPayloads: number;
  }> {
    const runRetentionCutoff = this.addDays(referenceDate, -RUN_RETENTION_DAYS);

    const [deletedRuns, scrubbedDebugPayloads] = await this.prisma.$transaction([
      this.prisma.aiOperationRun.deleteMany({
        where: {
          createdAt: {
            lt: runRetentionCutoff,
          },
        },
      }),
      this.prisma.aiOperationRun.updateMany({
        where: {
          debugPayloadExpiresAt: {
            lt: referenceDate,
          },
        },
        data: {
          debugPayloadJson: Prisma.JsonNull,
          debugPayloadExpiresAt: null,
        },
      }),
    ]);

    return {
      deletedRuns: deletedRuns.count,
      scrubbedDebugPayloads: scrubbedDebugPayloads.count,
    };
  }

  getRetentionPolicy(): {
    runRetentionDays: number;
    debugPayloadRetentionDays: number;
  } {
    return {
      runRetentionDays: RUN_RETENTION_DAYS,
      debugPayloadRetentionDays: DEBUG_PAYLOAD_RETENTION_DAYS,
    };
  }

  private buildRunsWhere(filters: AiRunFilters): Prisma.AiOperationRunWhereInput {
    const createdAtFilter: Prisma.DateTimeFilter = {};

    if (filters.from) {
      createdAtFilter.gte = filters.from;
    }
    if (filters.to) {
      createdAtFilter.lte = filters.to;
    }

    return {
      module: filters.module,
      operationKey: filters.operationKey,
      provider: filters.provider,
      model: filters.model,
      status: filters.status,
      requestId: filters.requestId,
      correlationId: filters.correlationId,
      entityType: filters.entityType,
      entityId: filters.entityId,
      ...(filters.from || filters.to ? { createdAt: createdAtFilter } : {}),
    };
  }

  private sanitizeJsonObject(
    payload: Record<string, unknown> | undefined
  ): Prisma.InputJsonValue | undefined {
    if (!payload) {
      return undefined;
    }

    const sanitized = this.sanitizeJsonValue(payload, 0, undefined);
    if (
      sanitized !== null &&
      typeof sanitized === 'object' &&
      !Array.isArray(sanitized)
    ) {
      return sanitized;
    }

    return undefined;
  }

  private sanitizeJsonValue(
    value: unknown,
    depth: number,
    key: string | undefined
  ): Prisma.InputJsonValue {
    if (value === null) {
      return 'null';
    }

    if (depth >= MAX_METADATA_DEPTH) {
      return `${REDACTED_VALUE}:depth_limit`;
    }

    if (typeof value === 'string') {
      if (key && this.shouldRedactKey(key)) {
        return REDACTED_VALUE;
      }

      const compactValue = value.replace(/\s+/g, ' ').trim();
      if (compactValue.length > MAX_STRING_LENGTH) {
        return `${compactValue.slice(0, MAX_STRING_LENGTH)}${TRUNCATED_VALUE_SUFFIX}`;
      }
      return compactValue;
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return 0;
      }
      return value;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (Array.isArray(value)) {
      const sanitizedArray: Prisma.InputJsonValue[] = [];
      const limitedItems = value.slice(0, MAX_ARRAY_ITEMS);

      for (const entry of limitedItems) {
        sanitizedArray.push(this.sanitizeJsonValue(entry, depth + 1, key));
      }

      return sanitizedArray;
    }

    if (value && typeof value === 'object') {
      const sanitizedObject: Record<string, Prisma.InputJsonValue> = {};

      for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        if (nestedValue === undefined) {
          continue;
        }

        if (
          this.shouldRedactKey(nestedKey) &&
          (typeof nestedValue === 'string' ||
            Array.isArray(nestedValue) ||
            (nestedValue && typeof nestedValue === 'object'))
        ) {
          sanitizedObject[nestedKey] = REDACTED_VALUE;
          continue;
        }

        sanitizedObject[nestedKey] = this.sanitizeJsonValue(
          nestedValue,
          depth + 1,
          nestedKey
        );
      }

      return sanitizedObject as Prisma.InputJsonObject;
    }

    return String(value);
  }

  private shouldRedactKey(key: string): boolean {
    return SENSITIVE_PAYLOAD_KEY_PATTERN.test(key);
  }

  private sanitizeShortText(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    const compactValue = value.replace(/\s+/g, ' ').trim();
    if (!compactValue) {
      return undefined;
    }

    return compactValue.length > 120
      ? `${compactValue.slice(0, 120)}${TRUNCATED_VALUE_SUFFIX}`
      : compactValue;
  }

  private sanitizeErrorMessage(errorMessage: string | undefined): string | undefined {
    if (!errorMessage) {
      return undefined;
    }

    const compactMessage = errorMessage.replace(/\s+/g, ' ').trim();
    if (!compactMessage) {
      return undefined;
    }

    if (compactMessage.length > 600) {
      return `${compactMessage.slice(0, 600)}${TRUNCATED_VALUE_SUFFIX}`;
    }

    return compactMessage;
  }

  private normalizeInteger(value: number | null | undefined): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    const normalized = Math.floor(value);
    return normalized >= 0 ? normalized : null;
  }

  private addDays(baseDate: Date, days: number): Date {
    return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
  }
}
