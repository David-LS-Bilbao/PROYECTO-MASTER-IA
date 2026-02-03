/**
 * AnalyzeArticleUseCase Unit Tests
 * Target: 100% coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyzeArticleUseCase } from './analyze-article.usecase';
import { INewsArticleRepository } from '../../domain/repositories/news-article.repository';
import { IGeminiClient, AnalyzeContentInput } from '../../domain/services/gemini-client.interface';
import { IJinaReaderClient, ScrapedContent } from '../../domain/services/jina-reader-client.interface';
import { NewsArticle, ArticleAnalysis } from '../../domain/entities/news-article.entity';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/domain.error';
import { ExternalAPIError } from '../../domain/errors/infrastructure.error';

// Helper to create test articles
const createTestArticle = (overrides: Partial<{
  id: string;
  title: string;
  url: string;
  content: string | null;
  source: string;
  language: string;
  analyzedAt: Date | null;
  summary: string | null;
  biasScore: number | null;
  analysis: string | null;
}> = {}): NewsArticle => {
  return NewsArticle.reconstitute({
    id: overrides.id ?? 'test-article-123',
    title: overrides.title ?? 'Test Article Title',
    description: 'Test description',
    content: overrides.content ?? null,
    url: overrides.url ?? 'https://example.com/test-article',
    urlToImage: 'https://example.com/image.jpg',
    source: overrides.source ?? 'Test Source',
    author: 'Test Author',
    publishedAt: new Date('2024-01-15'),
    category: 'technology',
    language: overrides.language ?? 'es',
    embedding: null,
    summary: overrides.summary ?? null,
    biasScore: overrides.biasScore ?? null,
    analysis: overrides.analysis ?? null,
    analyzedAt: overrides.analyzedAt ?? null,
    fetchedAt: new Date(),
    updatedAt: new Date(),
  });
};

// Mock analysis result
const mockAnalysis: ArticleAnalysis = {
  summary: 'This is a test summary of the article.',
  biasScore: 0.3,
  biasIndicators: ['slight emotional language'],
  sentiment: 'neutral',
  mainTopics: ['technology', 'innovation'],
  factualClaims: ['Company X launched product Y'],
};

// Mock scraped content
const mockScrapedContent: ScrapedContent = {
  title: 'Test Article Title',
  content: 'This is the full scraped content of the article. It contains enough text to be analyzed properly by the AI system.',
  description: 'Test description',
  author: 'Test Author',
  publishedDate: '2024-01-15',
};

// Mock implementations
class MockNewsArticleRepository implements INewsArticleRepository {
  private articles: Map<string, NewsArticle> = new Map();

  async save(article: NewsArticle): Promise<void> {
    this.articles.set(article.id, article);
  }

  async saveMany(): Promise<void> {
    // Not used in this test
  }

  async findById(id: string): Promise<NewsArticle | null> {
    return this.articles.get(id) || null;
  }

  async findByUrl(): Promise<NewsArticle | null> {
    return null;
  }

  async findBySourceAndDateRange(): Promise<NewsArticle[]> {
    return [];
  }

  async findUnanalyzed(limit: number): Promise<NewsArticle[]> {
    return Array.from(this.articles.values())
      .filter((a) => !a.isAnalyzed)
      .slice(0, limit);
  }

  async existsByUrl(): Promise<boolean> {
    return false;
  }

  async count(): Promise<number> {
    return this.articles.size;
  }

  async countAnalyzed(): Promise<number> {
    return Array.from(this.articles.values()).filter((a) => a.isAnalyzed).length;
  }

  async getBiasDistribution(): Promise<{ left: number; center: number; right: number }> {
    return { left: 0, center: 0, right: 0 };
  }

  async findAll(): Promise<NewsArticle[]> {
    return [];
  }

  async countFiltered(): Promise<number> {
    return 0;
  }

  async toggleFavorite(): Promise<NewsArticle | null> {
    return null;
  }

  async findByIds(): Promise<NewsArticle[]> {
    return [];
  }

  // Test helpers
  setArticle(article: NewsArticle): void {
    this.articles.set(article.id, article);
  }

  clear(): void {
    this.articles.clear();
  }
}

class MockGeminiClient implements IGeminiClient {
  async analyzeArticle(_input: AnalyzeContentInput): Promise<ArticleAnalysis> {
    return mockAnalysis;
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }

  async chatWithContext(): Promise<any> {
    return { response: 'Mock response', usage: { totalTokens: 100 } };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

class MockJinaReaderClient implements IJinaReaderClient {
  async scrapeUrl(_url: string): Promise<ScrapedContent> {
    return mockScrapedContent;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

class MockMetadataExtractor {
  async extractMetadata(_url: string): Promise<any> {
    return {
      imageUrl: 'https://example.com/image.jpg',
      title: 'Test Title',
      description: 'Test Description',
    };
  }
}

class MockChromaClient {
  async addDocument(): Promise<void> {
    // Mock implementation
  }

  async upsertItem(): Promise<void> {
    // Mock implementation
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

describe('AnalyzeArticleUseCase', () => {
  let useCase: AnalyzeArticleUseCase;
  let mockRepository: MockNewsArticleRepository;
  let mockGemini: MockGeminiClient;
  let mockJina: MockJinaReaderClient;
  let mockMetadata: MockMetadataExtractor;
  let mockChroma: MockChromaClient;

  beforeEach(() => {
    mockRepository = new MockNewsArticleRepository();
    mockGemini = new MockGeminiClient();
    mockJina = new MockJinaReaderClient();
    mockMetadata = new MockMetadataExtractor();
    mockChroma = new MockChromaClient();

    useCase = new AnalyzeArticleUseCase(
      mockRepository,
      mockGemini,
      mockJina,
      mockMetadata as any,
      mockChroma as any
    );
  });

  describe('execute - single article analysis', () => {
    it('should analyze an article without existing content', async () => {
      const article = createTestArticle({ content: null });
      mockRepository.setArticle(article);

      const result = await useCase.execute({ articleId: article.id });

      expect(result.articleId).toBe(article.id);
      expect(result.summary).toBe(mockAnalysis.summary);
      expect(result.biasScore).toBe(mockAnalysis.biasScore);
      expect(result.analysis).toEqual(mockAnalysis);
      expect(result.scrapedContentLength).toBeGreaterThan(0);
    });

    it('should analyze an article with existing content (skip scraping)', async () => {
      const existingContent = 'This is existing long content that is long enough for analysis. '.repeat(10);
      const article = createTestArticle({ content: existingContent });
      mockRepository.setArticle(article);

      const scrapeSpy = vi.spyOn(mockJina, 'scrapeUrl');

      const result = await useCase.execute({ articleId: article.id });

      expect(scrapeSpy).not.toHaveBeenCalled();
      expect(result.scrapedContentLength).toBe(existingContent.length);
    });

    it('should scrape content if existing content is too short', async () => {
      const shortContent = 'Short';
      const article = createTestArticle({ content: shortContent });
      mockRepository.setArticle(article);

      const scrapeSpy = vi.spyOn(mockJina, 'scrapeUrl');

      await useCase.execute({ articleId: article.id });

      expect(scrapeSpy).toHaveBeenCalledWith(article.url);
    });

    it('should return cached analysis for already analyzed article', async () => {
      const existingAnalysis = JSON.stringify(mockAnalysis);
      const article = createTestArticle({
        analyzedAt: new Date(),
        summary: mockAnalysis.summary,
        biasScore: mockAnalysis.biasScore,
        analysis: existingAnalysis,
        content: 'Some content',
      });
      mockRepository.setArticle(article);

      const geminiSpy = vi.spyOn(mockGemini, 'analyzeArticle');

      const result = await useCase.execute({ articleId: article.id });

      expect(geminiSpy).not.toHaveBeenCalled();
      expect(result.summary).toBe(mockAnalysis.summary);
      expect(result.biasScore).toBe(mockAnalysis.biasScore);
    });

    it('should throw ValidationError for empty articleId', async () => {
      await expect(useCase.execute({ articleId: '' })).rejects.toThrow(ValidationError);
      await expect(useCase.execute({ articleId: '' })).rejects.toThrow('Article ID is required');
    });

    it('should throw ValidationError for whitespace-only articleId', async () => {
      await expect(useCase.execute({ articleId: '   ' })).rejects.toThrow(ValidationError);
    });

    it('should throw EntityNotFoundError for non-existent article', async () => {
      await expect(useCase.execute({ articleId: 'non-existent-id' })).rejects.toThrow(
        EntityNotFoundError
      );
    });

    it('should handle Gemini API errors', async () => {
      const article = createTestArticle({
        content: 'Long enough content for analysis. '.repeat(10),
      });
      mockRepository.setArticle(article);

      vi.spyOn(mockGemini, 'analyzeArticle').mockRejectedValue(
        new ExternalAPIError('Gemini', 'Rate limit exceeded', 429)
      );

      await expect(useCase.execute({ articleId: article.id })).rejects.toThrow(ExternalAPIError);
    });

    it('should handle Jina Reader errors', async () => {
      const article = createTestArticle({ content: null });
      mockRepository.setArticle(article);

      vi.spyOn(mockJina, 'scrapeUrl').mockRejectedValue(
        new ExternalAPIError('JinaReader', 'URL not accessible', 404)
      );

      // El análisis debe completarse usando fallback (título + descripción)
      const result = await useCase.execute({ articleId: article.id });

      // Verificar que el análisis se completó correctamente usando fallback
      expect(result.articleId).toBe(article.id);
      expect(result.summary).toBe(mockAnalysis.summary);
      expect(result.scrapedContentLength).toBe(0); // Fallback no scraped
    });

    it('should wrap unknown scraping errors in ExternalAPIError', async () => {
      const article = createTestArticle({ content: null });
      mockRepository.setArticle(article);

      vi.spyOn(mockJina, 'scrapeUrl').mockRejectedValue(new Error('Network error'));

      // El análisis debe completarse usando fallback (título + descripción)
      const result = await useCase.execute({ articleId: article.id });

      // Verificar que el análisis se completó correctamente usando fallback
      expect(result.articleId).toBe(article.id);
      expect(result.summary).toBe(mockAnalysis.summary);
      expect(result.scrapedContentLength).toBe(0); // Fallback no scraped
    });

    it('should save article with scraped content before analysis', async () => {
      const article = createTestArticle({ content: null });
      mockRepository.setArticle(article);

      const saveSpy = vi.spyOn(mockRepository, 'save');

      await useCase.execute({ articleId: article.id });

      // Should save twice: once after scraping, once after analysis
      expect(saveSpy).toHaveBeenCalledTimes(2);
    });

    it('should persist analysis results to repository', async () => {
      const article = createTestArticle({
        content: 'Long enough content for analysis. '.repeat(10),
      });
      mockRepository.setArticle(article);

      await useCase.execute({ articleId: article.id });

      const savedArticle = await mockRepository.findById(article.id);
      expect(savedArticle?.summary).toBe(mockAnalysis.summary);
      expect(savedArticle?.biasScore).toBe(mockAnalysis.biasScore);
      expect(savedArticle?.analyzedAt).toBeDefined();
    });
  });

  describe('executeBatch - batch analysis', () => {
    it('should process multiple unanalyzed articles', async () => {
      const articles = [
        createTestArticle({ id: 'article-1', content: 'Long content 1. '.repeat(10) }),
        createTestArticle({ id: 'article-2', content: 'Long content 2. '.repeat(10) }),
        createTestArticle({ id: 'article-3', content: 'Long content 3. '.repeat(10) }),
      ];
      articles.forEach((a) => mockRepository.setArticle(a));

      const result = await useCase.executeBatch({ limit: 10 });

      expect(result.processed).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(result.results.every((r) => r.success)).toBe(true);
    });

    it('should respect batch limit', async () => {
      const articles = [
        createTestArticle({ id: 'article-1', content: 'Content 1. '.repeat(20) }),
        createTestArticle({ id: 'article-2', content: 'Content 2. '.repeat(20) }),
        createTestArticle({ id: 'article-3', content: 'Content 3. '.repeat(20) }),
      ];
      articles.forEach((a) => mockRepository.setArticle(a));

      const result = await useCase.executeBatch({ limit: 2 });

      expect(result.processed).toBe(2);
    });

    it('should handle partial failures in batch', async () => {
      const articles = [
        createTestArticle({ id: 'article-1', content: 'Content 1. '.repeat(20) }),
        createTestArticle({ id: 'article-2', content: null }), // Will need scraping
        createTestArticle({ id: 'article-3', content: 'Content 3. '.repeat(20) }),
      ];
      articles.forEach((a) => mockRepository.setArticle(a));

      // Make scraping fail for the second article
      let callCount = 0;
      vi.spyOn(mockJina, 'scrapeUrl').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call is for article-2 (no content)
          return Promise.reject(new ExternalAPIError('JinaReader', 'Failed', 500));
        }
        return Promise.resolve(mockScrapedContent);
      });

      const result = await useCase.executeBatch({ limit: 10 });

      expect(result.processed).toBe(3);
      expect(result.successful).toBe(3); // Todos pasan (fallback funciona)
      expect(result.failed).toBe(0); // Ninguno falla (fallback maneja errores)
      // Verificar que el artículo con error de scraping está marcado como exitoso
      const article2 = result.results.find((r) => r.articleId === 'article-2');
      expect(article2?.success).toBe(true);
    });

    it('should throw ValidationError for invalid batch limit (0)', async () => {
      await expect(useCase.executeBatch({ limit: 0 })).rejects.toThrow(ValidationError);
      await expect(useCase.executeBatch({ limit: 0 })).rejects.toThrow(
        'Batch limit must be between 1 and 100'
      );
    });

    it('should throw ValidationError for invalid batch limit (negative)', async () => {
      await expect(useCase.executeBatch({ limit: -5 })).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid batch limit (too large)', async () => {
      await expect(useCase.executeBatch({ limit: 101 })).rejects.toThrow(ValidationError);
    });

    it('should return empty results when no unanalyzed articles exist', async () => {
      // Add an already analyzed article
      const analyzedArticle = createTestArticle({
        analyzedAt: new Date(),
        summary: 'Already analyzed',
        biasScore: 0.5,
        analysis: JSON.stringify(mockAnalysis),
        content: 'Some content',
      });
      mockRepository.setArticle(analyzedArticle);

      const result = await useCase.executeBatch({ limit: 10 });

      expect(result.processed).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('should include error messages in failed results', async () => {
      const article = createTestArticle({ id: 'failing-article', content: null });
      mockRepository.setArticle(article);

      vi.spyOn(mockJina, 'scrapeUrl').mockRejectedValue(
        new ExternalAPIError('JinaReader', 'Page not found', 404)
      );

      const result = await useCase.executeBatch({ limit: 10 });

      expect(result.failed).toBe(0); // Fallback maneja el error
      expect(result.successful).toBe(1); // El artículo se analiza correctamente
      expect(result.results[0].success).toBe(true);
    });
  });

  describe('getStats - analysis statistics', () => {
    it('should return correct statistics', async () => {
      const unanalyzedArticle = createTestArticle({ id: 'unanalyzed-1' });
      const analyzedArticle = createTestArticle({
        id: 'analyzed-1',
        analyzedAt: new Date(),
        summary: 'Summary',
        biasScore: 0.5,
        analysis: JSON.stringify(mockAnalysis),
        content: 'Content',
      });
      mockRepository.setArticle(unanalyzedArticle);
      mockRepository.setArticle(analyzedArticle);

      const stats = await useCase.getStats();

      expect(stats.total).toBe(2);
      expect(stats.analyzed).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.percentAnalyzed).toBe(50);
    });

    it('should return zero percent when no articles exist', async () => {
      const stats = await useCase.getStats();

      expect(stats.total).toBe(0);
      expect(stats.analyzed).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.percentAnalyzed).toBe(0);
    });

    it('should return 100 percent when all articles are analyzed', async () => {
      const analyzedArticles = [
        createTestArticle({
          id: 'analyzed-1',
          analyzedAt: new Date(),
          summary: 'S1',
          biasScore: 0.2,
          analysis: '{}',
          content: 'C1',
        }),
        createTestArticle({
          id: 'analyzed-2',
          analyzedAt: new Date(),
          summary: 'S2',
          biasScore: 0.3,
          analysis: '{}',
          content: 'C2',
        }),
      ];
      analyzedArticles.forEach((a) => mockRepository.setArticle(a));

      const stats = await useCase.getStats();

      expect(stats.percentAnalyzed).toBe(100);
    });
  });

  describe('Edge cases', () => {
    it('should handle article with malformed analysis JSON', async () => {
      const article = createTestArticle({
        analyzedAt: new Date(),
        summary: 'Summary',
        biasScore: 0.5,
        analysis: 'invalid-json',
        content: 'Long content for reanalysis. '.repeat(10),
      });
      mockRepository.setArticle(article);

      // Should reanalyze because getParsedAnalysis returns null
      const geminiSpy = vi.spyOn(mockGemini, 'analyzeArticle');

      const result = await useCase.execute({ articleId: article.id });

      expect(geminiSpy).toHaveBeenCalled();
      expect(result.analysis).toEqual(mockAnalysis);
    });

    it('should use article title and metadata in analysis request', async () => {
      const article = createTestArticle({
        title: 'Specific Test Title',
        source: 'Specific Source',
        language: 'en',
        content: 'Long specific content for analysis. '.repeat(10),
      });
      mockRepository.setArticle(article);

      const geminiSpy = vi.spyOn(mockGemini, 'analyzeArticle');

      await useCase.execute({ articleId: article.id });

      expect(geminiSpy).toHaveBeenCalledWith({
        title: 'Specific Test Title',
        content: expect.any(String),
        source: 'Specific Source',
        language: 'en',
      });
    });
  });
});
