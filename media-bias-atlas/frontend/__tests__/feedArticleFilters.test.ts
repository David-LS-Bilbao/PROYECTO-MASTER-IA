import { describe, expect, it } from 'vitest';
import { filterFeedArticles, resolveBiasAnalysisStatus } from '@/lib/feedArticleFilters';
import { Article } from '@/types';

function buildArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'article-1',
    feedId: 'feed-1',
    title: 'Titular',
    url: 'https://example.com/article-1',
    publishedAt: '2026-03-17T10:00:00.000Z',
    createdAt: '2026-03-17T10:00:00.000Z',
    updatedAt: '2026-03-17T10:00:00.000Z',
    isPolitical: true,
    classificationStatus: 'COMPLETED',
    classificationReason: 'Politico',
    classifiedAt: '2026-03-17T10:00:00.000Z',
    biasAnalysis: null,
    ...overrides,
  };
}

describe('feedArticleFilters', () => {
  it('trata ausencia de biasAnalysis como estado pendiente', () => {
    expect(resolveBiasAnalysisStatus(null)).toBe('PENDING');
  });

  it('filtra por estado de analisis e ideologia sin contar articulos no completados', () => {
    const articles = [
      buildArticle({
        id: 'a-1',
        biasAnalysis: {
          id: 'ba-1',
          articleId: 'a-1',
          status: 'COMPLETED',
          provider: 'mock',
          model: 'test',
          ideologyLabel: 'CENTER_LEFT',
          confidence: 0.7,
          summary: 'Resumen',
          reasoningShort: 'Motivo',
          rawJson: '{}',
          errorMessage: null,
          analyzedAt: '2026-03-17T10:10:00.000Z',
          createdAt: '2026-03-17T10:10:00.000Z',
          updatedAt: '2026-03-17T10:10:00.000Z',
        }
      }),
      buildArticle({
        id: 'a-2',
        biasAnalysis: {
          id: 'ba-2',
          articleId: 'a-2',
          status: 'FAILED',
          provider: 'mock',
          model: 'test',
          ideologyLabel: null,
          confidence: null,
          summary: null,
          reasoningShort: null,
          rawJson: '{}',
          errorMessage: 'Fallo',
          analyzedAt: '2026-03-17T10:10:00.000Z',
          createdAt: '2026-03-17T10:10:00.000Z',
          updatedAt: '2026-03-17T10:10:00.000Z',
        }
      }),
      buildArticle({
        id: 'a-3',
        isPolitical: false,
      }),
    ];

    expect(filterFeedArticles(articles, { analysis: 'completed' })).toHaveLength(1);
    expect(filterFeedArticles(articles, { analysis: 'failed' })).toHaveLength(1);
    expect(filterFeedArticles(articles, { political: 'true', ideology: 'CENTER_LEFT' })).toHaveLength(1);
    expect(filterFeedArticles(articles, { ideology: 'RIGHT' })).toHaveLength(0);
  });
});
