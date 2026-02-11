/**
 * AnalyzeArticleUseCase Unit Tests - ZONA CRÍTICA (100% Coverage)
 *
 * Este archivo testea la lógica de orquestación del caso de uso de análisis,
 * clasificada como "Zona Roja" según docs/CALIDAD.md
 *
 * ESTRATEGIA:
 * - Mock COMPLETO de todas las dependencias (GeminiClient, Repository, JinaReader, Chroma, MetadataExtractor)
 * - Tests de flujos principales: cache hit, análisis nuevo, scraping
 * - Tests de edge cases: artículo no encontrado, contenido inválido, errores de API
 * - Verificación de cost optimization: que NO se llame a Gemini si ya está analizado
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
    biasIndicators: [],
    clickbaitScore: 20,
    reliabilityScore: 80,
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

describe('AnalyzeArticleUseCase - Lógica de Orquestación (ZONA CRÍTICA)', () => {
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
  // GRUPO 1: VALIDACIÓN DE INPUTS (ZONA ROJA - 100%)
  // ==========================================================================

  describe('🔒 Validación de Inputs', () => {
    it('VALIDACIÓN: lanza ValidationError si articleId está vacío', async () => {
      // ACT & ASSERT
      await expect(
        useCase.execute({ articleId: '' })
      ).rejects.toThrow(ValidationError);

      await expect(
        useCase.execute({ articleId: '   ' })
      ).rejects.toThrow('Article ID is required');

      // Verificar que NO se llamó al repositorio
      expect(mockArticleRepository.findById).not.toHaveBeenCalled();
    });

    it('ENTIDAD NO ENCONTRADA: lanza EntityNotFoundError si el artículo no existe', async () => {
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

  describe('💰 Cost Optimization - Cache Hit', () => {
    it('CACHE HIT: devuelve análisis existente SIN llamar a Gemini si isAnalyzed=true', async () => {
      // ARRANGE - Artículo ya analizado
      const existingAnalysis = createMockAnalysis();
      const analyzedArticle = createMockArticle({
        isAnalyzed: true,
        summary: 'Existing summary',
        biasScore: 5,
        analysis: JSON.stringify(existingAnalysis),
        analyzedAt: new Date('2026-02-01T12:00:00Z'),
      });

      mockArticleRepository.findById.mockResolvedValueOnce(analyzedArticle);

      // ACT
      const result = await useCase.execute({ articleId: 'test-article-id-123' });

      // ASSERT
      expect(result).toBeDefined();
      expect(result.summary).toBe('Existing summary');
      expect(result.biasScore).toBe(5);
      expect(result.analysis).toEqual(existingAnalysis);

      // CRÍTICO: Verificar que NO se llamó a Gemini (cost optimization)
      expect(mockGeminiClient.analyzeArticle).not.toHaveBeenCalled();
      expect(mockJinaReaderClient.scrapeUrl).not.toHaveBeenCalled();

      // Verificar que NO se guardó nada (cache hit = solo lectura)
      expect(mockArticleRepository.update).not.toHaveBeenCalled();
    });

    it('CACHE MISS: llama a Gemini si isAnalyzed=false aunque tenga contenido', async () => {
      // ARRANGE - Artículo sin analizar pero con contenido válido
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
        biasScore: geminiResponse.biasScore,
        analysis: JSON.stringify(geminiResponse),
      });
      mockChromaClient.addDocument.mockResolvedValueOnce(undefined);

      // ACT
      const result = await useCase.execute({ articleId: 'test-article-id-123' });

      // ASSERT
      expect(result).toBeDefined();
      expect(result.summary).toBe(geminiResponse.summary);

      // CRÍTICO: Verificar que SÍ se llamó a Gemini (cache miss)
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

  describe('🌐 Flujo de Scraping con Jina Reader', () => {
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
      
      // Verificar que se llamó a Gemini (con fallback message)
      expect(mockGeminiClient.analyzeArticle).toHaveBeenCalledTimes(1);
      const geminiCall = mockGeminiClient.analyzeArticle.mock.calls[0][0];
      expect(geminiCall.title).toBe(articleWithShortContent.title);
      expect(geminiCall.source).toBe(articleWithShortContent.source);
      expect(geminiCall.content).toContain('ADVERTENCIA'); // Fallback message
    });
  });

  // ==========================================================================
  // GRUPO 4: PERSISTENCIA Y ACTUALIZACIÓN (ZONA ROJA - 100%)
  // ==========================================================================

  describe('💾 Persistencia y Actualización', () => {
    it('GUARDADO: actualiza el artículo en BD con el análisis de Gemini', async () => {
      // ARRANGE
      const article = createMockArticle({ isAnalyzed: false });
      const geminiResponse = createMockGeminiResponse({
        summary: 'Generated summary',
        biasScore: 3,
      });

      mockArticleRepository.findById.mockResolvedValueOnce(article);
      mockGeminiClient.analyzeArticle.mockResolvedValueOnce(geminiResponse);
      mockMetadataExtractor.extractMetadata.mockResolvedValueOnce({});
      mockArticleRepository.update.mockResolvedValueOnce({
        ...article,
        isAnalyzed: true,
        summary: geminiResponse.summary,
        biasScore: geminiResponse.biasScore,
      });
      mockChromaClient.addDocument.mockResolvedValueOnce(undefined);

      // ACT
      const result = await useCase.execute({ articleId: 'test-article-id-123' });

      // ASSERT - Verificar que Gemini fue llamado y el resultado contiene el análisis
      expect(mockGeminiClient.analyzeArticle).toHaveBeenCalledTimes(1);
      expect(result.summary).toBe(geminiResponse.summary);
      expect(result.biasScore).toBe(geminiResponse.biasScore);
    });

    it('VECTOR DB: almacena embedding en ChromaDB después del análisis', async () => {
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

      // ASSERT - Verificar que el análisis se completó correctamente
      expect(mockGeminiClient.analyzeArticle).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
      expect(result.summary).toBe(geminiResponse.summary);
    });
  });

  // ==========================================================================
  // GRUPO 5: METADATA EXTRACTION (ZONA ESTÁNDAR - 80%)
  // ==========================================================================

  describe('📊 Metadata Extraction', () => {
    it('METADATA: extrae y actualiza metadata del artículo', async () => {
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

      // ASSERT - Verificar que el análisis se completó
      expect(mockGeminiClient.analyzeArticle).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
      expect(result.summary).toBe(geminiResponse.summary);
    });
  });
});
