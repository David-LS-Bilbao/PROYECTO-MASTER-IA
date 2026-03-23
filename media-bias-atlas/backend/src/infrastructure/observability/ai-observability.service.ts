import { randomUUID } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { createModuleLogger } from '../logger/logger';

const logger = createModuleLogger('AIObservabilityService');

export const AiRunStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  TIMEOUT: 'TIMEOUT',
  CANCELLED: 'CANCELLED',
} as const;

export type AiRunStatus = (typeof AiRunStatus)[keyof typeof AiRunStatus];

const RUN_RETENTION_DAYS = 180;
const DEBUG_PAYLOAD_RETENTION_DAYS = 30;
const MAX_METADATA_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 500;
const REDACTED_VALUE = '[REDACTED]';
const TRUNCATED_VALUE_SUFFIX = '...[TRUNCATED]';

const SENSITIVE_PAYLOAD_KEY_PATTERN =
  /(prompt|response|content|article|message|body|raw|full_text|user_input|completion_text|interpolated)/i;

interface OverviewTotalsRow {
  runs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedCostMicrosEur: bigint | null;
  avgLatencyMs: number | null;
}

interface RecentErrorRow {
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
}

interface ListedRunRow {
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
  estimatedCostMicrosEur: bigint | null;
  latencyMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  promptVersionId: string | null;
  createdAt: Date;
  completedAt: Date | null;
  metadataJson: Prisma.JsonValue | null;
}

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
    const runId = randomUUID();
    const metadataJson = this.sanitizeJsonObject(input.metadataJson);
    const debugPayloadJson = this.sanitizeJsonObject(input.debugPayloadJson);
    const debugPayloadExpiresAt = debugPayloadJson
      ? this.addDays(new Date(), DEBUG_PAYLOAD_RETENTION_DAYS)
      : null;

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "ai_operation_runs" (
          "id",
          "module",
          "operation_key",
          "provider",
          "model",
          "status",
          "prompt_version_id",
          "request_id",
          "correlation_id",
          "endpoint",
          "user_id",
          "entity_type",
          "entity_id",
          "metadata_json",
          "debug_payload_json",
          "debug_payload_expires_at",
          "created_at",
          "updated_at"
        ) VALUES (
          ${runId},
          ${input.module},
          ${input.operationKey},
          ${input.provider ?? null},
          ${input.model ?? null},
          ${input.status ?? AiRunStatus.PENDING},
          ${input.promptVersionId ?? null},
          ${input.requestId},
          ${input.correlationId},
          ${input.endpoint ?? null},
          ${input.userId ?? null},
          ${input.entityType ?? null},
          ${input.entityId ?? null},
          ${this.jsonSql(metadataJson)},
          ${this.jsonSql(debugPayloadJson)},
          ${debugPayloadExpiresAt},
          NOW(),
          NOW()
        )
      `
    );

    return runId;
  }

  async completeRun(input: CompleteAiOperationRunInput): Promise<void> {
    try {
      const metadataJson = this.sanitizeJsonObject(input.metadataJson);
      const debugPayloadJson = this.sanitizeJsonObject(input.debugPayloadJson);
      const debugPayloadExpiresAt = debugPayloadJson
        ? this.addDays(new Date(), DEBUG_PAYLOAD_RETENTION_DAYS)
        : null;

      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "ai_operation_runs"
          SET
            "status" = ${input.status ?? AiRunStatus.COMPLETED},
            "prompt_tokens" = ${this.normalizeInteger(input.promptTokens)},
            "completion_tokens" = ${this.normalizeInteger(input.completionTokens)},
            "total_tokens" = ${this.normalizeInteger(input.totalTokens)},
            "estimated_cost_micros_eur" = ${input.estimatedCostMicrosEur ?? null},
            "latency_ms" = ${this.normalizeInteger(input.latencyMs)},
            "metadata_json" = ${this.jsonSql(metadataJson)},
            "debug_payload_json" = ${this.jsonSql(debugPayloadJson)},
            "debug_payload_expires_at" = ${debugPayloadExpiresAt},
            "completed_at" = ${input.completedAt ?? new Date()},
            "updated_at" = NOW()
          WHERE "id" = ${input.runId}
        `
      );
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
      const debugPayloadExpiresAt = debugPayloadJson
        ? this.addDays(new Date(), DEBUG_PAYLOAD_RETENTION_DAYS)
        : null;

      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "ai_operation_runs"
          SET
            "status" = ${input.status ?? AiRunStatus.FAILED},
            "error_code" = ${this.sanitizeShortText(input.errorCode) ?? null},
            "error_message" = ${this.sanitizeErrorMessage(input.errorMessage) ?? null},
            "prompt_tokens" = ${this.normalizeInteger(input.promptTokens)},
            "completion_tokens" = ${this.normalizeInteger(input.completionTokens)},
            "total_tokens" = ${this.normalizeInteger(input.totalTokens)},
            "estimated_cost_micros_eur" = ${input.estimatedCostMicrosEur ?? null},
            "latency_ms" = ${this.normalizeInteger(input.latencyMs)},
            "metadata_json" = ${this.jsonSql(metadataJson)},
            "debug_payload_json" = ${this.jsonSql(debugPayloadJson)},
            "debug_payload_expires_at" = ${debugPayloadExpiresAt},
            "completed_at" = ${input.completedAt ?? new Date()},
            "updated_at" = NOW()
          WHERE "id" = ${input.runId}
        `
      );
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
    recentErrors: Array<RecentErrorRow>;
  }> {
    const whereSql = this.buildRunsWhereSql(filters);

    const [
      totals,
      byStatus,
      byModule,
      byOperation,
      byProviderModel,
      recentErrors,
    ] = await Promise.all([
      this.prisma.$queryRaw<OverviewTotalsRow[]>(Prisma.sql`
        SELECT
          COUNT(*)::int AS "runs",
          COALESCE(SUM("prompt_tokens"), 0)::int AS "promptTokens",
          COALESCE(SUM("completion_tokens"), 0)::int AS "completionTokens",
          COALESCE(SUM("total_tokens"), 0)::int AS "totalTokens",
          COALESCE(SUM("estimated_cost_micros_eur"), 0)::bigint AS "estimatedCostMicrosEur",
          ROUND(AVG("latency_ms"))::int AS "avgLatencyMs"
        FROM "ai_operation_runs"
        ${whereSql}
      `),
      this.prisma.$queryRaw<Array<{ status: AiRunStatus; runs: number }>>(Prisma.sql`
        SELECT
          "status" AS "status",
          COUNT(*)::int AS "runs"
        FROM "ai_operation_runs"
        ${whereSql}
        GROUP BY "status"
      `),
      this.prisma.$queryRaw<Array<{ module: string; runs: number; totalTokens: number | null; estimatedCostMicrosEur: bigint | null }>>(Prisma.sql`
        SELECT
          "module" AS "module",
          COUNT(*)::int AS "runs",
          COALESCE(SUM("total_tokens"), 0)::int AS "totalTokens",
          COALESCE(SUM("estimated_cost_micros_eur"), 0)::bigint AS "estimatedCostMicrosEur"
        FROM "ai_operation_runs"
        ${whereSql}
        GROUP BY "module"
      `),
      this.prisma.$queryRaw<Array<{ operationKey: string; runs: number; totalTokens: number | null; estimatedCostMicrosEur: bigint | null }>>(Prisma.sql`
        SELECT
          "operation_key" AS "operationKey",
          COUNT(*)::int AS "runs",
          COALESCE(SUM("total_tokens"), 0)::int AS "totalTokens",
          COALESCE(SUM("estimated_cost_micros_eur"), 0)::bigint AS "estimatedCostMicrosEur"
        FROM "ai_operation_runs"
        ${whereSql}
        GROUP BY "operation_key"
      `),
      this.prisma.$queryRaw<Array<{ provider: string | null; model: string | null; runs: number; totalTokens: number | null; estimatedCostMicrosEur: bigint | null }>>(Prisma.sql`
        SELECT
          "provider" AS "provider",
          "model" AS "model",
          COUNT(*)::int AS "runs",
          COALESCE(SUM("total_tokens"), 0)::int AS "totalTokens",
          COALESCE(SUM("estimated_cost_micros_eur"), 0)::bigint AS "estimatedCostMicrosEur"
        FROM "ai_operation_runs"
        ${whereSql}
        GROUP BY "provider", "model"
      `),
      this.prisma.$queryRaw<RecentErrorRow[]>(Prisma.sql`
        SELECT
          "id" AS "id",
          "module" AS "module",
          "operation_key" AS "operationKey",
          "status" AS "status",
          "provider" AS "provider",
          "model" AS "model",
          "request_id" AS "requestId",
          "correlation_id" AS "correlationId",
          "error_code" AS "errorCode",
          "error_message" AS "errorMessage",
          "created_at" AS "createdAt"
        FROM "ai_operation_runs"
        ${this.buildRunsWhereSql(
          {
            ...filters,
          },
          undefined,
          Prisma.sql`"status" IN (${Prisma.join(
            [AiRunStatus.FAILED, AiRunStatus.TIMEOUT, AiRunStatus.CANCELLED]
          )})`
        )}
        ORDER BY "created_at" DESC
        LIMIT 10
      `),
    ]);

    const totalsRow = totals[0] ?? {
      runs: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostMicrosEur: 0n,
      avgLatencyMs: null,
    };

    return {
      filters: {
        from: filters.from ? filters.from.toISOString() : null,
        to: filters.to ? filters.to.toISOString() : null,
      },
      totals: {
        runs: totalsRow.runs,
        promptTokens: totalsRow.promptTokens ?? 0,
        completionTokens: totalsRow.completionTokens ?? 0,
        totalTokens: totalsRow.totalTokens ?? 0,
        estimatedCostMicrosEur: (totalsRow.estimatedCostMicrosEur ?? 0n).toString(),
        avgLatencyMs: totalsRow.avgLatencyMs,
      },
      byStatus,
      byModule: byModule.map((entry) => ({
        module: entry.module,
        runs: entry.runs,
        totalTokens: entry.totalTokens ?? 0,
        estimatedCostMicrosEur: (entry.estimatedCostMicrosEur ?? 0n).toString(),
      })),
      byOperation: byOperation.map((entry) => ({
        operationKey: entry.operationKey,
        runs: entry.runs,
        totalTokens: entry.totalTokens ?? 0,
        estimatedCostMicrosEur: (entry.estimatedCostMicrosEur ?? 0n).toString(),
      })),
      byProviderModel: byProviderModel.map((entry) => ({
        provider: entry.provider,
        model: entry.model,
        runs: entry.runs,
        totalTokens: entry.totalTokens ?? 0,
        estimatedCostMicrosEur: (entry.estimatedCostMicrosEur ?? 0n).toString(),
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
    const whereSql = this.buildRunsWhereSql(input);

    const [countRows, runs] = await Promise.all([
      this.prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS "total"
        FROM "ai_operation_runs"
        ${whereSql}
      `),
      this.prisma.$queryRaw<ListedRunRow[]>(Prisma.sql`
        SELECT
          "id" AS "id",
          "module" AS "module",
          "operation_key" AS "operationKey",
          "provider" AS "provider",
          "model" AS "model",
          "status" AS "status",
          "request_id" AS "requestId",
          "correlation_id" AS "correlationId",
          "endpoint" AS "endpoint",
          "user_id" AS "userId",
          "entity_type" AS "entityType",
          "entity_id" AS "entityId",
          "prompt_tokens" AS "promptTokens",
          "completion_tokens" AS "completionTokens",
          "total_tokens" AS "totalTokens",
          "estimated_cost_micros_eur" AS "estimatedCostMicrosEur",
          "latency_ms" AS "latencyMs",
          "error_code" AS "errorCode",
          "error_message" AS "errorMessage",
          "prompt_version_id" AS "promptVersionId",
          "created_at" AS "createdAt",
          "completed_at" AS "completedAt",
          "metadata_json" AS "metadataJson"
        FROM "ai_operation_runs"
        ${whereSql}
        ORDER BY "created_at" DESC
        OFFSET ${skip}
        LIMIT ${pageSize}
      `),
    ]);

    return {
      page,
      pageSize,
      total: countRows[0]?.total ?? 0,
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
      this.prisma.$executeRaw(
        Prisma.sql`
          DELETE FROM "ai_operation_runs"
          WHERE "created_at" < ${runRetentionCutoff}
        `
      ),
      this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "ai_operation_runs"
          SET
            "debug_payload_json" = NULL,
            "debug_payload_expires_at" = NULL,
            "updated_at" = NOW()
          WHERE "debug_payload_expires_at" < ${referenceDate}
        `
      ),
    ]);

    return {
      deletedRuns: Number(deletedRuns),
      scrubbedDebugPayloads: Number(scrubbedDebugPayloads),
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

  private buildRunsWhereSql(
    filters: AiRunFilters,
    alias?: string,
    extraCondition?: Prisma.Sql
  ): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];

    if (filters.module) {
      conditions.push(Prisma.sql`${this.columnSql('module', alias)} = ${filters.module}`);
    }
    if (filters.operationKey) {
      conditions.push(
        Prisma.sql`${this.columnSql('operation_key', alias)} = ${filters.operationKey}`
      );
    }
    if (filters.provider) {
      conditions.push(Prisma.sql`${this.columnSql('provider', alias)} = ${filters.provider}`);
    }
    if (filters.model) {
      conditions.push(Prisma.sql`${this.columnSql('model', alias)} = ${filters.model}`);
    }
    if (filters.status) {
      conditions.push(Prisma.sql`${this.columnSql('status', alias)} = ${filters.status}`);
    }
    if (filters.requestId) {
      conditions.push(
        Prisma.sql`${this.columnSql('request_id', alias)} = ${filters.requestId}`
      );
    }
    if (filters.correlationId) {
      conditions.push(
        Prisma.sql`${this.columnSql('correlation_id', alias)} = ${filters.correlationId}`
      );
    }
    if (filters.entityType) {
      conditions.push(
        Prisma.sql`${this.columnSql('entity_type', alias)} = ${filters.entityType}`
      );
    }
    if (filters.entityId) {
      conditions.push(
        Prisma.sql`${this.columnSql('entity_id', alias)} = ${filters.entityId}`
      );
    }
    if (filters.from) {
      conditions.push(
        Prisma.sql`${this.columnSql('created_at', alias)} >= ${filters.from}`
      );
    }
    if (filters.to) {
      conditions.push(Prisma.sql`${this.columnSql('created_at', alias)} <= ${filters.to}`);
    }
    if (extraCondition) {
      conditions.push(extraCondition);
    }

    if (conditions.length === 0) {
      return Prisma.empty;
    }

    return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
  }

  private columnSql(column: string, alias?: string): Prisma.Sql {
    return Prisma.raw(`${alias ? `${alias}.` : ''}"${column}"`);
  }

  private jsonSql(
    value: Prisma.InputJsonValue | undefined | null
  ): Prisma.Sql {
    if (value === undefined || value === null) {
      return Prisma.sql`NULL`;
    }

    return Prisma.sql`${JSON.stringify(value)}::jsonb`;
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
