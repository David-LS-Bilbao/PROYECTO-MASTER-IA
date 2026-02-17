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
  const setHeaderMock = vi.fn();
  const res = {
    status: statusMock as any,
    json: jsonMock as any,
    setHeader: setHeaderMock as any,
  } as Partial<Response>;
  return { res, jsonMock, statusMock, setHeaderMock };
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

  it('analyzeArticle responde 403 en modo deep sin entitlement', async () => {
    const { res, statusMock, jsonMock } = createRes();
    const req = {
      body: { articleId: validArticleId, mode: 'deep' },
      user: {
        uid: 'user-1',
        email: 'free@example.com',
        subscriptionPlan: 'FREE',
        entitlements: { deepAnalysis: false },
      },
    } as Request;

    await controller.analyzeArticle(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'PREMIUM_REQUIRED',
        message: 'Solo para usuarios Premium',
      })
    );
    expect(analyzeUseCase.execute).not.toHaveBeenCalled();
  });

  it('analyzeArticle responde 200 en modo deep para usuario PREMIUM sin promo', async () => {
    const { res, statusMock } = createRes();
    const req = {
      body: { articleId: validArticleId, mode: 'deep' },
      user: {
        uid: 'user-1',
        email: 'premium@example.com',
        subscriptionPlan: 'PREMIUM',
        entitlements: { deepAnalysis: false },
      },
    } as Request;

    analyzeUseCase.execute.mockResolvedValueOnce({
      articleId: validArticleId,
      summary: 'Resumen premium',
      biasScore: 0.1,
      analysis: {
        summary: 'Resumen premium',
        biasScore: 0.1,
        biasRaw: 0,
        biasScoreNormalized: 0.1,
        biasIndicators: [],
        clickbaitScore: 10,
        reliabilityScore: 90,
        sentiment: 'neutral',
        mainTopics: [],
        factCheck: { claims: [], verdict: 'SupportedByArticle', reasoning: '' },
      },
      scrapedContentLength: 1200,
    });

    await controller.analyzeArticle(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(analyzeUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'deep',
      })
    );
  });

  it('analyzeArticle responde 200 en modo deep con entitlement y devuelve secciones deep', async () => {
    const { res, statusMock, jsonMock } = createRes();
    const req = {
      body: { articleId: validArticleId, mode: 'deep' },
      user: {
        uid: 'user-1',
        email: 'premium@example.com',
        subscriptionPlan: 'FREE',
        entitlements: { deepAnalysis: true },
      },
    } as Request;

    analyzeUseCase.execute.mockResolvedValueOnce({
      articleId: validArticleId,
      summary: 'Resumen profundo',
      biasScore: 0.1,
      analysis: {
        summary: 'Resumen profundo',
        biasScore: 0.1,
        biasRaw: 0,
        biasScoreNormalized: 0.1,
        biasIndicators: [],
        clickbaitScore: 10,
        reliabilityScore: 90,
        traceabilityScore: 70,
        factualityStatus: 'no_determinable',
        evidence_needed: [],
        should_escalate: false,
        sentiment: 'neutral',
        mainTopics: [],
        factCheck: { claims: ['claim 1'], verdict: 'SupportedByArticle', reasoning: '' },
        deep: {
          sections: {
            known: ['K1'],
            unknown: ['U1'],
            quotes: ['"Q1"'],
            risks: ['R1'],
          },
        },
      },
      scrapedContentLength: 1500,
    });


    await controller.analyzeArticle(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    const payload = jsonMock.mock.calls[0][0];
    expect(payload.data.analysis.deep.sections.known).toEqual(expect.any(Array));
    expect(payload.data.analysis.deep.sections.unknown).toEqual(expect.any(Array));
    expect(payload.data.analysis.deep.sections.quotes).toEqual(expect.any(Array));
    expect(payload.data.analysis.deep.sections.risks).toEqual(expect.any(Array));
    expect(analyzeUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'deep',
      })
    );
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




