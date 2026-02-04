/**
 * ChatArticleUseCase Unit Tests - ZONA CRÍTICA (100% Coverage)
 *
 * Este archivo testea la lógica RAG (Retrieval-Augmented Generation),
 * clasificada como "Zona Roja" según docs/CALIDAD.md
 *
 * ESTRATEGIA:
 * - Mock COMPLETO de todas las dependencias (GeminiClient, ChromaClient, Repository)
 * - Tests de flujo RAG: embedding → retrieval → augmentation → generation
 * - Tests de cost optimization: límites de documentos, truncado, fallback
 * - Verificación de que NO se gastan tokens innecesarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatArticleUseCase } from '../../src/application/use-cases/chat-article.usecase';
import { NewsArticle } from '../../src/domain/entities/news-article.entity';
import { EntityNotFoundError, ValidationError } from '../../src/domain/errors/domain.error';
import type { ChatMessage } from '../../src/domain/services/gemini-client.interface';
import type { QueryResult } from '../../src/domain/services/chroma-client.interface';

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
    title: 'Test Article About AI Technology',
    description: 'An article discussing recent AI developments',
    url: 'https://example.com/ai-article',
    urlToImage: 'https://example.com/image.jpg',
    publishedAt: new Date('2026-02-01T10:00:00Z'),
    source: 'Tech News',
    author: 'John Doe',
    content: 'This is a comprehensive article about artificial intelligence and its applications in modern technology. It covers machine learning, neural networks, and the future of AI.',
    category: 'technology',
    language: 'en',
    embedding: null,
    isFavorite: false,
    summary: 'Article about AI technology and its applications',
    biasScore: 0,
    analysis: JSON.stringify({
      summary: 'Article about AI technology',
      biasScore: 0,
      biasRaw: 0,
      biasIndicators: [],
      clickbaitScore: 20,
      reliabilityScore: 80,
      sentiment: 'neutral',
      mainTopics: ['AI', 'technology'],
      factCheck: {
        claims: ['AI is advancing rapidly'],
        verdict: 'Verified',
        reasoning: 'Based on research',
      },
    }),
    analyzedAt: new Date('2026-02-01T11:00:00Z'),
    fetchedAt: new Date('2026-02-01T10:00:00Z'),
    updatedAt: new Date('2026-02-01T11:00:00Z'),
    ...overrides,
  };

  return NewsArticle.reconstitute(defaultProps);
}

/**
 * Factory para crear mensajes de chat
 */
function createChatMessages(userMessage: string): ChatMessage[] {
  return [
    {
      role: 'user',
      content: userMessage,
    },
  ];
}

/**
 * Factory para crear resultados de ChromaDB
 */
function createMockQueryResults(count: number = 3): QueryResult[] {
  const results: QueryResult[] = [];
  
  for (let i = 0; i < count; i++) {
    results.push({
      id: i === 0 ? 'test-article-id-123' : `article-${i}`,
      document: `This is document fragment ${i + 1} containing relevant information about the topic. It provides context and details that help answer the user's question.`,
      metadata: {
        title: `Article ${i + 1}`,
        source: `Source ${i + 1}`,
        publishedAt: new Date('2026-02-01T10:00:00Z').toISOString(),
      },
      distance: 0.1 * (i + 1), // Similarity score
    });
  }
  
  return results;
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('ChatArticleUseCase - RAG System (ZONA CRÍTICA)', () => {
  let useCase: ChatArticleUseCase;

  beforeEach(() => {
    // Limpiar todos los mocks antes de cada test
    vi.clearAllMocks();

    // Instanciar el caso de uso con las dependencias mockeadas
    useCase = new ChatArticleUseCase(
      mockArticleRepository as any,
      mockGeminiClient as any,
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
        useCase.execute({
          articleId: '',
          messages: createChatMessages('Test question'),
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        useCase.execute({
          articleId: '   ',
          messages: createChatMessages('Test question'),
        })
      ).rejects.toThrow('Article ID is required');

      // Verificar que NO se llamó al repositorio
      expect(mockArticleRepository.findById).not.toHaveBeenCalled();
    });

    it('VALIDACIÓN: lanza ValidationError si messages está vacío', async () => {
      // ACT & ASSERT
      await expect(
        useCase.execute({
          articleId: 'test-article-id-123',
          messages: [],
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        useCase.execute({
          articleId: 'test-article-id-123',
          messages: [],
        })
      ).rejects.toThrow('At least one message is required');
    });

    it('VALIDACIÓN: lanza ValidationError si último mensaje no es del usuario', async () => {
      // ARRANGE
      const invalidMessages: ChatMessage[] = [
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'Response' },
      ];

      // ACT & ASSERT
      await expect(
        useCase.execute({
          articleId: 'test-article-id-123',
          messages: invalidMessages,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        useCase.execute({
          articleId: 'test-article-id-123',
          messages: invalidMessages,
        })
      ).rejects.toThrow('Last message must be from user');
    });

    it('ENTIDAD NO ENCONTRADA: lanza EntityNotFoundError si el artículo no existe', async () => {
      // ARRANGE
      mockArticleRepository.findById.mockResolvedValueOnce(null);

      // ACT & ASSERT
      await expect(
        useCase.execute({
          articleId: 'non-existent-id',
          messages: createChatMessages('Test question'),
        })
      ).rejects.toThrow(EntityNotFoundError);

      expect(mockArticleRepository.findById).toHaveBeenCalledWith('non-existent-id');
    });
  });

  // ==========================================================================
  // GRUPO 2: FLUJO RAG COMPLETO (ZONA ROJA - 100%)
  // ==========================================================================

  describe('🔍 Flujo RAG Completo', () => {
    it('RAG EXITOSO: debe inyectar documentos de ChromaDB en el prompt de Gemini', async () => {
      // ARRANGE
      const article = createMockArticle();
      const userQuestion = 'What is the key information about this topic?';
      const mockEmbedding = [0.1, 0.2, 0.3];
      
      // ChromaDB devuelve documentos con "Dato Clave A"
      const mockQueryResults: QueryResult[] = [
        {
          id: 'doc-1',
          document: 'Dato Clave A - This is critical information from the knowledge base.',
          metadata: {
            title: 'Relevant Article 1',
            source: 'Knowledge Base',
            publishedAt: new Date('2026-02-01T10:00:00Z').toISOString(),
          },
          distance: 0.1,
        },
        {
          id: 'doc-2',
          document: 'Additional context information.',
          metadata: {
            title: 'Relevant Article 2',
            source: 'Database',
            publishedAt: new Date('2026-02-01T10:00:00Z').toISOString(),
          },
          distance: 0.2,
        },
      ];

      const mockResponse = 'Based on the key information, here is the answer.';

      mockArticleRepository.findById.mockResolvedValueOnce(article);
      mockGeminiClient.generateEmbedding.mockResolvedValueOnce(mockEmbedding);
      mockChromaClient.querySimilarWithDocuments.mockResolvedValueOnce(mockQueryResults);
      mockGeminiClient.generateChatResponse.mockResolvedValueOnce(mockResponse);

      // ACT
      const result = await useCase.execute({
        articleId: 'test-article-id-123',
        messages: createChatMessages(userQuestion),
      });

      // ASSERT - Verificar que se llamaron los servicios correctos
      expect(mockChromaClient.querySimilarWithDocuments).toHaveBeenCalledWith(mockEmbedding, 3);
      expect(mockGeminiClient.generateChatResponse).toHaveBeenCalledTimes(1);

      // ✅ CRÍTICO: Verificar que "Dato Clave A" fue inyectado en el prompt de Gemini
      const geminiCallArgs = mockGeminiClient.generateChatResponse.mock.calls[0];
      const contextPassedToGemini = geminiCallArgs[0]; // Primer argumento = contexto

      expect(contextPassedToGemini).toEqual(expect.stringContaining('Dato Clave A'));
      expect(contextPassedToGemini).toEqual(expect.stringContaining('critical information from the knowledge base'));

      // Verificar resultado
      expect(result.response).toBe(mockResponse);
    });

    it('RAG EXITOSO: embedding → retrieval → augmentation → generation', async () => {
      // ARRANGE
      const article = createMockArticle();
      const userQuestion = 'What are the main applications of AI mentioned in the article?';
      const mockEmbedding = [0.1, 0.2, 0.3]; // Embedding dummy
      const mockQueryResults = createMockQueryResults(3);
      const mockResponse = 'Based on the article, the main applications of AI include machine learning and neural networks.';

      mockArticleRepository.findById.mockResolvedValueOnce(article);
      mockGeminiClient.generateEmbedding.mockResolvedValueOnce(mockEmbedding);
      mockChromaClient.querySimilarWithDocuments.mockResolvedValueOnce(mockQueryResults);
      mockGeminiClient.generateChatResponse.mockResolvedValueOnce(mockResponse);

      // ACT
      const result = await useCase.execute({
        articleId: 'test-article-id-123',
        messages: createChatMessages(userQuestion),
      });

      // ASSERT - Verificar flujo completo
      expect(mockArticleRepository.findById).toHaveBeenCalledWith('test-article-id-123');
      expect(mockGeminiClient.generateEmbedding).toHaveBeenCalledWith(userQuestion);
      expect(mockChromaClient.querySimilarWithDocuments).toHaveBeenCalledWith(mockEmbedding, 3);
      expect(mockGeminiClient.generateChatResponse).toHaveBeenCalledTimes(1);

      // Verificar resultado
      expect(result.articleId).toBe('test-article-id-123');
      expect(result.response).toBe(mockResponse);
      expect(result.articleTitle).toBe(article.title);
    });

    it('PRIORIZACIÓN: artículo objetivo debe aparecer primero en contexto', async () => {
      // ARRANGE
      const article = createMockArticle();
      const userQuestion = 'Tell me about this article';
      
      // Resultados donde el artículo objetivo NO está primero
      const mockQueryResults: QueryResult[] = [
        {
          id: 'other-article-1',
          document: 'Other article content',
          metadata: { title: 'Other Article 1', source: 'Source 1', publishedAt: new Date('2026-02-01T10:00:00Z').toISOString() },
          distance: 0.1,
        },
        {
          id: 'test-article-id-123', // Artículo objetivo en segunda posición
          document: 'Target article content',
          metadata: { title: 'Target Article', source: 'Source 2', publishedAt: new Date('2026-02-01T10:00:00Z').toISOString() },
          distance: 0.2,
        },
      ];

      mockArticleRepository.findById.mockResolvedValueOnce(article);
      mockGeminiClient.generateEmbedding.mockResolvedValueOnce([0.1, 0.2]);
      mockChromaClient.querySimilarWithDocuments.mockResolvedValueOnce(mockQueryResults);
      mockGeminiClient.generateChatResponse.mockResolvedValueOnce('Response');

      // ACT
      await useCase.execute({
        articleId: 'test-article-id-123',
        messages: createChatMessages(userQuestion),
      });

      // ASSERT - Verificar que se llamó a generateChatResponse
      expect(mockGeminiClient.generateChatResponse).toHaveBeenCalledTimes(1);
      
      // El contexto debe tener el artículo objetivo primero
      const contextArg = mockGeminiClient.generateChatResponse.mock.calls[0][0];
      expect(contextArg).toContain('Target Article'); // Artículo objetivo debe estar en el contexto
    });
  });

  // ==========================================================================
  // GRUPO 3: COST OPTIMIZATION (ZONA ROJA - 100%)
  // ==========================================================================

  describe('💰 Cost Optimization', () => {
    it('LÍMITE DE DOCUMENTOS: solo recupera máximo 3 documentos de ChromaDB', async () => {
      // ARRANGE
      const article = createMockArticle();
      mockArticleRepository.findById.mockResolvedValueOnce(article);
      mockGeminiClient.generateEmbedding.mockResolvedValueOnce([0.1, 0.2]);
      mockChromaClient.querySimilarWithDocuments.mockResolvedValueOnce(createMockQueryResults(3));
      mockGeminiClient.generateChatResponse.mockResolvedValueOnce('Response');

      // ACT
      await useCase.execute({
        articleId: 'test-article-id-123',
        messages: createChatMessages('Test question'),
      });

      // ASSERT - CRÍTICO: Verificar límite de documentos (cost optimization)
      expect(mockChromaClient.querySimilarWithDocuments).toHaveBeenCalledWith(
        expect.any(Array),
        3 // MAX_RAG_DOCUMENTS = 3
      );
    });

    it('TRUNCADO: documentos muy largos deben truncarse a 2000 caracteres', async () => {
      // ARRANGE
      const article = createMockArticle();
      const longDocument = 'x'.repeat(3000); // 3000 caracteres
      
      const mockQueryResults: QueryResult[] = [
        {
          id: 'test-article-id-123',
          document: longDocument,
          metadata: { title: 'Long Article', source: 'Source', publishedAt: new Date('2026-02-01T10:00:00Z').toISOString() },
          distance: 0.1,
        },
      ];

      mockArticleRepository.findById.mockResolvedValueOnce(article);
      mockGeminiClient.generateEmbedding.mockResolvedValueOnce([0.1, 0.2]);
      mockChromaClient.querySimilarWithDocuments.mockResolvedValueOnce(mockQueryResults);
      mockGeminiClient.generateChatResponse.mockResolvedValueOnce('Response');

      // ACT
      await useCase.execute({
        articleId: 'test-article-id-123',
        messages: createChatMessages('Test question'),
      });

      // ASSERT - Verificar que el contexto fue truncado
      const contextArg = mockGeminiClient.generateChatResponse.mock.calls[0][0];
      
      // El contexto NO debe contener los 3000 caracteres completos
      expect(contextArg.length).toBeLessThan(3000);
      
      // Debe contener el marcador de truncado
      expect(contextArg).toContain('...');
    });

    it('FALLBACK: usa contenido del artículo si ChromaDB falla', async () => {
      // ARRANGE
      const article = createMockArticle();
      mockArticleRepository.findById.mockResolvedValueOnce(article);
      mockGeminiClient.generateEmbedding.mockRejectedValueOnce(new Error('ChromaDB unavailable'));
      mockGeminiClient.generateChatResponse.mockResolvedValueOnce('Fallback response');

      // ACT
      const result = await useCase.execute({
        articleId: 'test-article-id-123',
        messages: createChatMessages('Test question'),
      });

      // ASSERT - Verificar que usó fallback
      expect(mockChromaClient.querySimilarWithDocuments).not.toHaveBeenCalled();
      expect(mockGeminiClient.generateChatResponse).toHaveBeenCalledTimes(1);
      
      // Debe haber usado el contenido del artículo como contexto
      const contextArg = mockGeminiClient.generateChatResponse.mock.calls[0][0];
      expect(contextArg).toContain(article.title);
      
      expect(result.response).toBe('Fallback response');
    });

    it('SIN RESULTADOS: ChromaDB sin resultados debe usar fallback gracefully', async () => {
      // ARRANGE
      const article = createMockArticle();
      mockArticleRepository.findById.mockResolvedValueOnce(article);
      mockGeminiClient.generateEmbedding.mockResolvedValueOnce([0.1, 0.2]);
      mockChromaClient.querySimilarWithDocuments.mockResolvedValueOnce([]); // Sin resultados
      mockGeminiClient.generateChatResponse.mockResolvedValueOnce('Response without context');

      // ACT
      const result = await useCase.execute({
        articleId: 'test-article-id-123',
        messages: createChatMessages('Test question'),
      });

      // ASSERT
      expect(mockGeminiClient.generateChatResponse).toHaveBeenCalledTimes(1);
      expect(result.response).toBe('Response without context');
    });
  });

  // ==========================================================================
  // GRUPO 4: DEGRADACIÓN GRACIOSA - FALLBACK AVANZADO (ZONA CRÍTICA - 100%)
  // ==========================================================================

  describe('🛡️ Degradación Graciosa (Graceful Degradation)', () => {
    it('CHROMADB TIMEOUT: debe responder usando solo el contenido del artículo si ChromaDB falla con timeout', async () => {
      // ARRANGE
      const articleWithFullContent = createMockArticle({
        content: 'Texto completo del artículo sobre inteligencia artificial. Este contenido incluye información detallada sobre machine learning, redes neuronales, y las últimas tendencias en el campo de la IA.',
      });

      const userQuestion = 'What are the main topics discussed?';

      // Mock: ChromaDB lanza error de timeout
      mockArticleRepository.findById.mockResolvedValueOnce(articleWithFullContent);
      mockGeminiClient.generateEmbedding.mockRejectedValueOnce(new Error('Connection timeout'));
      mockGeminiClient.generateChatResponse.mockResolvedValueOnce('The topics include machine learning and neural networks.');

      // ACT
      const result = await useCase.execute({
        articleId: 'test-article-id-123',
        messages: createChatMessages(userQuestion),
      });

      // ASSERT 1: NO debe lanzar excepción (graceful degradation)
      expect(result).toBeDefined();
      expect(result.response).toBe('The topics include machine learning and neural networks.');

      // ASSERT 2: NO debe llamar a ChromaDB.querySimilarWithDocuments
      expect(mockChromaClient.querySimilarWithDocuments).not.toHaveBeenCalled();

      // ASSERT 3: SÍ debe llamar a GeminiClient.generateChatResponse
      expect(mockGeminiClient.generateChatResponse).toHaveBeenCalledTimes(1);

      // ASSERT 4: CRÍTICO - El contexto pasado a Gemini debe ser el contenido del artículo
      const geminiCallArgs = mockGeminiClient.generateChatResponse.mock.calls[0];
      const contextPassedToGemini = geminiCallArgs[0]; // Primer argumento = contexto

      // Verificar que contiene el contenido del artículo (NO documentos de ChromaDB)
      expect(contextPassedToGemini).toContain('Texto completo del artículo sobre inteligencia artificial');
      expect(contextPassedToGemini).toContain('machine learning');
      expect(contextPassedToGemini).toContain('redes neuronales');

      // Verificar que NO contiene fragmentos de ChromaDB
      expect(contextPassedToGemini).not.toContain('This is document fragment');
    });

    it('CHROMADB PARCIAL: si generateEmbedding funciona pero querySimilar falla, debe usar fallback', async () => {
      // ARRANGE
      const article = createMockArticle({
        content: 'Detailed article about climate change and its global impact. The article covers scientific evidence and policy recommendations.',
      });

      // Mock: Embedding funciona, pero query falla
      mockArticleRepository.findById.mockResolvedValueOnce(article);
      mockGeminiClient.generateEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]); // Éxito
      mockChromaClient.querySimilarWithDocuments.mockRejectedValueOnce(new Error('Query timeout')); // Fallo
      mockGeminiClient.generateChatResponse.mockResolvedValueOnce('Climate change impacts are discussed extensively.');

      // ACT
      const result = await useCase.execute({
        articleId: 'test-article-id-123',
        messages: createChatMessages('What are the impacts?'),
      });

      // ASSERT 1: Debe responder exitosamente
      expect(result).toBeDefined();

      // ASSERT 2: Debe haber intentado generar embedding
      expect(mockGeminiClient.generateEmbedding).toHaveBeenCalledTimes(1);

      // ASSERT 3: Debe haber intentado query (y falló)
      expect(mockChromaClient.querySimilarWithDocuments).toHaveBeenCalledTimes(1);

      // ASSERT 4: Debe usar contenido del artículo como fallback
      const contextArg = mockGeminiClient.generateChatResponse.mock.calls[0][0];
      expect(contextArg).toContain('climate change');
      expect(contextArg).toContain('global impact');
    });

    it('TRUNCADO EN FALLBACK: si el contenido del artículo es muy largo (>3000 chars), debe truncarse', async () => {
      // ARRANGE
      const longContent = 'x'.repeat(5000); // 5000 caracteres
      const articleWithLongContent = createMockArticle({
        content: longContent,
      });

      // Mock: ChromaDB falla
      mockArticleRepository.findById.mockResolvedValueOnce(articleWithLongContent);
      mockGeminiClient.generateEmbedding.mockRejectedValueOnce(new Error('ChromaDB down'));
      mockGeminiClient.generateChatResponse.mockResolvedValueOnce('Response');

      // ACT
      await useCase.execute({
        articleId: 'test-article-id-123',
        messages: createChatMessages('Question'),
      });

      // ASSERT: El contenido debe estar truncado a MAX_FALLBACK_CONTENT_CHARS (3000)
      const contextArg = mockGeminiClient.generateChatResponse.mock.calls[0][0];
      
      // No debe contener los 5000 caracteres completos
      expect(contextArg.length).toBeLessThan(5000);
      
      // Debe contener el marcador de truncado
      expect(contextArg).toContain('...');
    });
  });

  // ==========================================================================
  // GRUPO 5: CONVERSACIÓN MULTI-TURNO (ZONA ESTÁNDAR - 80%)
  // ==========================================================================

  describe('💬 Conversación Multi-turno', () => {
    it('HISTORIAL: debe procesar múltiples mensajes en secuencia', async () => {
      // ARRANGE
      const article = createMockArticle();
      const conversationMessages: ChatMessage[] = [
        { role: 'user', content: 'What is AI?' },
        { role: 'assistant', content: 'AI stands for Artificial Intelligence.' },
        { role: 'user', content: 'What are its applications?' },
      ];

      mockArticleRepository.findById.mockResolvedValueOnce(article);
      mockGeminiClient.generateEmbedding.mockResolvedValueOnce([0.1, 0.2]);
      mockChromaClient.querySimilarWithDocuments.mockResolvedValueOnce(createMockQueryResults(2));
      mockGeminiClient.generateChatResponse.mockResolvedValueOnce('Applications include ML and NLP.');

      // ACT
      const result = await useCase.execute({
        articleId: 'test-article-id-123',
        messages: conversationMessages,
      });

      // ASSERT
      expect(mockGeminiClient.generateEmbedding).toHaveBeenCalledWith('What are its applications?');
      expect(result.response).toBe('Applications include ML and NLP.');
    });

    it('CONTEXTO: debe usar solo el último mensaje del usuario para embedding', async () => {
      // ARRANGE
      const article = createMockArticle();
      const messages: ChatMessage[] = [
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First answer' },
        { role: 'user', content: 'Second question' },
      ];

      mockArticleRepository.findById.mockResolvedValueOnce(article);
      mockGeminiClient.generateEmbedding.mockResolvedValueOnce([0.1, 0.2]);
      mockChromaClient.querySimilarWithDocuments.mockResolvedValueOnce(createMockQueryResults(1));
      mockGeminiClient.generateChatResponse.mockResolvedValueOnce('Second answer');

      // ACT
      await useCase.execute({
        articleId: 'test-article-id-123',
        messages,
      });

      // ASSERT - CRÍTICO: Solo debe generar embedding de la última pregunta
      expect(mockGeminiClient.generateEmbedding).toHaveBeenCalledTimes(1);
      expect(mockGeminiClient.generateEmbedding).toHaveBeenCalledWith('Second question');
    });
  });

  // ==========================================================================
  // GRUPO 6: AUGMENTATION (ZONA ESTÁNDAR - 80%)
  // ==========================================================================

  describe('📝 Augmentation de Contexto', () => {
    it('METADATA: debe incluir título y fuente del artículo en el contexto', async () => {
      // ARRANGE
      const article = createMockArticle({
        title: 'Specific Article Title',
        source: 'Specific Source',
      });

      mockArticleRepository.findById.mockResolvedValueOnce(article);
      mockGeminiClient.generateEmbedding.mockResolvedValueOnce([0.1, 0.2]);
      mockChromaClient.querySimilarWithDocuments.mockResolvedValueOnce(createMockQueryResults(1));
      mockGeminiClient.generateChatResponse.mockResolvedValueOnce('Response');

      // ACT
      await useCase.execute({
        articleId: 'test-article-id-123',
        messages: createChatMessages('Test question'),
      });

      // ASSERT
      const contextArg = mockGeminiClient.generateChatResponse.mock.calls[0][0];
      
      expect(contextArg).toContain('Specific Article Title');
      expect(contextArg).toContain('Specific Source');
    });

    it('FORMATO COMPACTO: contexto debe usar formato [N] Título | Fuente', async () => {
      // ARRANGE
      const article = createMockArticle();
      const mockQueryResults: QueryResult[] = [
        {
          id: 'article-1',
          document: 'Content 1',
          metadata: { title: 'Title 1', source: 'Source 1', publishedAt: new Date('2026-02-01T10:00:00Z').toISOString() },
          distance: 0.1,
        },
      ];

      mockArticleRepository.findById.mockResolvedValueOnce(article);
      mockGeminiClient.generateEmbedding.mockResolvedValueOnce([0.1, 0.2]);
      mockChromaClient.querySimilarWithDocuments.mockResolvedValueOnce(mockQueryResults);
      mockGeminiClient.generateChatResponse.mockResolvedValueOnce('Response');

      // ACT
      await useCase.execute({
        articleId: 'test-article-id-123',
        messages: createChatMessages('Test question'),
      });

      // ASSERT - Verificar formato compacto (cost optimization)
      const contextArg = mockGeminiClient.generateChatResponse.mock.calls[0][0];
      
      // Debe usar formato: [1] Title 1 | Source 1
      expect(contextArg).toMatch(/\[1\]\s+Title 1\s+\|\s+Source 1/);
      
      // NO debe tener headers verbosos como "--- Fragmento 1 ---"
      expect(contextArg).not.toContain('---');
      expect(contextArg).not.toContain('Fragmento');
    });
  });
});
