/**
 * NewsController Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { NewsController } from '../../../../src/infrastructure/http/controllers/news.controller';
import { NewsArticle } from '../../../../src/domain/entities/news-article.entity';

// ============================================================================
// TYPE EXTENSIONS
// ============================================================================

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        subscriptionPlan?: 'FREE' | 'PREMIUM';
        usageStats?: {
          currentMonthUsage: number;
        };
      };
    }
  }
}

// ============================================================================
// MOCKS (hoisted)
// ============================================================================

const { mockUserFindUnique } = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
}));

vi.mock('../../../../src/infrastructure/persistence/prisma.client', () => ({
  getPrismaClient: () => ({
    user: {
      findUnique: mockUserFindUnique,
    },
  }),
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

function createArticle(overrides: Partial<Record<string, unknown>> = {}): NewsArticle {
  return NewsArticle.reconstitute({
    id: 'article-1',
    title: 'Article Title',
    description: 'Description',
    content: 'Content',
    url: 'https://example.com/article-1',
    urlToImage: null,
    source: 'Source',
    author: null,
    publishedAt: new Date('2026-02-01T10:00:00Z'),
    category: 'general',
    topicId: null,
    language: 'es',
    embedding: null,
    summary: 'Summary',
    biasScore: 0.2,
    analysis: JSON.stringify({ summary: 'Summary', biasScore: 0.2 }),
    analyzedAt: new Date('2026-02-01T10:00:00Z'),
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

describe('NewsController', () => {
  let controller: NewsController;
  let repository: any;
  let toggleFavoriteUseCase: any;
  let ingestNewsUseCase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = {
      findAll: vi.fn(),
      count: vi.fn(),
      countFiltered: vi.fn(),
      findById: vi.fn(),
      searchArticles: vi.fn(),
      searchLocalArticles: vi.fn(),
      getUserUnlockedArticleIds: vi.fn(),
      getUserFavoriteArticleIds: vi.fn(),
    };
    toggleFavoriteUseCase = { execute: vi.fn() };
    ingestNewsUseCase = { execute: vi.fn() };

    controller = new NewsController(repository, toggleFavoriteUseCase, ingestNewsUseCase);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getNews', () => {
    it('401 si favoritos sin autenticacion', async () => {
      const { res, statusMock } = createRes();
      const req = { query: { favorite: 'true' } } as Request;

      await controller.getNews(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('401 si local sin autenticacion', async () => {
      const { res, statusMock } = createRes();
      const req = { query: { category: 'local' } } as Request;

      await controller.getNews(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('fallback a Madrid si local sin ubicacion', async () => {
      const { res, jsonMock } = createRes();
      const req = { query: { category: 'local' }, user: { uid: 'user-1' } } as Request;

      mockUserFindUnique.mockResolvedValueOnce({ location: null });
      repository.searchLocalArticles.mockResolvedValueOnce([]);
      ingestNewsUseCase.execute.mockResolvedValueOnce({ newArticles: 0 });

      await controller.getNews(req, res as Response);

      // Should use fallback city 'Madrid' and return 200 with empty data + message
      const payload = jsonMock.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data).toEqual([]);
      expect(payload.meta.message).toContain('Madrid');
    });

    it('200 en caso normal con usuario y analisis desbloqueado', async () => {
      const { res, jsonMock } = createRes();
      const req = { query: { limit: '10', offset: '0' }, user: { uid: 'user-1' } } as Request;

      const article = createArticle();
      repository.findAll.mockResolvedValueOnce([article]);
      repository.count.mockResolvedValueOnce(1);
      repository.getUserUnlockedArticleIds.mockResolvedValueOnce(new Set(['article-1']));

      await controller.getNews(req, res as Response);      const payload = jsonMock.mock.calls[0][0];
      expect(payload.data[0].analysis).toEqual({ summary: 'Summary', biasScore: 0.2 });
      expect(payload.pagination.total).toBe(1);
    });
  });

  describe('getNewsById', () => {
    it('400 si falta id', async () => {
      const { res, statusMock } = createRes();
      const req = { params: { id: '' } } as Request;

      await controller.getNewsById(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('404 si no existe articulo', async () => {
      const { res, statusMock } = createRes();
      const req = { params: { id: 'article-1' } } as Request;

      repository.findById.mockResolvedValueOnce(null);

      await controller.getNewsById(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('200 con favorito y analisis desbloqueado', async () => {
      const { res, jsonMock } = createRes();
      const req = { params: { id: 'article-1' }, user: { uid: 'user-1', email: 'a@b.com' } } as Request;

      repository.findById.mockResolvedValueOnce(createArticle());
      repository.getUserFavoriteArticleIds.mockResolvedValueOnce(new Set(['article-1']));
      repository.getUserUnlockedArticleIds.mockResolvedValueOnce(new Set(['article-1']));

      await controller.getNewsById(req, res as Response);

      const payload = jsonMock.mock.calls[0][0];
      expect(payload.data.isFavorite).toBe(true);
      expect(payload.data.analysis).toEqual({ summary: 'Summary', biasScore: 0.2 });
    });
  });

  describe('toggleFavorite', () => {
    it('401 si no autenticado', async () => {
      const { res, statusMock } = createRes();
      const req = { params: { id: 'article-1' } } as Request;

      await controller.toggleFavorite(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('400 si falta id', async () => {
      const { res, statusMock } = createRes();
      const req = { params: { id: '' }, user: { uid: 'user-1' } } as Request;

      await controller.toggleFavorite(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('404 si no existe articulo', async () => {
      const { res, statusMock } = createRes();
      const req = { params: { id: 'article-1' }, user: { uid: 'user-1' } } as Request;

      toggleFavoriteUseCase.execute.mockRejectedValueOnce(new Error('Article not found'));

      await controller.toggleFavorite(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('200 en toggle exitoso', async () => {
      const { res, jsonMock } = createRes();
      const req = { params: { id: 'article-1' }, user: { uid: 'user-1' } } as Request;

      toggleFavoriteUseCase.execute.mockResolvedValueOnce({ isFavorite: true });

      await controller.toggleFavorite(req, res as Response);

      const payload = jsonMock.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.isFavorite).toBe(true);
    });
  });

  describe('search', () => {
    it('400 si falta query', async () => {
      const { res, statusMock } = createRes();
      const req = { query: {} } as Request;

      await controller.search(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('retorna nivel 1 si hay resultados', async () => {
      const { res, jsonMock } = createRes();
      const req = { query: { q: 'ai' }, user: { uid: 'user-1' } } as Request;

      repository.searchArticles.mockResolvedValueOnce([createArticle()]);
      repository.getUserUnlockedArticleIds.mockResolvedValueOnce(new Set(['article-1']));

      await controller.search(req, res as Response);

      const payload = jsonMock.mock.calls[0][0];
      expect(payload.meta.level).toBe(1);
      expect(payload.data.length).toBe(1);
    });

    it('retorna nivel 3 si no hay resultados', async () => {
      const { res, jsonMock } = createRes();
      const req = { query: { q: 'ai' } } as Request;

      repository.searchArticles
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      ingestNewsUseCase.execute.mockResolvedValueOnce({ success: true });

      await controller.search(req, res as Response);

      const payload = jsonMock.mock.calls[0][0];
      expect(payload.meta.level).toBe(3);
      expect(payload.suggestion).toBeDefined();
    });
  });
});

