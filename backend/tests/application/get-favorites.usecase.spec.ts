/**
 * GetFavoritesUseCase Unit Tests - ZONA ESTÁNDAR (80% Coverage)
 *
 * Verifica paginación y filtro onlyFavorites en el repositorio.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GetFavoritesUseCase } from '../../src/application/use-cases/get-favorites.usecase';
import { NewsArticle } from '../../src/domain/entities/news-article.entity';

// ============================================================================
// MOCKS
// ============================================================================

const mockArticleRepository = {
  findAll: vi.fn(),
};

// ============================================================================
// TEST DATA
// ============================================================================

function createMockArticle(overrides: Partial<Record<string, unknown>> = {}): NewsArticle {
  return NewsArticle.reconstitute({
    id: 'fav-1',
    title: 'Favorite Article',
    description: 'Description',
    content: 'Content',
    url: 'https://example.com/fav-1',
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
    isFavorite: true,
    fetchedAt: new Date('2026-02-01T10:00:00Z'),
    updatedAt: new Date('2026-02-01T10:00:00Z'),
    ...overrides,
  });
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('GetFavoritesUseCase', () => {
  let useCase: GetFavoritesUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GetFavoritesUseCase(mockArticleRepository as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('usa defaults (limit=50, offset=0) y onlyFavorites=true', async () => {
    const favorites = [createMockArticle(), createMockArticle({ id: 'fav-2', url: 'https://example.com/fav-2' })];
    mockArticleRepository.findAll.mockResolvedValueOnce(favorites);

    const result = await useCase.execute({});

    expect(mockArticleRepository.findAll).toHaveBeenCalledWith({
      limit: 50,
      offset: 0,
      onlyFavorites: true,
    });
    expect(result.articles).toEqual(favorites);
    expect(result.count).toBe(2);
  });

  it('respeta limit y offset proporcionados', async () => {
    const favorites = [createMockArticle({ id: 'fav-3', url: 'https://example.com/fav-3' })];
    mockArticleRepository.findAll.mockResolvedValueOnce(favorites);

    const result = await useCase.execute({ limit: 10, offset: 20 });

    expect(mockArticleRepository.findAll).toHaveBeenCalledWith({
      limit: 10,
      offset: 20,
      onlyFavorites: true,
    });
    expect(result.count).toBe(1);
  });

  it('retorna count=0 si no hay favoritos', async () => {
    mockArticleRepository.findAll.mockResolvedValueOnce([]);

    const result = await useCase.execute({ limit: 5, offset: 0 });

    expect(result.articles).toEqual([]);
    expect(result.count).toBe(0);
  });
});
