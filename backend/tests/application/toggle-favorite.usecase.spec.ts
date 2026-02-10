/**
 * ToggleFavoriteUseCase Unit Tests - ZONA ESTANDAR (80% Coverage)
 *
 * Verifica validaciones y toggle per-user.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToggleFavoriteUseCase } from '../../src/application/use-cases/toggle-favorite.usecase';
import { NewsArticle } from '../../src/domain/entities/news-article.entity';
import { DomainError } from '../../src/domain/errors/domain.error';

// ============================================================================
// MOCKS
// ============================================================================

const mockArticleRepository = {
  findById: vi.fn(),
  toggleFavoriteForUser: vi.fn(),
};

// ============================================================================
// TEST DATA
// ============================================================================

function createMockArticle(overrides: Partial<Record<string, unknown>> = {}): NewsArticle {
  return NewsArticle.reconstitute({
    id: 'article-1',
    title: 'Sample Article',
    description: 'Description',
    content: 'Content',
    url: 'https://example.com/article-1',
    urlToImage: null,
    source: 'Test Source',
    author: null,
    publishedAt: new Date('2026-02-01T10:00:00Z'),
    category: 'general',
    language: 'es',
    embedding: null,
    summary: null,
    biasScore: null,
    analysis: null,
    analyzedAt: null,
    internalReasoning: null,
    isFavorite: false,
    fetchedAt: new Date('2026-02-01T10:00:00Z'),
    updatedAt: new Date('2026-02-01T10:00:00Z'),
    ...overrides,
  });
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('ToggleFavoriteUseCase', () => {
  let useCase: ToggleFavoriteUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ToggleFavoriteUseCase(mockArticleRepository as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lanza error si articleId es vacio', async () => {
    await expect(useCase.execute({ articleId: '', userId: 'user-1' })).rejects.toBeInstanceOf(DomainError);
    expect(mockArticleRepository.findById).not.toHaveBeenCalled();
    expect(mockArticleRepository.toggleFavoriteForUser).not.toHaveBeenCalled();
  });

  it('lanza error si userId es vacio', async () => {
    await expect(useCase.execute({ articleId: 'article-1', userId: '' })).rejects.toBeInstanceOf(DomainError);
    expect(mockArticleRepository.findById).not.toHaveBeenCalled();
    expect(mockArticleRepository.toggleFavoriteForUser).not.toHaveBeenCalled();
  });

  it('lanza error si el articulo no existe', async () => {
    mockArticleRepository.findById.mockResolvedValueOnce(null);

    await expect(useCase.execute({ articleId: 'article-404', userId: 'user-1' })).rejects.toBeInstanceOf(DomainError);
    expect(mockArticleRepository.findById).toHaveBeenCalledWith('article-404');
    expect(mockArticleRepository.toggleFavoriteForUser).not.toHaveBeenCalled();
  });

  it('toglea favorito por usuario y retorna estado', async () => {
    mockArticleRepository.findById.mockResolvedValueOnce(createMockArticle());
    mockArticleRepository.toggleFavoriteForUser.mockResolvedValueOnce(true);

    const result = await useCase.execute({ articleId: 'article-1', userId: 'user-1' });

    expect(mockArticleRepository.findById).toHaveBeenCalledWith('article-1');
    expect(mockArticleRepository.toggleFavoriteForUser).toHaveBeenCalledWith('user-1', 'article-1');
    expect(result).toEqual({ articleId: 'article-1', isFavorite: true });
  });
});
