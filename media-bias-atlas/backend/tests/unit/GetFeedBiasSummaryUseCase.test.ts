import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetFeedBiasSummaryUseCase } from '../../src/application/use-cases/bias-analysis/GetFeedBiasSummaryUseCase';
import { Article, ClassificationStatus } from '../../src/domain/entities/Article';
import { BiasAnalysisStatus, IdeologyLabel } from '../../src/domain/entities/ArticleBiasAnalysis';
import { IArticleRepository } from '../../src/domain/repositories/IArticleRepository';

function buildArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'article-1',
    feedId: 'feed-1',
    title: 'Titular',
    url: 'https://example.com/article-1',
    publishedAt: new Date('2026-03-17T10:00:00.000Z'),
    createdAt: new Date('2026-03-17T10:00:00.000Z'),
    updatedAt: new Date('2026-03-17T10:00:00.000Z'),
    isPolitical: true,
    classificationStatus: ClassificationStatus.COMPLETED,
    classificationReason: 'Politico',
    classifiedAt: new Date('2026-03-17T10:00:00.000Z'),
    biasAnalysis: null,
    ...overrides,
  };
}

describe('GetFeedBiasSummaryUseCase', () => {
  const mockArticleRepository: IArticleRepository = {
    saveManySkipDuplicates: vi.fn(),
    findByFeedId: vi.fn(),
    updateClassification: vi.fn(),
    findById: vi.fn(),
  };

  let useCase: GetFeedBiasSummaryUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GetFeedBiasSummaryUseCase(mockArticleRepository);
  });

  it('resume solo articulos politicos y cuenta etiquetas completadas', async () => {
    vi.mocked(mockArticleRepository.findByFeedId).mockResolvedValue([
      buildArticle({
        id: 'a-1',
        biasAnalysis: {
          id: 'ba-1',
          articleId: 'a-1',
          status: BiasAnalysisStatus.COMPLETED,
          provider: 'mock',
          model: 'test',
          ideologyLabel: IdeologyLabel.LEFT,
          confidence: 0.8,
          summary: 'Resumen',
          reasoningShort: 'Motivo',
          rawJson: '{}',
          errorMessage: null,
          analyzedAt: new Date('2026-03-17T10:10:00.000Z'),
          createdAt: new Date('2026-03-17T10:10:00.000Z'),
          updatedAt: new Date('2026-03-17T10:10:00.000Z'),
        }
      }),
      buildArticle({
        id: 'a-2',
        biasAnalysis: {
          id: 'ba-2',
          articleId: 'a-2',
          status: BiasAnalysisStatus.COMPLETED,
          provider: 'mock',
          model: 'test',
          ideologyLabel: null,
          confidence: 0.52,
          summary: 'Resumen',
          reasoningShort: 'Motivo',
          rawJson: '{}',
          errorMessage: null,
          analyzedAt: new Date('2026-03-17T10:10:00.000Z'),
          createdAt: new Date('2026-03-17T10:10:00.000Z'),
          updatedAt: new Date('2026-03-17T10:10:00.000Z'),
        }
      }),
      buildArticle({
        id: 'a-3',
        biasAnalysis: {
          id: 'ba-3',
          articleId: 'a-3',
          status: BiasAnalysisStatus.FAILED,
          provider: 'mock',
          model: 'test',
          ideologyLabel: null,
          confidence: null,
          summary: null,
          reasoningShort: null,
          rawJson: '{}',
          errorMessage: 'Fallo',
          analyzedAt: new Date('2026-03-17T10:10:00.000Z'),
          createdAt: new Date('2026-03-17T10:10:00.000Z'),
          updatedAt: new Date('2026-03-17T10:10:00.000Z'),
        }
      }),
      buildArticle({
        id: 'a-4',
        biasAnalysis: {
          id: 'ba-4',
          articleId: 'a-4',
          status: BiasAnalysisStatus.PENDING,
          provider: 'mock',
          model: 'test',
          ideologyLabel: null,
          confidence: null,
          summary: null,
          reasoningShort: null,
          rawJson: null,
          errorMessage: null,
          analyzedAt: null,
          createdAt: new Date('2026-03-17T10:10:00.000Z'),
          updatedAt: new Date('2026-03-17T10:10:00.000Z'),
        }
      }),
      buildArticle({
        id: 'a-5',
        isPolitical: false,
        biasAnalysis: {
          id: 'ba-5',
          articleId: 'a-5',
          status: BiasAnalysisStatus.COMPLETED,
          provider: 'mock',
          model: 'test',
          ideologyLabel: IdeologyLabel.RIGHT,
          confidence: 0.9,
          summary: 'No debe contarse',
          reasoningShort: 'No debe contarse',
          rawJson: '{}',
          errorMessage: null,
          analyzedAt: new Date('2026-03-17T10:10:00.000Z'),
          createdAt: new Date('2026-03-17T10:10:00.000Z'),
          updatedAt: new Date('2026-03-17T10:10:00.000Z'),
        }
      }),
    ]);

    const result = await useCase.execute('feed-1');

    expect(result).toEqual({
      feedId: 'feed-1',
      totalPoliticalArticles: 4,
      analyzedArticles: 2,
      pendingAnalysis: 1,
      failedAnalysis: 1,
      ideologyCounts: {
        LEFT: { count: 1, percentage: 50 },
        CENTER_LEFT: { count: 0, percentage: 0 },
        CENTER: { count: 0, percentage: 0 },
        CENTER_RIGHT: { count: 0, percentage: 0 },
        RIGHT: { count: 0, percentage: 0 },
        UNCLEAR: { count: 1, percentage: 50 },
      },
    });
  });

  it('devuelve porcentajes a cero cuando no hay analisis completados', async () => {
    vi.mocked(mockArticleRepository.findByFeedId).mockResolvedValue([
      buildArticle({ biasAnalysis: null }),
      buildArticle({
        id: 'a-2',
        biasAnalysis: {
          id: 'ba-2',
          articleId: 'a-2',
          status: BiasAnalysisStatus.FAILED,
          provider: 'mock',
          model: 'test',
          ideologyLabel: null,
          confidence: null,
          summary: null,
          reasoningShort: null,
          rawJson: null,
          errorMessage: 'Fallo',
          analyzedAt: new Date('2026-03-17T10:10:00.000Z'),
          createdAt: new Date('2026-03-17T10:10:00.000Z'),
          updatedAt: new Date('2026-03-17T10:10:00.000Z'),
        }
      }),
    ]);

    const result = await useCase.execute('feed-1');

    expect(result.analyzedArticles).toBe(0);
    expect(result.pendingAnalysis).toBe(1);
    expect(result.failedAnalysis).toBe(1);
    expect(Object.values(result.ideologyCounts).every(bucket => bucket.percentage === 0)).toBe(true);
  });
});
