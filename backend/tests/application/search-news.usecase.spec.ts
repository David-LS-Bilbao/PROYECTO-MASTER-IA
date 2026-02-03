/**
 * SearchNewsUseCase Unit Tests - ZONA ESTÁNDAR (80% Coverage)
 *
 * Este archivo testea la búsqueda semántica usando ChromaDB + PostgreSQL
 *
 * ESTRATEGIA:
 * - Mock COMPLETO de todas las dependencias (GeminiClient, ChromaClient, Repository)
 * - Tests de búsqueda semántica: embedding → vector search → hydration
 * - Tests de edge cases: sin resultados, límites, ordenamiento
 * - Verificación de preservación del orden de relevancia de ChromaDB
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SearchNewsUseCase } from '../../src/application/use-cases/search-news.usecase';
import { NewsArticle } from '../../src/domain/entities/news-article.entity';
import { ValidationError } from '../../src/domain/errors/domain.error';

// ============================================================================
// MOCKS
// ============================================================================

// Mock de GeminiClient
const mockGeminiClient = {
  analyzeArticle: vi.fn(),
  generateChatResponse: vi.fn(),
  generateEmbedding: vi.fn(),
  getSessionCostReport: vi.fn(),
};

// Mock de ChromaClient
const mockChromaClient = {
  querySimilar: vi.fn(),
  querySimilarWithDocuments: vi.fn(),
  addDocument: vi.fn(),
  deleteDocument: vi.fn(),
  getCollection: vi.fn(),
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
  findByIds: vi.fn(), // Para búsqueda semántica
};

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Factory para crear un NewsArticle de prueba usando la clase real
 */
function createMockArticle(overrides?: Partial<any>): NewsArticle {
  const defaultProps = {
    id: 'article-1',
    title: 'Test Article',
    description: 'Test description',
    url: 'https://example.com/article',
    urlToImage: 'https://example.com/image.jpg',
    publishedAt: new Date('2026-02-01T10:00:00Z'),
    source: 'Test Source',
    author: 'Test Author',
    content: 'Test content',
    category: 'technology',
    language: 'en',
    embedding: null,
    isFavorite: false,
    summary: 'Test summary',
    biasScore: 0,
    analysis: null,
    analyzedAt: null,
    fetchedAt: new Date('2026-02-01T10:00:00Z'),
    updatedAt: new Date('2026-02-01T10:00:00Z'),
    ...overrides,
  };

  return NewsArticle.reconstitute(defaultProps);
}

/**
 * Factory para crear múltiples artículos con IDs específicos
 */
function createMockArticles(count: number): NewsArticle[] {
  const articles: NewsArticle[] = [];

  for (let i = 1; i <= count; i++) {
    articles.push(
      createMockArticle({
        id: `article-${i}`,
        title: `Article ${i} About Technology`,
        description: `Description for article ${i}`,
        url: `https://example.com/article-${i}`,
        source: `Source ${i}`,
        biasScore: i * 10,
        summary: `Summary for article ${i}`,
      })
    );
  }

  return articles;
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('SearchNewsUseCase - Semantic Search (ZONA ESTÁNDAR)', () => {
  let useCase: SearchNewsUseCase;

  beforeEach(() => {
    // Limpiar todos los mocks antes de cada test
    vi.clearAllMocks();

    // Instanciar el caso de uso con las dependencias mockeadas
    useCase = new SearchNewsUseCase(
      mockArticleRepository as any,
      mockGeminiClient as any,
      mockChromaClient as any
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GRUPO 1: VALIDACIÓN DE INPUTS (ZONA ESTÁNDAR - 80%)
  // ==========================================================================

  describe('🔒 Validación de Inputs', () => {
    it('VALIDACIÓN: lanza ValidationError si query está vacío', async () => {
      // ACT & ASSERT
      await expect(
        useCase.execute({ query: '' })
      ).rejects.toThrow(ValidationError);

      await expect(
        useCase.execute({ query: '  ' })
      ).rejects.toThrow('Search query must be at least 2 characters');

      // Verificar que NO se llamó a Gemini
      expect(mockGeminiClient.generateEmbedding).not.toHaveBeenCalled();
    });

    it('VALIDACIÓN: lanza ValidationError si query es muy corto (<2 chars)', async () => {
      // ACT & ASSERT
      await expect(
        useCase.execute({ query: 'a' })
      ).rejects.toThrow(ValidationError);

      await expect(
        useCase.execute({ query: 'a' })
      ).rejects.toThrow('Search query must be at least 2 characters');
    });

    it('VALIDACIÓN: lanza ValidationError si limit < 1', async () => {
      // ACT & ASSERT
      await expect(
        useCase.execute({ query: 'test query', limit: 0 })
      ).rejects.toThrow(ValidationError);

      await expect(
        useCase.execute({ query: 'test query', limit: -5 })
      ).rejects.toThrow('Limit must be between 1 and 50');
    });

    it('VALIDACIÓN: lanza ValidationError si limit > 50', async () => {
      // ACT & ASSERT
      await expect(
        useCase.execute({ query: 'test query', limit: 51 })
      ).rejects.toThrow(ValidationError);

      await expect(
        useCase.execute({ query: 'test query', limit: 100 })
      ).rejects.toThrow('Limit must be between 1 and 50');
    });
  });

  // ==========================================================================
  // GRUPO 2: BÚSQUEDA EXITOSA (ZONA ESTÁNDAR - 80%)
  // ==========================================================================

  describe('🔍 Búsqueda Semántica Exitosa', () => {
    it('BÚSQUEDA EXITOSA: debe devolver artículos ordenados por relevancia de ChromaDB', async () => {
      // ARRANGE
      const searchQuery = 'artificial intelligence applications';
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];

      // ChromaDB devuelve IDs ordenados por relevancia (score alto primero)
      const chromaOrderedIds = ['article-3', 'article-1', 'article-2'];

      // PostgreSQL devuelve artículos sin orden específico
      const articles = createMockArticles(3);

      mockGeminiClient.generateEmbedding.mockResolvedValueOnce(mockEmbedding);
      mockChromaClient.querySimilar.mockResolvedValueOnce(chromaOrderedIds);
      mockArticleRepository.findByIds.mockResolvedValueOnce(articles);

      // ACT
      const result = await useCase.execute({ query: searchQuery, limit: 10 });

      // ASSERT - Verificar flujo completo
      expect(mockGeminiClient.generateEmbedding).toHaveBeenCalledWith(searchQuery);
      expect(mockChromaClient.querySimilar).toHaveBeenCalledWith(mockEmbedding, 10);
      expect(mockArticleRepository.findByIds).toHaveBeenCalledWith(chromaOrderedIds);

      // ASSERT - Verificar resultado
      expect(result.query).toBe(searchQuery);
      expect(result.totalFound).toBe(3);
      expect(result.results).toHaveLength(3);

      // ✅ CRÍTICO: Verificar que el orden se preserva según ChromaDB (relevancia)
      expect(result.results[0].id).toBe('article-3'); // Más relevante según ChromaDB
      expect(result.results[1].id).toBe('article-1');
      expect(result.results[2].id).toBe('article-2'); // Menos relevante
    });

    it('LÍMITE PERSONALIZADO: debe respetar el límite especificado', async () => {
      // ARRANGE
      const mockEmbedding = [0.1, 0.2, 0.3];
      const chromaIds = ['article-1', 'article-2', 'article-3'];
      const articles = createMockArticles(3);

      mockGeminiClient.generateEmbedding.mockResolvedValueOnce(mockEmbedding);
      mockChromaClient.querySimilar.mockResolvedValueOnce(chromaIds);
      mockArticleRepository.findByIds.mockResolvedValueOnce(articles);

      // ACT - Buscar con límite de 3
      const result = await useCase.execute({ query: 'technology', limit: 3 });

      // ASSERT - Verificar que el límite se pasó a ChromaDB
      expect(mockChromaClient.querySimilar).toHaveBeenCalledWith(mockEmbedding, 3);
      expect(result.results).toHaveLength(3);
    });

    it('LÍMITE POR DEFECTO: debe usar límite de 10 si no se especifica', async () => {
      // ARRANGE
      const mockEmbedding = [0.1, 0.2];
      const chromaIds = ['article-1'];
      const articles = [createMockArticle({ id: 'article-1' })];

      mockGeminiClient.generateEmbedding.mockResolvedValueOnce(mockEmbedding);
      mockChromaClient.querySimilar.mockResolvedValueOnce(chromaIds);
      mockArticleRepository.findByIds.mockResolvedValueOnce(articles);

      // ACT - Sin especificar limit
      await useCase.execute({ query: 'news' });

      // ASSERT - Debe usar límite por defecto de 10
      expect(mockChromaClient.querySimilar).toHaveBeenCalledWith(mockEmbedding, 10);
    });

    it('ORDEN DE RELEVANCIA: debe preservar el orden exacto de ChromaDB', async () => {
      // ARRANGE
      const mockEmbedding = [0.5, 0.5, 0.5];

      // ChromaDB devuelve IDs en orden de relevancia específico
      const chromaOrderedIds = ['article-5', 'article-2', 'article-7', 'article-1'];

      // PostgreSQL devuelve en orden arbitrario (simulamos desorden)
      const articlesUnordered = [
        createMockArticle({ id: 'article-1', title: 'Article 1' }),
        createMockArticle({ id: 'article-2', title: 'Article 2' }),
        createMockArticle({ id: 'article-5', title: 'Article 5' }),
        createMockArticle({ id: 'article-7', title: 'Article 7' }),
      ];

      mockGeminiClient.generateEmbedding.mockResolvedValueOnce(mockEmbedding);
      mockChromaClient.querySimilar.mockResolvedValueOnce(chromaOrderedIds);
      mockArticleRepository.findByIds.mockResolvedValueOnce(articlesUnordered);

      // ACT
      const result = await useCase.execute({ query: 'search term' });

      // ASSERT - El orden debe coincidir EXACTAMENTE con ChromaDB
      expect(result.results[0].id).toBe('article-5'); // Primero en ChromaDB
      expect(result.results[1].id).toBe('article-2'); // Segundo
      expect(result.results[2].id).toBe('article-7'); // Tercero
      expect(result.results[3].id).toBe('article-1'); // Cuarto
    });
  });

  // ==========================================================================
  // GRUPO 3: SIN RESULTADOS Y EDGE CASES (ZONA ESTÁNDAR - 80%)
  // ==========================================================================

  describe('🚫 Sin Resultados y Edge Cases', () => {
    it('SIN RESULTADOS: debe devolver array vacío (no null, no error) si ChromaDB no encuentra nada', async () => {
      // ARRANGE
      const mockEmbedding = [0.1, 0.2, 0.3];

      mockGeminiClient.generateEmbedding.mockResolvedValueOnce(mockEmbedding);
      mockChromaClient.querySimilar.mockResolvedValueOnce([]); // Sin resultados

      // ACT
      const result = await useCase.execute({ query: 'query sin resultados' });

      // ASSERT 1: NO debe lanzar error
      expect(result).toBeDefined();

      // ASSERT 2: Debe devolver array vacío (NO null)
      expect(result.results).toEqual([]);
      expect(result.results).toHaveLength(0);

      // ASSERT 3: totalFound debe ser 0
      expect(result.totalFound).toBe(0);

      // ASSERT 4: query debe estar presente
      expect(result.query).toBe('query sin resultados');

      // ASSERT 5: NO debe llamar al repositorio (optimización)
      expect(mockArticleRepository.findByIds).not.toHaveBeenCalled();
    });

    it('RESULTADOS PARCIALES: si PostgreSQL no encuentra algunos IDs, debe filtrarlos', async () => {
      // ARRANGE
      const mockEmbedding = [0.1, 0.2];

      // ChromaDB devuelve 4 IDs
      const chromaIds = ['article-1', 'article-2', 'article-3', 'article-4'];

      // PostgreSQL solo encuentra 2 (otros fueron borrados)
      const articlesFound = [
        createMockArticle({ id: 'article-1' }),
        createMockArticle({ id: 'article-3' }),
      ];

      mockGeminiClient.generateEmbedding.mockResolvedValueOnce(mockEmbedding);
      mockChromaClient.querySimilar.mockResolvedValueOnce(chromaIds);
      mockArticleRepository.findByIds.mockResolvedValueOnce(articlesFound);

      // ACT
      const result = await useCase.execute({ query: 'test' });

      // ASSERT - Solo debe devolver los artículos encontrados en PostgreSQL
      expect(result.results).toHaveLength(2);
      expect(result.results[0].id).toBe('article-1');
      expect(result.results[1].id).toBe('article-3');

      // El orden de relevancia se preserva (article-1 antes que article-3)
      expect(result.totalFound).toBe(2);
    });

    it('QUERY MÍNIMO VÁLIDO: debe funcionar con query de exactamente 2 caracteres', async () => {
      // ARRANGE
      const mockEmbedding = [0.1];
      const chromaIds = ['article-1'];
      const articles = [createMockArticle({ id: 'article-1' })];

      mockGeminiClient.generateEmbedding.mockResolvedValueOnce(mockEmbedding);
      mockChromaClient.querySimilar.mockResolvedValueOnce(chromaIds);
      mockArticleRepository.findByIds.mockResolvedValueOnce(articles);

      // ACT - Query de exactamente 2 chars (mínimo válido)
      const result = await useCase.execute({ query: 'AI' });

      // ASSERT - Debe funcionar sin errores
      expect(result).toBeDefined();
      expect(result.results).toHaveLength(1);
      expect(mockGeminiClient.generateEmbedding).toHaveBeenCalledWith('AI');
    });

    it('LÍMITE MÁXIMO: debe funcionar con límite de 50 (máximo permitido)', async () => {
      // ARRANGE
      const mockEmbedding = [0.1, 0.2];
      const chromaIds = ['article-1'];
      const articles = [createMockArticle({ id: 'article-1' })];

      mockGeminiClient.generateEmbedding.mockResolvedValueOnce(mockEmbedding);
      mockChromaClient.querySimilar.mockResolvedValueOnce(chromaIds);
      mockArticleRepository.findByIds.mockResolvedValueOnce(articles);

      // ACT - Límite máximo de 50
      await useCase.execute({ query: 'technology', limit: 50 });

      // ASSERT - Debe pasar límite de 50 a ChromaDB
      expect(mockChromaClient.querySimilar).toHaveBeenCalledWith(mockEmbedding, 50);
    });
  });

  // ==========================================================================
  // GRUPO 4: FLUJO COMPLETO (ZONA ESTÁNDAR - 80%)
  // ==========================================================================

  describe('🔄 Flujo Completo End-to-End', () => {
    it('E2E: debe ejecutar el flujo completo embedding → vector search → hydration', async () => {
      // ARRANGE
      const searchQuery = 'climate change solutions';
      const mockEmbedding = [0.8, 0.2, 0.5, 0.3];
      const chromaIds = ['article-10', 'article-5'];

      const articles = [
        createMockArticle({
          id: 'article-10',
          title: 'Climate Change Solutions for 2026',
          biasScore: 10,
        }),
        createMockArticle({
          id: 'article-5',
          title: 'Renewable Energy Advances',
          biasScore: 20,
        }),
      ];

      mockGeminiClient.generateEmbedding.mockResolvedValueOnce(mockEmbedding);
      mockChromaClient.querySimilar.mockResolvedValueOnce(chromaIds);
      mockArticleRepository.findByIds.mockResolvedValueOnce(articles);

      // ACT
      const result = await useCase.execute({ query: searchQuery, limit: 5 });

      // ASSERT - Verificar orden de llamadas
      expect(mockGeminiClient.generateEmbedding).toHaveBeenCalledBefore(
        mockChromaClient.querySimilar as any
      );
      expect(mockChromaClient.querySimilar).toHaveBeenCalledBefore(
        mockArticleRepository.findByIds as any
      );

      // ASSERT - Verificar resultado final
      expect(result.query).toBe(searchQuery);
      expect(result.totalFound).toBe(2);
      expect(result.results[0].title).toBe('Climate Change Solutions for 2026');
      expect(result.results[1].title).toBe('Renewable Energy Advances');
    });
  });
});
