/**
 * AnalyzeController Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { AnalyzeController } from '../../../../src/infrastructure/http/controllers/analyze.controller';

// ============================================================================
// MOCKS (hoisted)
// ============================================================================

const { mockIncrementArticlesAnalyzed } = vi.hoisted(() => ({
  mockIncrementArticlesAnalyzed: vi.fn(),
}));

vi.mock('../../../../src/infrastructure/monitoring/user-stats-tracker', () => ({
  UserStatsTracker: {
    incrementArticlesAnalyzed: mockIncrementArticlesAnalyzed,
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

function createRes() {
  const jsonMock = vi.fn();
  const statusMock = vi.fn(() => ({ json: jsonMock }));
  const res = {
    status: statusMock as any,
    json: jsonMock as any,
  } as Partial<Response>;
  return { res, jsonMock, statusMock };
}

const validArticleId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

// ============================================================================
// TEST SUITE
// ============================================================================

describe('AnalyzeController', () => {
  let controller: AnalyzeController;
  let analyzeUseCase: {
    execute: ReturnType<typeof vi.fn>;
    executeBatch: ReturnType<typeof vi.fn>;
    getStats: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIncrementArticlesAnalyzed.mockResolvedValue(undefined);
    analyzeUseCase = {
      execute: vi.fn(),
      executeBatch: vi.fn(),
      getStats: vi.fn(),
    };
    controller = new AnalyzeController(analyzeUseCase as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('analyzeArticle responde 200 y oculta internal_reasoning', async () => {
    const { res, statusMock, jsonMock } = createRes();
    const req = {
      body: { articleId: validArticleId },
      user: { uid: 'user-1', subscriptionPlan: 'FREE' },
    } as Request;

    analyzeUseCase.execute.mockResolvedValueOnce({
      articleId: validArticleId,
      summary: 'Resumen',
      biasScore: 0.1,
      analysis: {
        internal_reasoning: 'secret',
        summary: 'Resumen',
        biasScore: 0.1,
        biasRaw: 0,
        biasIndicators: [],
        clickbaitScore: 10,
        reliabilityScore: 90,
        sentiment: 'neutral',
        mainTopics: [],
        factCheck: { claims: [], verdict: 'SupportedByArticle', reasoning: '' },
      },
    });

    await controller.analyzeArticle(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    const payload = jsonMock.mock.calls[0][0];
    expect(payload.data.analysis.internal_reasoning).toBeUndefined();
    expect(mockIncrementArticlesAnalyzed).toHaveBeenCalledWith('user-1', 1);
  });

  it('analyzeBatch responde 200 y trackea exitosos', async () => {
    const { res, statusMock, jsonMock } = createRes();
    const req = { body: { limit: 2 }, user: { uid: 'user-1' } } as Request;

    analyzeUseCase.executeBatch.mockResolvedValueOnce({
      processed: 2,
      successful: 1,
      failed: 1,
      errors: [],
    });

    await controller.analyzeBatch(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(mockIncrementArticlesAnalyzed).toHaveBeenCalledWith('user-1', 1);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ processed: 2 }),
      })
    );
  });

  it('getStats responde 200 con estadisticas', async () => {
    const { res, statusMock, jsonMock } = createRes();

    analyzeUseCase.getStats.mockResolvedValueOnce({
      totalArticles: 10,
      analyzedArticles: 5,
      percentAnalyzed: 50,
    });

    await controller.getStats({} as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ percentAnalyzed: 50 }),
      })
    );
  });
});




