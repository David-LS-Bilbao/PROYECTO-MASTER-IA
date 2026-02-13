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
import { EntityNotFoundError, ValidationError, QuotaExceededError } from '../../domain/errors/domain.error';
import { ExternalAPIError } from '../../domain/errors/infrastructure.error';
import { QuotaService } from '../../domain/services/quota.service';

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
    internalReasoning: null,
    isFavorite: false,
  });
};

// Mock analysis result
const mockAnalysis: ArticleAnalysis = {
  summary: 'This is a test summary of the article.',
  biasScore: 0.3,
  biasRaw: 3,
  biasScoreNormalized: 0.3,
  biasIndicators: [
    'Loaded wording: "total failure"',
    'Generalization: "everyone knows"',
    'Selective framing: "only this side"',
  ],
  sentiment: 'neutral',
  mainTopics: ['technology', 'innovation'],
  clickbaitScore: 20,
  reliabilityScore: 80,
  traceabilityScore: 80,
  factualityStatus: 'no_determinable',
  evidence_needed: [],
  should_escalate: false,
  biasComment:
    'El encuadre refleja una lectura parcial basada en senales textuales citadas y evaluadas solo con evidencia interna.',
  articleLeaning: 'indeterminada',
  biasLeaning: 'indeterminada',
  reliabilityComment:
    'La fiabilidad interna es alta por trazabilidad de citas y atribuciones; no verificable con fuentes internas en ausencia de validacion externa.',
  factCheck: {
    claims: ['Main claim from the article'],
    verdict: 'SupportedByArticle',
    reasoning: 'The claims are supported by credible sources',
  },
};

// Mock scraped content
const mockScrapedContent: ScrapedContent = {
  title: 'Test Article Title',
  content:
    'This is the full scraped content of the article. It contains enough text to be analyzed properly by the AI system. '.repeat(
      12
    ),
  description: 'Test description',
  author: 'Test Author',
  publishedDate: '2024-01-15',
  imageUrl: 'https://example.com/scraped-image.jpg',
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

  async getBiasDistribution(): Promise<{ left: number; neutral: number; right: number }> {
    return { left: 0, neutral: 0, right: 0 };
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

  async searchLocalArticles(_city: string, _limit: number, _offset: number): Promise<NewsArticle[]> {
    return [];
  }

  async countLocalArticles(_city: string): Promise<number> {
    return 0;
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

  async generateChatResponse(_context: string, _question: string): Promise<string> {
    return 'Mock chat response';
  }

  async generateGeneralResponse(_systemPrompt: string, _messages: Array<{ role: string; content: string }>): Promise<string> {
    return 'Mock general response';
  }

  async discoverRssUrl(_mediaName: string): Promise<string | null> {
    return 'https://example.com/rss';
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
  let mockQuotaService: QuotaService;

  beforeEach(() => {
    mockRepository = new MockNewsArticleRepository();
    mockGemini = new MockGeminiClient();
    mockJina = new MockJinaReaderClient();
    mockMetadata = new MockMetadataExtractor();
    mockChroma = new MockChromaClient();
    mockQuotaService = new QuotaService();

    useCase = new AnalyzeArticleUseCase(
      mockRepository,
      mockGemini,
      mockJina,
      mockMetadata as any,
      mockChroma as any,
      mockQuotaService
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
      expect(result.analysis).toEqual(
        expect.objectContaining({
          summary: mockAnalysis.summary,
          biasScore: mockAnalysis.biasScore,
          reliabilityScore: expect.any(Number),
          traceabilityScore: expect.any(Number),
          biasComment: expect.any(String),
          articleLeaning: expect.any(String),
          biasLeaning: expect.any(String),
          reliabilityComment: expect.any(String),
        })
      );
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

    it('should cap reliability/traceability when scrapedContentLength is below 800 chars', async () => {
      const mediumLengthContent = 'Contenido con soporte parcial pero sin enlaces directos. '.repeat(11);
      const article = createTestArticle({ content: mediumLengthContent });
      mockRepository.setArticle(article);

      vi.spyOn(mockGemini, 'analyzeArticle').mockResolvedValue({
        ...mockAnalysis,
        reliabilityScore: 92,
        traceabilityScore: 87,
      });

      const result = await useCase.execute({ articleId: article.id });

      expect(result.scrapedContentLength).toBe(mediumLengthContent.length);
      expect(result.analysis.reliabilityScore).toBe(55);
      expect(result.analysis.traceabilityScore).toBe(40);
    });

    it('should apply stricter caps when scrapedContentLength is below 300 chars', async () => {
      const shortButValidContent = 'Texto breve sin documentos ni enlaces externos. '.repeat(5);
      const article = createTestArticle({ content: shortButValidContent });
      mockRepository.setArticle(article);

      vi.spyOn(mockGemini, 'analyzeArticle').mockResolvedValue({
        ...mockAnalysis,
        reliabilityScore: 90,
        traceabilityScore: 84,
      });

      const result = await useCase.execute({ articleId: article.id });

      expect(result.scrapedContentLength).toBe(shortButValidContent.length);
      expect(result.analysis.reliabilityScore).toBe(45);
      expect(result.analysis.traceabilityScore).toBe(30);
    });

    it('should route moderate mode for long content in detail context', async () => {
      const longContent = 'Contenido extenso con citas y datos verificables. '.repeat(30);
      const article = createTestArticle({ content: longContent });
      mockRepository.setArticle(article);

      const geminiSpy = vi.spyOn(mockGemini, 'analyzeArticle');

      await useCase.execute({ articleId: article.id, analysisMode: 'moderate' });

      expect(geminiSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          analysisMode: 'moderate',
        })
      );
    });

    it('should force low_cost mode when content is short even if moderate is requested', async () => {
      const shortContent = 'Texto breve sin soporte documental. '.repeat(10);
      const article = createTestArticle({ content: shortContent });
      mockRepository.setArticle(article);

      const geminiSpy = vi.spyOn(mockGemini, 'analyzeArticle');

      await useCase.execute({ articleId: article.id, analysisMode: 'moderate' });

      expect(geminiSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          analysisMode: 'low_cost',
        })
      );
    });

    it('should force escalation in low-cost context when strong claims lack attribution', async () => {
      const shortContent = 'Asegura resultados absolutos sin citar fuentes, documentos o enlaces.';
      const article = createTestArticle({ content: `${shortContent} ${shortContent}` });
      mockRepository.setArticle(article);

      vi.spyOn(mockGemini, 'analyzeArticle').mockResolvedValue({
        ...mockAnalysis,
        should_escalate: false,
        summary:
          'La nota afirma que el tratamiento cura siempre al 100% y que el resultado es definitivo.',
        factCheck: {
          ...mockAnalysis.factCheck,
          claims: ['El tratamiento cura siempre al 100% de los casos.'],
          verdict: 'InsufficientEvidenceInArticle',
          reasoning: 'No hay atribuciones ni documentos verificables en el texto.',
        },
      });

      const result = await useCase.execute({ articleId: article.id });

      expect(result.analysis.should_escalate).toBe(true);
    });

    it('should force indeterminada articleLeaning and fallback biasComment in low-cost contexts', async () => {
      const shortContent = 'Texto corto con framing parcial y afirmaciones politicas. '.repeat(6);
      const article = createTestArticle({ content: shortContent });
      mockRepository.setArticle(article);

      vi.spyOn(mockGemini, 'analyzeArticle').mockResolvedValue({
        ...mockAnalysis,
        biasRaw: 5,
        biasScore: 0.5,
        biasScoreNormalized: 0.5,
        articleLeaning: 'progresista',
        biasLeaning: 'progresista',
        biasComment: 'Comentario del modelo que no debe usarse en low-cost.',
      });

      const result = await useCase.execute({ articleId: article.id });

      expect(result.scrapedContentLength).toBeLessThan(800);
      expect(result.analysis.articleLeaning).toBe('indeterminada');
      expect(result.analysis.biasComment).toContain(
        'No hay suficientes senales citadas para inferir una tendencia ideologica'
      );
    });

    it('should include no_determinable phrase and at most 2 evidence items in reliabilityComment', async () => {
      const article = createTestArticle({
        content: 'Contenido con cifras parciales y atribucion incompleta. '.repeat(20),
      });
      mockRepository.setArticle(article);

      vi.spyOn(mockGemini, 'analyzeArticle').mockResolvedValue({
        ...mockAnalysis,
        factualityStatus: 'no_determinable',
        evidence_needed: ['fuente primaria', 'documento oficial', 'metodologia completa'],
      });

      const result = await useCase.execute({ articleId: article.id });

      expect(result.analysis.reliabilityComment).toContain(
        'no verificable con fuentes internas'
      );
      expect(result.analysis.reliabilityComment).toContain('fuente primaria');
      expect(result.analysis.reliabilityComment).toContain('documento oficial');
      expect(result.analysis.reliabilityComment).not.toContain('metodologia completa');
    });

    it('should force factCheck verdict to InsufficientEvidenceInArticle when claims are empty', async () => {
      const article = createTestArticle({
        content: 'Contenido con tono informativo pero sin afirmaciones verificables directas. '.repeat(20),
      });
      mockRepository.setArticle(article);

      vi.spyOn(mockGemini, 'analyzeArticle').mockResolvedValue({
        ...mockAnalysis,
        factCheck: {
          claims: [],
          verdict: 'SupportedByArticle',
          reasoning: 'No aplica',
        },
      });

      const result = await useCase.execute({ articleId: article.id });
      expect(result.analysis.factCheck.claims).toEqual([]);
      expect(result.analysis.factCheck.verdict).toBe('InsufficientEvidenceInArticle');
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
        content: 'Long content for reanalysis. '.repeat(50),
      });
      mockRepository.setArticle(article);

      // Should reanalyze because getParsedAnalysis returns null
      const geminiSpy = vi.spyOn(mockGemini, 'analyzeArticle');

      const result = await useCase.execute({ articleId: article.id });

      expect(geminiSpy).toHaveBeenCalled();
      expect(result.analysis).toEqual(
        expect.objectContaining({
          summary: mockAnalysis.summary,
          biasScore: mockAnalysis.biasScore,
        })
      );
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

      expect(geminiSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Specific Test Title',
          content: expect.any(String),
          source: 'Specific Source',
          language: 'en',
          analysisMode: 'low_cost',
        })
      );
    });

    it('should neutralize bias when cached analysis has fewer than 3 cited bias indicators', async () => {
      const cachedAnalysis = {
        ...mockAnalysis,
        biasRaw: 6,
        biasScore: 0.6,
        biasScoreNormalized: 0.6,
        biasType: 'lenguaje',
        biasIndicators: ['Loaded wording without citation'],
        explanation: 'Explicacion original contradictoria.',
      };
      const article = createTestArticle({
        analyzedAt: new Date(),
        summary: cachedAnalysis.summary,
        biasScore: cachedAnalysis.biasScoreNormalized,
        analysis: JSON.stringify(cachedAnalysis),
      });
      mockRepository.setArticle(article);

      const result = await useCase.execute({ articleId: article.id });

      expect(result.analysis.biasRaw).toBe(0);
      expect(result.analysis.biasScore).toBe(0);
      expect(result.analysis.biasScoreNormalized).toBe(0);
      expect(result.analysis.biasType).toBe('ninguno');
      expect(result.analysis.explanation).toBe(
        'No se detectaron senales suficientes de sesgo con evidencia citada.'
      );
    });
  });

  describe('Quota Enforcement (Sprint 14 - Feature: Enforcement de Límites)', () => {
    it('should throw QuotaExceededError when user exceeds monthly analysis limit', async () => {
      const article = createTestArticle({
        content: 'Long content for analysis. '.repeat(10),
      });
      mockRepository.setArticle(article);

      // Mock a user who has already reached the FREE plan limit (500 articles/month)
      const userAtLimit = {
        id: 'user-123',
        plan: 'FREE' as const,
        usageStats: {
          articlesAnalyzed: 500, // FREE plan limit
          chatMessages: 0,
          searchesPerformed: 0,
        },
      };

      // Spy on quotaService.verifyQuota to verify it's called
      const verifyQuotaSpy = vi.spyOn(mockQuotaService, 'verifyQuota');

      // Execute with user at limit should throw QuotaExceededError
      await expect(
        useCase.execute({ articleId: article.id, user: userAtLimit })
      ).rejects.toThrow(QuotaExceededError);

      // Verify quota was checked
      expect(verifyQuotaSpy).toHaveBeenCalledWith(userAtLimit, 'analysis');
    });

    it('should allow analysis when user has remaining quota', async () => {
      const article = createTestArticle({
        id: 'article-with-quota',
        content: 'Long content for analysis. '.repeat(10),
      });
      mockRepository.setArticle(article);

      // Mock a user within FREE plan limit
      const userWithQuota = {
        id: 'user-123',
        plan: 'FREE' as const,
        usageStats: {
          articlesAnalyzed: 10, // Way below 500 limit
          chatMessages: 0,
          searchesPerformed: 0,
        },
      };

      // Should succeed without throwing
      const result = await useCase.execute({
        articleId: article.id,
        user: userWithQuota,
      });

      expect(result.articleId).toBe(article.id);
      expect(result.summary).toBe(mockAnalysis.summary);
    });

    it('should allow analysis when no quota service provided', async () => {
      // Create use case WITHOUT quota service (backward compatibility)
      const useCaseWithoutQuota = new AnalyzeArticleUseCase(
        mockRepository,
        mockGemini,
        mockJina,
        mockMetadata as any,
        mockChroma as any
        // No quotaService parameter
      );

      const article = createTestArticle({
        content: 'Long content for analysis. '.repeat(10),
      });
      mockRepository.setArticle(article);

      const userAtLimit = {
        id: 'user-123',
        plan: 'FREE' as const,
        usageStats: {
          articlesAnalyzed: 500,
          chatMessages: 0,
          searchesPerformed: 0,
        },
      };

      // Should NOT throw because quotaService is not provided
      const result = await useCaseWithoutQuota.execute({
        articleId: article.id,
        user: userAtLimit,
      });

      expect(result.articleId).toBe(article.id);
    });

    it('should allow analysis when no user provided', async () => {
      const article = createTestArticle({
        content: 'Long content for analysis. '.repeat(10),
      });
      mockRepository.setArticle(article);

      // Should NOT throw when no user is provided (unauthenticated request)
      const result = await useCase.execute({ articleId: article.id });

      expect(result.articleId).toBe(article.id);
    });
  });
});
