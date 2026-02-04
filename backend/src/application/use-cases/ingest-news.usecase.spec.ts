/**
 * IngestNewsUseCase Unit Tests
 * Target: 100% coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IngestNewsUseCase } from './ingest-news.usecase';
import { INewsAPIClient, FetchNewsResult } from '../../domain/services/news-api-client.interface';
import { INewsArticleRepository, FindAllParams } from '../../domain/repositories/news-article.repository';
import { NewsArticle } from '../../domain/entities/news-article.entity';
import { ValidationError } from '../../domain/errors/domain.error';
import { PrismaClient } from '@prisma/client';

// Mock implementations
class MockNewsAPIClient implements INewsAPIClient {
  async fetchTopHeadlines(): Promise<FetchNewsResult> {
    return {
      status: 'ok',
      totalResults: 2,
      articles: [
        {
          title: 'Test Article 1',
          description: 'Description 1',
          content: 'Content 1',
          url: 'https://example.com/article1',
          urlToImage: 'https://example.com/image1.jpg',
          source: { id: 'test-source', name: 'Test Source' },
          author: 'Author 1',
          publishedAt: new Date().toISOString(),
        },
        {
          title: 'Test Article 2',
          description: 'Description 2',
          content: 'Content 2',
          url: 'https://example.com/article2',
          urlToImage: 'https://example.com/image2.jpg',
          source: { id: 'test-source-2', name: 'Test Source 2' },
          author: 'Author 2',
          publishedAt: new Date().toISOString(),
        },
      ],
    };
  }

  async fetchEverything(): Promise<FetchNewsResult> {
    return this.fetchTopHeadlines();
  }
}

/**
 * Mock Repository that implements ALL methods from INewsArticleRepository
 */
class MockNewsArticleRepository implements INewsArticleRepository {
  private articles: Map<string, any> = new Map();

  // ===============================
  // Core Methods (Used by UseCase)
  // ===============================

  async save(article: NewsArticle): Promise<void> {
    const data = article.toJSON();
    this.articles.set(data.url, data);
  }

  async saveMany(articles: NewsArticle[]): Promise<void> {
    for (const article of articles) {
      const data = article.toJSON();
      this.articles.set(data.url, data);
    }
  }

  async findByUrl(url: string): Promise<NewsArticle | null> {
    const data = this.articles.get(url);
    if (!data) return null;
    return NewsArticle.reconstitute(data);
  }

  async existsByUrl(url: string): Promise<boolean> {
    return this.articles.has(url);
  }

  async count(): Promise<number> {
    return this.articles.size;
  }

  // Test helper
  setExistingArticle(url: string): void {
    this.articles.set(url, { url });
  }

  // ===============================
  // Stub Methods (Interface Compliance)
  // ===============================

  async findById(_id: string): Promise<NewsArticle | null> {
    return null;
  }

  async findAll(_params: FindAllParams): Promise<NewsArticle[]> {
    return [];
  }

  async findUnanalyzed(_limit: number): Promise<NewsArticle[]> {
    return [];
  }

  async toggleFavorite(_id: string): Promise<NewsArticle | null> {
    return null;
  }

  async countFiltered(_params: { category?: string; onlyFavorites?: boolean }): Promise<number> {
    return 0;
  }

  async countAnalyzed(): Promise<number> {
    return 0;
  }

  async getBiasDistribution(): Promise<{ left: number; neutral: number; right: number }> {
    return { left: 0, neutral: 0, right: 0 };
  }

  async findBySourceAndDateRange(
    _source: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<NewsArticle[]> {
    return [];
  }

  async findByIds(_ids: string[]): Promise<NewsArticle[]> {
    return [];
  }
}

class MockPrismaClient {
  article = {
    findMany: vi.fn().mockResolvedValue([]),
  };

  ingestMetadata = {
    create: vi.fn(),
  };
}

describe('IngestNewsUseCase', () => {
  let useCase: IngestNewsUseCase;
  let mockNewsAPIClient: MockNewsAPIClient;
  let mockArticleRepository: MockNewsArticleRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockNewsAPIClient = new MockNewsAPIClient();
    mockArticleRepository = new MockNewsArticleRepository();
    mockPrisma = new MockPrismaClient();

    useCase = new IngestNewsUseCase(
      mockNewsAPIClient,
      mockArticleRepository,
      mockPrisma as unknown as PrismaClient
    );
  });

  describe('Successful ingestion scenarios', () => {
    it('should ingest new articles successfully', async () => {
      const request = {
        category: 'tecnologia', // Spanish category
        language: 'es',
        pageSize: 20,
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.totalFetched).toBe(2);
      expect(result.newArticles).toBe(2);
      expect(result.duplicates).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.source).toBe('newsapi');
      expect(mockPrisma.ingestMetadata.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'newsapi',
          articlesCount: 2,
          status: 'success',
          errorMessage: null,
        }),
      });
    });

    it('should handle duplicate articles correctly', async () => {
      // Configurar Prisma mock para devolver el primer artículo como existente
      vi.spyOn(mockPrisma.article, 'findMany').mockResolvedValue([
        { url: 'https://example.com/article1' },
      ] as any);

      const request = {
        language: 'en',
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.totalFetched).toBe(2);
      expect(result.newArticles).toBe(1);
      expect(result.duplicates).toBe(1);
    });

    it('should handle empty results from API', async () => {
      vi.spyOn(mockNewsAPIClient, 'fetchTopHeadlines').mockResolvedValue({
        status: 'ok',
        totalResults: 0,
        articles: [],
      });

      const request = {
        query: 'non-existent-topic',
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.totalFetched).toBe(0);
      expect(result.newArticles).toBe(0);
    });

    it('should use default language when not provided', async () => {
      const spy = vi.spyOn(mockNewsAPIClient, 'fetchTopHeadlines');

      await useCase.execute({});

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'es',
        })
      );
    });

    it('should use default pageSize when not provided', async () => {
      const spy = vi.spyOn(mockNewsAPIClient, 'fetchTopHeadlines');

      await useCase.execute({});

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          pageSize: 20,
        })
      );
    });

    it('should normalize English categories to Spanish', async () => {
      const saveSpy = vi.spyOn(mockArticleRepository, 'saveMany');

      await useCase.execute({ category: 'technology' });

      expect(saveSpy).toHaveBeenCalled();
      const savedArticles = saveSpy.mock.calls[0][0];
      // Category should be normalized to Spanish
      expect(savedArticles[0].category).toBe('tecnologia');
    });
  });

  describe('Validation scenarios', () => {
    it('should reject invalid pageSize (too small)', async () => {
      const request = {
        pageSize: 0,
      };

      await expect(useCase.execute(request)).rejects.toThrow(ValidationError);
      await expect(useCase.execute(request)).rejects.toThrow('pageSize must be between 1 and 100');
    });

    it('should reject invalid pageSize (too large)', async () => {
      const request = {
        pageSize: 101,
      };

      await expect(useCase.execute(request)).rejects.toThrow(ValidationError);
      await expect(useCase.execute(request)).rejects.toThrow('pageSize must be between 1 and 100');
    });

    it('should reject invalid language format', async () => {
      const request = {
        language: 'invalid',
      };

      await expect(useCase.execute(request)).rejects.toThrow(ValidationError);
      await expect(useCase.execute(request)).rejects.toThrow('language must be a 2-letter ISO code');
    });

    it('should reject invalid category', async () => {
      const request = {
        category: 'invalid-category' as any,
      };

      await expect(useCase.execute(request)).rejects.toThrow(ValidationError);
      await expect(useCase.execute(request)).rejects.toThrow('category must be one of');
    });

    it('should accept all valid Spanish categories', async () => {
      const validCategories = [
        'general',
        'internacional',
        'deportes',
        'economia',
        'politica',
        'ciencia',
        'tecnologia',
        'cultura',
      ];

      for (const category of validCategories) {
        const result = await useCase.execute({ category: category as any });
        expect(result.success).toBe(true);
      }
    });

    it('should accept English categories (backwards compatibility)', async () => {
      const englishCategories = [
        'business',
        'entertainment',
        'health',
        'science',
        'sports',
        'technology',
      ];

      for (const category of englishCategories) {
        const result = await useCase.execute({ category: category as any });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Error handling scenarios', () => {
    it('should handle API errors and record failure metadata', async () => {
      const apiError = new Error('API connection failed');
      vi.spyOn(mockNewsAPIClient, 'fetchTopHeadlines').mockRejectedValue(apiError);

      await expect(useCase.execute({})).rejects.toThrow('API connection failed');

      expect(mockPrisma.ingestMetadata.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'newsapi',
          articlesCount: 0,
          status: 'error',
          errorMessage: 'API connection failed',
        }),
      });
    });

    it('should handle repository errors gracefully', async () => {
      const repoError = new Error('Database connection failed');
      vi.spyOn(mockArticleRepository, 'saveMany').mockRejectedValue(repoError);

      await expect(useCase.execute({})).rejects.toThrow('Database connection failed');
    });

    it('should not fail if metadata recording fails', async () => {
      vi.spyOn(mockPrisma.ingestMetadata, 'create').mockRejectedValue(
        new Error('Metadata DB error')
      );

      const result = await useCase.execute({});

      // Should still succeed even if metadata recording fails
      expect(result.success).toBe(true);
    });

    it('should track partial errors when some articles fail to process', async () => {
      // Mock NewsArticle.create to throw error on second call
      let createCallCount = 0;
      const originalCreate = NewsArticle.create;
      vi.spyOn(NewsArticle, 'create' as any).mockImplementation((data: any) => {
        createCallCount++;
        if (createCallCount === 2) {
          throw new Error('Article creation failed');
        }
        return originalCreate(data);
      });

      const result = await useCase.execute({});

      expect(result.totalFetched).toBe(2);
      expect(result.errors).toBe(1);
      expect(mockPrisma.ingestMetadata.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'partial_success',
          errorMessage: '1 articles failed to process',
        }),
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle articles with missing title', async () => {
      vi.spyOn(mockNewsAPIClient, 'fetchTopHeadlines').mockResolvedValue({
        status: 'ok',
        totalResults: 1,
        articles: [
          {
            title: null as any,
            description: 'Description',
            content: 'Content',
            url: 'https://example.com/notitle',
            urlToImage: null,
            source: { id: 'source', name: 'Source' },
            author: null,
            publishedAt: new Date().toISOString(),
          },
        ],
      });

      const result = await useCase.execute({});

      // Should use 'Untitled' as fallback
      expect(result.newArticles).toBe(1);
    });

    it('should handle null/undefined optional fields', async () => {
      vi.spyOn(mockNewsAPIClient, 'fetchTopHeadlines').mockResolvedValue({
        status: 'ok',
        totalResults: 1,
        articles: [
          {
            title: 'Title',
            description: null,
            content: null,
            url: 'https://example.com/minimal',
            urlToImage: null,
            source: { id: null, name: 'Source' },
            author: null,
            publishedAt: new Date().toISOString(),
          },
        ],
      });

      const result = await useCase.execute({});

      expect(result.newArticles).toBe(1);
      expect(result.success).toBe(true);
    });

    it('should save category from request when provided', async () => {
      const saveSpy = vi.spyOn(mockArticleRepository, 'saveMany');

      await useCase.execute({ category: 'deportes' });

      expect(saveSpy).toHaveBeenCalled();
      const savedArticles = saveSpy.mock.calls[0][0];
      expect(savedArticles[0].category).toBe('deportes');
      expect(savedArticles[1].category).toBe('deportes');
    });

    it('should save category from query when category not provided', async () => {
      const saveSpy = vi.spyOn(mockArticleRepository, 'saveMany');

      await useCase.execute({ query: 'economia' });

      expect(saveSpy).toHaveBeenCalled();
      const savedArticles = saveSpy.mock.calls[0][0];
      expect(savedArticles[0].category).toBe('economia');
    });
  });
});
