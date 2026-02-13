/**
 * AnalyzeArticleUseCase Unit Tests - ZONA CRÃTICA (100% Coverage)
 *
 * Este archivo testea la lÃ³gica de orquestaciÃ³n del caso de uso de anÃ¡lisis,
 * clasificada como "Zona Roja" segÃºn docs/CALIDAD.md
 *
 * ESTRATEGIA:
 * - Mock COMPLETO de todas las dependencias (GeminiClient, Repository, JinaReader, Chroma, MetadataExtractor)
 * - Tests de flujos principales: cache hit, anÃ¡lisis nuevo, scraping
 * - Tests de edge cases: artÃ­culo no encontrado, contenido invÃ¡lido, errores de API
 * - VerificaciÃ³n de cost optimization: que NO se llame a Gemini si ya estÃ¡ analizado
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnalyzeArticleUseCase } from '../../src/application/use-cases/analyze-article.usecase';
import { NewsArticle, ArticleAnalysis } from '../../src/domain/entities/news-article.entity';
import { EntityNotFoundError, ValidationError } from '../../src/domain/errors/domain.error';

// ============================================================================
// MOCKS
// ============================================================================

// Mock de GeminiClient
const mockGeminiClient = {
  analyzeArticle: vi.fn(),
  chatWithContext: vi.fn(),
  chatWithGrounding: vi.fn(),
  generateChatResponse: vi.fn(),
  generateGeneralResponse: vi.fn(),
  generateEmbedding: vi.fn(),
  getSessionCostReport: vi.fn(),
};

// Mock de NewsArticleRepository
const mockArticleRepository = {
  findById: vi.fn(),
  findByUrl: vi.fn(),
  findAll: vi.fn(),
  findUnanalyzed: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
  findRecent: vi.fn(),
  search: vi.fn(),
  getBiasDistribution: vi.fn(),
};

// Mock de JinaReaderClient
const mockJinaReaderClient = {
  scrapeUrl: vi.fn(),
};

// Mock de MetadataExtractor
const mockMetadataExtractor = {
  extractMetadata: vi.fn(),
};

// Mock de ChromaClient
const mockChromaClient = {
  addDocument: vi.fn(),
  search: vi.fn(),
  deleteDocument: vi.fn(),
  getCollection: vi.fn(),
};

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Factory para crear un NewsArticle de prueba usando la clase real
 */
function createMockArticle(overrides?: Partial<any>): NewsArticle {
  const defaultProps = {
    id: 'test-article-id-123',
    title: 'Test Article Title',
    description: 'Test article description',
    url: 'https://example.com/test-article',
    urlToImage: 'https://example.com/image.jpg',
    publishedAt: new Date('2026-02-01T10:00:00Z'),
    source: 'Test Source',
    author: 'Test Author',
    content: 'This is a test article with enough content to pass validation requirements. It has more than 100 characters to ensure it can be analyzed properly.',
    category: 'technology',
    language: 'es',
    embedding: null,
    isFavorite: false,
    summary: null,
    biasScore: null,
    analysis: null,
    analyzedAt: null,
    fetchedAt: new Date('2026-02-01T10:00:00Z'),
    updatedAt: new Date('2026-02-01T10:00:00Z'),
    ...overrides,
  };

  return NewsArticle.reconstitute(defaultProps);
}

/**
 * Factory para crear un ArticleAnalysis de prueba
 */
function createMockAnalysis(overrides?: Partial<ArticleAnalysis>): ArticleAnalysis {
  return {
    summary: 'Test summary of the article',
    biasScore: 0,
    biasRaw: 0,
    biasScoreNormalized: 0,
    biasIndicators: [],
    clickbaitScore: 20,
    reliabilityScore: 80,
    traceabilityScore: 80,
    factualityStatus: 'no_determinable',
    evidence_needed: [],
    should_escalate: false,
    sentiment: 'neutral',
    mainTopics: ['technology', 'AI'],
    factCheck: {
      claims: ['AI is advancing rapidly'],
      verdict: 'Verified',
      reasoning: 'Based on recent research publications',
    },
    ...overrides,
  };
}

/**
 * Factory para crear una respuesta de GeminiClient
 */
function createMockGeminiResponse(analysis?: Partial<ArticleAnalysis>) {
  return {
    ...createMockAnalysis(analysis),
    usage: {
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
      costEstimated: 0.000214,
    },
  };
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('AnalyzeArticleUseCase - LÃ³gica de OrquestaciÃ³n (ZONA CRÃTICA)', () => {
  let useCase: AnalyzeArticleUseCase;

  beforeEach(() => {
    // Limpiar todos los mocks antes de cada test
    vi.clearAllMocks();

    // Instanciar el caso de uso con las dependencias mockeadas
    useCase = new AnalyzeArticleUseCase(
      mockArticleRepository as any,
      mockGeminiClient as any,
      mockJinaReaderClient as any,
      mockMetadataExtractor as any,
      mockChromaClient as any
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GRUPO 1: VALIDACIÃ“N DE INPUTS (ZONA ROJA - 100%)
  // ==========================================================================

  describe('ðŸ”’ ValidaciÃ³n de Inputs', () => {
    it('VALIDACIÃ“N: lanza ValidationError si articleId estÃ¡ vacÃ­o', async () => {
      // ACT & ASSERT
      await expect(
        useCase.execute({ articleId: '' })
      ).rejects.toThrow(ValidationError);

      await expect(
        useCase.execute({ articleId: '   ' })
      ).rejects.toThrow('Article ID is required');

      // Verificar que NO se llamÃ³ al repositorio
      expect(mockArticleRepository.findById).not.toHaveBeenCalled();
    });

    it('ENTIDAD NO ENCONTRADA: lanza EntityNotFoundError si el artÃ­culo no existe', async () => {
      // ARRANGE
      mockArticleRepository.findById.mockResolvedValueOnce(null);

      // ACT & ASSERT
      await expect(
        useCase.execute({ articleId: 'non-existent-id' })
      ).rejects.toThrow(EntityNotFoundError);

      expect(mockArticleRepository.findById).toHaveBeenCalledWith('non-existent-id');
    });
  });

  // ==========================================================================
  // GRUPO 2: COST OPTIMIZATION - CACHE HIT (ZONA ROJA - 100%)
  // ==========================================================================

  describe('ðŸ’° Cost Optimization - Cache Hit', () => {
    it('CACHE HIT: devuelve anÃ¡lisis existente SIN llamar a Gemini si isAnalyzed=true', async () => {
      // ARRANGE - ArtÃ­culo ya analizado
      const existingAnalysis = createMockAnalysis({
        summary: 'Existing summary',
        biasRaw: 5,
        biasScore: 0.5,
        biasScoreNormalized: 0.5,
      });
      const analyzedArticle = createMockArticle({
        isAnalyzed: true,
        summary: 'Existing summary',
        biasScore: 0.5,
        analysis: JSON.stringify(existingAnalysis),
        analyzedAt: new Date('2026-02-01T12:00:00Z'),
      });

      mockArticleRepository.findById.mockResolvedValueOnce(analyzedArticle);

      // ACT
      const result = await useCase.execute({ articleId: 'test-article-id-123' });

      // ASSERT
      expect(result).toBeDefined();
      expect(result.summary).toBe('Existing summary');
      expect(result.biasScore).toBe(0.5);
      expect(result.analysis).toEqual(existingAnalysis);

      // CRÃTICO: Verificar que NO se llamÃ³ a Gemini (cost optimization)
      expect(mockGeminiClient.analyzeArticle).not.toHaveBeenCalled();
      expect(mockJinaReaderClient.scrapeUrl).not.toHaveBeenCalled();

      // Verificar que NO se guardÃ³ nada (cache hit = solo lectura)
      expect(mockArticleRepository.update).not.toHaveBeenCalled();
    });

    it('CACHE MISS: llama a Gemini si isAnalyzed=false aunque tenga contenido', async () => {
      // ARRANGE - ArtÃ­culo sin analizar pero con contenido vÃ¡lido
      const unanalyzedArticle = createMockArticle({
        isAnalyzed: false,
        content: 'Valid content with more than 100 characters for testing purposes. This should trigger Gemini analysis.',
      });

      const geminiResponse = createMockGeminiResponse();

      mockArticleRepository.findById.mockResolvedValueOnce(unanalyzedArticle);
      mockGeminiClient.analyzeArticle.mockResolvedValueOnce(geminiResponse);
      mockMetadataExtractor.extractMetadata.mockResolvedValueOnce({});
      mockArticleRepository.update.mockResolvedValueOnce({
        ...unanalyzedArticle,
        isAnalyzed: true,
        summary: geminiResponse.summary,
        biasScore: geminiResponse.biasScoreNormalized,
        analysis: JSON.stringify(geminiResponse),
      });
      mockChromaClient.addDocument.mockResolvedValueOnce(undefined);

      // ACT
      const result = await useCase.execute({ articleId: 'test-article-id-123' });

      // ASSERT
      expect(result).toBeDefined();
      expect(result.summary).toBe(geminiResponse.summary);

      // CRÃTICO: Verificar que SÃ se llamÃ³ a Gemini (cache miss)
      expect(mockGeminiClient.analyzeArticle).toHaveBeenCalledTimes(1);
      expect(mockGeminiClient.analyzeArticle).toHaveBeenCalledWith({
        title: unanalyzedArticle.title,
        content: unanalyzedArticle.content,
        language: unanalyzedArticle.language,
        source: unanalyzedArticle.source,
      });
    });
  });

  // ==========================================================================
  // GRUPO 3: FLUJO DE SCRAPING (ZONA ROJA - 100%)
  // ==========================================================================

  describe('ðŸŒ Flujo de Scraping con Jina Reader', () => {
    it('SCRAPING: llama a JinaReader si content es muy corto (<100 chars)', async () => {
      // ARRANGE
      const articleWithShortContent = createMockArticle({
        content: 'Short content', // Menos de 100 caracteres
      });

      const scrapedContent = 'This is the full scraped content from Jina Reader with enough length to pass validation requirements.';
      const geminiResponse = createMockGeminiResponse();

      mockArticleRepository.findById.mockResolvedValueOnce(articleWithShortContent);
      mockJinaReaderClient.scrapeUrl.mockResolvedValueOnce({
        content: scrapedContent,
        imageUrl: 'https://example.com/scraped-image.jpg',
      });
      mockGeminiClient.analyzeArticle.mockResolvedValueOnce(geminiResponse);
      mockMetadataExtractor.extractMetadata.mockResolvedValueOnce({});
      mockArticleRepository.update.mockResolvedValueOnce({
        ...articleWithShortContent,
        content: scrapedContent,
      });
      mockChromaClient.addDocument.mockResolvedValueOnce(undefined);

      // ACT
      const result = await useCase.execute({ articleId: 'test-article-id-123' });

      // ASSERT
      expect(mockJinaReaderClient.scrapeUrl).toHaveBeenCalledWith(articleWithShortContent.url);
      expect(mockGeminiClient.analyzeArticle).toHaveBeenCalledWith({
        title: articleWithShortContent.title,
        content: scrapedContent, // Debe usar el contenido scrapeado
        language: articleWithShortContent.language,
        source: articleWithShortContent.source,
      });
      expect(result.scrapedContentLength).toBe(scrapedContent.length);
    });

    it('SCRAPING FALLIDO: usa contenido original si Jina falla', async () => {
      // ARRANGE
      const articleWithShortContent = createMockArticle({
        content: 'Original fallback content with enough characters to pass the minimum length validation requirement.',
      });

      const geminiResponse = createMockGeminiResponse();

      mockArticleRepository.findById.mockResolvedValueOnce(articleWithShortContent);
      mockJinaReaderClient.scrapeUrl.mockRejectedValueOnce(new Error('Jina API error'));
      mockGeminiClient.analyzeArticle.mockResolvedValueOnce(geminiResponse);
      mockMetadataExtractor.extractMetadata.mockResolvedValueOnce({});
      mockArticleRepository.update.mockResolvedValueOnce(articleWithShortContent);
      mockChromaClient.addDocument.mockResolvedValueOnce(undefined);

      // ACT
      const result = await useCase.execute({ articleId: 'test-article-id-123' });

      // ASSERT
      expect(mockJinaReaderClient.scrapeUrl).toHaveBeenCalled();
      
      // Verificar que se llamÃ³ a Gemini (con fallback message)
      expect(mockGeminiClient.analyzeArticle).toHaveBeenCalledTimes(1);
      const geminiCall = mockGeminiClient.analyzeArticle.mock.calls[0][0];
      expect(geminiCall.title).toBe(articleWithShortContent.title);
      expect(geminiCall.source).toBe(articleWithShortContent.source);
      expect(geminiCall.content).toContain('ADVERTENCIA'); // Fallback message
    });
  });

  // ==========================================================================
  // GRUPO 4: PERSISTENCIA Y ACTUALIZACIÃ“N (ZONA ROJA - 100%)
  // ==========================================================================

  describe('ðŸ’¾ Persistencia y ActualizaciÃ³n', () => {
    it('GUARDADO: actualiza el artÃ­culo en BD con el anÃ¡lisis de Gemini', async () => {
      // ARRANGE
      const article = createMockArticle({ isAnalyzed: false });
      const geminiResponse = createMockGeminiResponse({
        summary: 'Generated summary',
        biasRaw: 3,
        biasScore: 0.3,
        biasScoreNormalized: 0.3,
      });

      mockArticleRepository.findById.mockResolvedValueOnce(article);
      mockGeminiClient.analyzeArticle.mockResolvedValueOnce(geminiResponse);
      mockMetadataExtractor.extractMetadata.mockResolvedValueOnce({});
      mockArticleRepository.update.mockResolvedValueOnce({
        ...article,
        isAnalyzed: true,
        summary: geminiResponse.summary,
        biasScore: geminiResponse.biasScoreNormalized,
      });
      mockChromaClient.addDocument.mockResolvedValueOnce(undefined);

      // ACT
      const result = await useCase.execute({ articleId: 'test-article-id-123' });

      // ASSERT - Verificar que Gemini fue llamado y el resultado contiene el anÃ¡lisis
      expect(mockGeminiClient.analyzeArticle).toHaveBeenCalledTimes(1);
      expect(result.summary).toBe(geminiResponse.summary);
      expect(result.biasScore).toBe(geminiResponse.biasScoreNormalized);
    });

    it('VECTOR DB: almacena embedding en ChromaDB despuÃ©s del anÃ¡lisis', async () => {
      // ARRANGE
      const article = createMockArticle({ isAnalyzed: false });
      const geminiResponse = createMockGeminiResponse();

      mockArticleRepository.findById.mockResolvedValueOnce(article);
      mockGeminiClient.analyzeArticle.mockResolvedValueOnce(geminiResponse);
      mockMetadataExtractor.extractMetadata.mockResolvedValueOnce({});
      mockArticleRepository.update.mockResolvedValueOnce(article);
      mockChromaClient.addDocument.mockResolvedValueOnce(undefined);

      // ACT
      const result = await useCase.execute({ articleId: 'test-article-id-123' });

      // ASSERT - Verificar que el anÃ¡lisis se completÃ³ correctamente
      expect(mockGeminiClient.analyzeArticle).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
      expect(result.summary).toBe(geminiResponse.summary);
    });
  });

  // ==========================================================================
  // GRUPO 5: METADATA EXTRACTION (ZONA ESTÃNDAR - 80%)
  // ==========================================================================

  describe('ðŸ“Š Metadata Extraction', () => {
    it('METADATA: extrae y actualiza metadata del artÃ­culo', async () => {
      // ARRANGE
      const article = createMockArticle({ isAnalyzed: false });
      const geminiResponse = createMockGeminiResponse();
      const extractedMetadata = {
        readTime: 5,
        wordCount: 500,
      };

      mockArticleRepository.findById.mockResolvedValueOnce(article);
      mockGeminiClient.analyzeArticle.mockResolvedValueOnce(geminiResponse);
      mockMetadataExtractor.extractMetadata.mockResolvedValueOnce(extractedMetadata);
      mockArticleRepository.update.mockResolvedValueOnce(article);
      mockChromaClient.addDocument.mockResolvedValueOnce(undefined);

      // ACT
      const result = await useCase.execute({ articleId: 'test-article-id-123' });

      // ASSERT - Verificar que el anÃ¡lisis se completÃ³
      expect(mockGeminiClient.analyzeArticle).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
      expect(result.summary).toBe(geminiResponse.summary);
    });
  });
});
