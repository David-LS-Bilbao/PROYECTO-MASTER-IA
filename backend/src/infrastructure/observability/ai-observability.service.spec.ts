import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AiRunStatus, Prisma } from '@prisma/client';
import { AIObservabilityService } from './ai-observability.service';

describe('AIObservabilityService', () => {
  const prismaMock = {
    aiOperationRun: {
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  } as any;

  let service: AIObservabilityService;

  beforeEach(() => {
    Object.values(prismaMock.aiOperationRun).forEach((mockFn: any) => mockFn.mockReset());
    prismaMock.$transaction.mockReset();
    service = new AIObservabilityService(prismaMock);
  });

  it('creates a run and redacts sensitive metadata/debug payload keys', async () => {
    prismaMock.aiOperationRun.create.mockResolvedValue({ id: 'run-1' });

    const runId = await service.startRun({
      module: 'verity',
      operationKey: 'article_analysis',
      provider: 'google',
      model: 'gemini-2.5-flash',
      requestId: 'req-1',
      correlationId: 'corr-1',
      metadataJson: {
        promptKey: 'ANALYSIS_PROMPT',
        content: 'Texto sensible',
        safeValue: 'ok',
      },
      debugPayloadJson: {
        response: 'Respuesta completa sensible',
      },
    });

    expect(runId).toBe('run-1');
    expect(prismaMock.aiOperationRun.create).toHaveBeenCalledTimes(1);
    const createCall = prismaMock.aiOperationRun.create.mock.calls[0][0];
    const metadataJson = createCall.data.metadataJson as Record<string, unknown>;
    const debugPayloadJson = createCall.data.debugPayloadJson as Record<string, unknown>;

    expect(metadataJson.content).toBe('[REDACTED]');
    expect(metadataJson.safeValue).toBe('ok');
    expect(debugPayloadJson.response).toBe('[REDACTED]');
    expect(createCall.data.debugPayloadExpiresAt).toBeInstanceOf(Date);
  });

  it('marks failed run with safe error payload', async () => {
    prismaMock.aiOperationRun.update.mockResolvedValue({});

    await service.failRun({
      runId: 'run-2',
      status: AiRunStatus.TIMEOUT,
      errorCode: '504_TIMEOUT',
      errorMessage: 'Gateway timeout '.repeat(80),
    });

    expect(prismaMock.aiOperationRun.update).toHaveBeenCalledTimes(1);
    const updateCall = prismaMock.aiOperationRun.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe(AiRunStatus.TIMEOUT);
    expect((updateCall.data.errorMessage as string).length).toBeLessThanOrEqual(615);
  });

  it('enforces retention by deleting old runs and scrubbing expired debug payloads', async () => {
    prismaMock.$transaction.mockResolvedValue([
      { count: 5 },
      { count: 3 },
    ]);

    const result = await service.enforceRetentionPolicies(new Date('2026-03-21T12:00:00.000Z'));

    expect(result).toEqual({
      deletedRuns: 5,
      scrubbedDebugPayloads: 3,
    });
    const updateManyCall = prismaMock.aiOperationRun.updateMany.mock.calls[0][0];
    expect(updateManyCall.data.debugPayloadJson).toBe(Prisma.JsonNull);
  });
});
