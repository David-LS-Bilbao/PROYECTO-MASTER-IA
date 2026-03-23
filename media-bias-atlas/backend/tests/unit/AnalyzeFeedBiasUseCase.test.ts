import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyzeArticleBiasUseCase } from '../../src/application/use-cases/bias-analysis/AnalyzeArticleBiasUseCase';
import { AnalyzeFeedBiasUseCase } from '../../src/application/use-cases/bias-analysis/AnalyzeFeedBiasUseCase';
import { Article, ClassificationStatus } from '../../src/domain/entities/Article';
import { BiasAnalysisStatus } from '../../src/domain/entities/ArticleBiasAnalysis';
import { IArticleRepository } from '../../src/domain/repositories/IArticleRepository';

function buildArticle(id: string, isPolitical: boolean | null): Article {
  return {
    id,
    feedId: 'feed-1',
    title: `Articulo ${id}`,
    url: `https://example.com/${id}`,
    publishedAt: new Date('2026-03-17T10:00:00.000Z'),
    createdAt: new Date('2026-03-17T10:00:00.000Z'),
    updatedAt: new Date('2026-03-17T10:00:00.000Z'),
    isPolitical,
    classificationStatus: ClassificationStatus.COMPLETED,
    classificationReason: isPolitical ? 'Politico' : 'No politico',
    classifiedAt: new Date('2026-03-17T10:00:00.000Z'),
  };
}

describe('AnalyzeFeedBiasUseCase', () => {
  const mockArticleRepository: IArticleRepository = {
    saveManySkipDuplicates: vi.fn(),
    findByFeedId: vi.fn(),
    updateClassification: vi.fn(),
    findById: vi.fn(),
  };

  const mockAnalyzeArticleBiasUseCase = {
    execute: vi.fn(),
  } as unknown as AnalyzeArticleBiasUseCase;

  let useCase: AnalyzeFeedBiasUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new AnalyzeFeedBiasUseCase(mockArticleRepository, mockAnalyzeArticleBiasUseCase);
  });

  it('solo analiza articulos politicos y resume metricas correctamente', async () => {
    vi.mocked(mockArticleRepository.findByFeedId).mockResolvedValue([
      buildArticle('a-1', true),
      buildArticle('a-2', false),
      buildArticle('a-3', null),
      buildArticle('a-4', true),
    ]);
    vi.mocked(mockAnalyzeArticleBiasUseCase.execute)
      .mockResolvedValueOnce({
        analysis: { status: BiasAnalysisStatus.COMPLETED },
        reusedExisting: false,
        invokedAI: true,
      } as any)
      .mockResolvedValueOnce({
        analysis: { status: BiasAnalysisStatus.COMPLETED },
        reusedExisting: true,
        invokedAI: false,
      } as any);

    const result = await useCase.execute('feed-1', {
      requestId: 'req-1',
      correlationId: 'corr-1',
      endpoint: 'POST /api/feeds/feed-1/analyze-bias',
    });

    expect(mockAnalyzeArticleBiasUseCase.execute).toHaveBeenCalledTimes(2);
    expect(mockAnalyzeArticleBiasUseCase.execute).toHaveBeenNthCalledWith(1, 'a-1', expect.objectContaining({
      requestId: 'req-1',
      correlationId: 'corr-1',
      entityType: 'article',
      entityId: 'a-1',
    }));
    expect(result).toEqual({
      feedId: 'feed-1',
      totalArticles: 4,
      eligiblePolitical: 2,
      skippedNonPolitical: 2,
      alreadyCompleted: 1,
      analyzedNow: 1,
      failed: 0,
    });
  });

  it('cuenta como failed cuando un analisis lanza error', async () => {
    vi.mocked(mockArticleRepository.findByFeedId).mockResolvedValue([
      buildArticle('a-1', true),
    ]);
    vi.mocked(mockAnalyzeArticleBiasUseCase.execute).mockRejectedValue(new Error('boom'));

    const result = await useCase.execute('feed-1');

    expect(result.failed).toBe(1);
    expect(result.analyzedNow).toBe(0);
  });
});
