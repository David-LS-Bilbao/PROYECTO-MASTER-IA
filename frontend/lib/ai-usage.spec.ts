import { describe, expect, it } from 'vitest';
import {
  formatMicrosEur,
  mergeComparisonPayloads,
  mergeOverviewPayloads,
  mergeRunsPayloads,
} from '@/lib/ai-usage';

describe('ai-usage helpers', () => {
  it('formats micros in EUR legibly', () => {
    expect(formatMicrosEur('1234567')).toBe('1,2345 €');
    expect(formatMicrosEur('45')).toBe('0,000045 €');
    expect(formatMicrosEur(null)).toBe('Sin datos');
  });

  it('merges overview data from multiple sources', () => {
    const merged = mergeOverviewPayloads([
      {
        sourceSystem: 'verity',
        data: {
          filters: { from: null, to: null },
          totals: {
            runs: 2,
            promptTokens: 10,
            completionTokens: 6,
            totalTokens: 16,
            estimatedCostMicrosEur: '200000',
            avgLatencyMs: 100,
            tokenizedRuns: 2,
            costedRuns: 2,
            latencyRuns: 2,
          },
          byStatus: [{ status: 'COMPLETED', runs: 2 }],
          byModule: [{ module: 'verity', runs: 2, totalTokens: 16, estimatedCostMicrosEur: '200000' }],
          byOperation: [{ operationKey: 'chat_general', runs: 2, totalTokens: 16, estimatedCostMicrosEur: '200000' }],
          byProviderModel: [{ provider: 'google', model: 'gemini-2.5-flash', runs: 2, totalTokens: 16, estimatedCostMicrosEur: '200000' }],
          recentErrors: [],
        },
      },
      {
        sourceSystem: 'mba',
        data: {
          filters: { from: null, to: null },
          totals: {
            runs: 1,
            promptTokens: 4,
            completionTokens: 2,
            totalTokens: 6,
            estimatedCostMicrosEur: '50000',
            avgLatencyMs: 400,
            tokenizedRuns: 1,
            costedRuns: 1,
            latencyRuns: 1,
          },
          byStatus: [{ status: 'FAILED', runs: 1 }],
          byModule: [{ module: 'media-bias-atlas', runs: 1, totalTokens: 6, estimatedCostMicrosEur: '50000' }],
          byOperation: [{ operationKey: 'article_bias_analysis', runs: 1, totalTokens: 6, estimatedCostMicrosEur: '50000' }],
          byProviderModel: [{ provider: 'openai-compatible', model: 'gpt-4.1-mini', runs: 1, totalTokens: 6, estimatedCostMicrosEur: '50000' }],
          recentErrors: [],
        },
      },
    ]);

    expect(merged.totals.runs).toBe(3);
    expect(merged.totals.totalTokens).toBe(22);
    expect(merged.totals.estimatedCostMicrosEur).toBe('250000');
    expect(merged.totals.avgLatencyMs).toBe(200);
  });

  it('merges top runs sorted by date', () => {
    const merged = mergeRunsPayloads(
      [
        {
          sourceSystem: 'verity',
          data: {
            total: 1,
            runs: [
              {
                id: 'run-1',
                module: 'verity',
                operationKey: 'chat_general',
                provider: 'google',
                model: 'gemini',
                status: 'COMPLETED',
                requestId: 'req-1',
                correlationId: 'corr-1',
                endpoint: null,
                userId: null,
                entityType: null,
                entityId: null,
                promptTokens: 10,
                completionTokens: 5,
                totalTokens: 15,
                estimatedCostMicrosEur: '1000',
                latencyMs: 50,
                errorCode: null,
                errorMessage: null,
                promptVersionId: null,
                createdAt: '2026-03-23T10:00:00.000Z',
                completedAt: '2026-03-23T10:00:01.000Z',
                metadataJson: {},
                promptVersion: null,
              },
            ],
          },
        },
        {
          sourceSystem: 'mba',
          data: {
            total: 1,
            runs: [
              {
                id: 'run-2',
                module: 'media-bias-atlas',
                operationKey: 'article_bias_analysis',
                provider: 'google',
                model: 'gemini',
                status: 'COMPLETED',
                requestId: 'req-2',
                correlationId: 'corr-2',
                endpoint: null,
                userId: null,
                entityType: null,
                entityId: null,
                promptTokens: null,
                completionTokens: null,
                totalTokens: null,
                estimatedCostMicrosEur: null,
                latencyMs: 75,
                errorCode: null,
                errorMessage: null,
                promptVersionId: null,
                createdAt: '2026-03-23T11:00:00.000Z',
                completedAt: '2026-03-23T11:00:01.000Z',
                metadataJson: {},
                promptVersion: null,
              },
            ],
          },
        },
      ],
      20
    );

    expect(merged.total).toBe(2);
    expect(merged.runs[0].id).toBe('run-2');
    expect(merged.runs[0].sourceSystem).toBe('mba');
  });

  it('merges comparison metrics keeping averages coherent', () => {
    const merged = mergeComparisonPayloads([
      {
        sourceSystem: 'verity',
        data: {
          filters: { from: null, to: null },
          byModule: [
            {
              module: 'verity',
              runs: 2,
              errorRuns: 0,
              tokenizedRuns: 2,
              costedRuns: 2,
              latencyRuns: 2,
              totalTokens: 20,
              estimatedCostMicrosEur: '2000',
              totalLatencyMs: '200',
              avgTokens: 10,
              avgCostMicrosEur: '1000',
              avgLatencyMs: 100,
              errorRate: 0,
            },
          ],
          byOperation: [],
          byProvider: [],
          byModel: [],
        },
      },
      {
        sourceSystem: 'mba',
        data: {
          filters: { from: null, to: null },
          byModule: [
            {
              module: 'verity',
              runs: 1,
              errorRuns: 1,
              tokenizedRuns: 1,
              costedRuns: 1,
              latencyRuns: 1,
              totalTokens: 30,
              estimatedCostMicrosEur: '3000',
              totalLatencyMs: '300',
              avgTokens: 30,
              avgCostMicrosEur: '3000',
              avgLatencyMs: 300,
              errorRate: 1,
            },
          ],
          byOperation: [],
          byProvider: [],
          byModel: [],
        },
      },
    ]);

    expect(merged.byModule[0].runs).toBe(3);
    expect(merged.byModule[0].avgTokens).toBe(17);
    expect(merged.byModule[0].errorRate).toBeCloseTo(1 / 3);
  });
});
