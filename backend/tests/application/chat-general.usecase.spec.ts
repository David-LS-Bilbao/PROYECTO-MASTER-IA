/**
 * ChatGeneralUseCase Unit Tests - ZONA ESTANDAR (80% Coverage)
 *
 * Verifica validaciones, RAG general y fallback a BD.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatGeneralUseCase } from '../../src/application/use-cases/chat-general.usecase';
import { NewsArticle } from '../../src/domain/entities/news-article.entity';
import { ValidationError } from '../../src/domain/errors/domain.error';
import type { ChatMessage } from '../../src/domain/services/gemini-client.interface';
import type { QueryResult } from '../../src/domain/services/chroma-client.interface';

// ============================================================================
// MOCKS
// ============================================================================

const mockGeminiClient = {
  generateChatResponse: vi.fn(),
  generateEmbedding: vi.fn(),
};

const mockChromaClient = {
  querySimilarWithDocuments: vi.fn(),
};

const mockNewsRepository = {
  findAll: vi.fn(),
};

// ============================================================================
// TEST DATA
// ============================================================================

function createChatMessages(userMessage: string): ChatMessage[] {
  return [{ role: 'user', content: userMessage }];
}

function createMockQueryResults(): QueryResult[] {
  return [
    {
      id: 'article-1',
      document: 'Context snippet about a topic in the news.',
      metadata: {
        title: 'Article Title 1',
        source: 'Source 1',
        publishedAt: new Date('2026-02-01T10:00:00Z').toISOString(),
      },
      distance: 0.1,
    },
    {
      id: 'article-2',
      document: 'Additional context snippet for the same topic.',
      metadata: {
        title: 'Article Title 2',
        source: 'Source 2',
        publishedAt: new Date('2026-02-01T10:00:00Z').toISOString(),
      },
      distance: 0.2,
    },
  ];
}

function createMockArticle(overrides: Partial<Record<string, unknown>> = {}): NewsArticle {
  return NewsArticle.reconstitute({
    id: 'news-1',
    title: 'Recent News Title',
    description: 'Short description',
    content: 'Full content',
    url: 'https://example.com/news-1',
    urlToImage: null,
    source: 'Local Source',
    author: null,
    publishedAt: new Date('2026-02-01T10:00:00Z'),
    category: 'general',
    language: 'es',
    embedding: null,
    summary: 'Summary of the article',
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

describe('ChatGeneralUseCase', () => {
  let useCase: ChatGeneralUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ChatGeneralUseCase(
      mockGeminiClient as any,
      mockChromaClient as any,
      mockNewsRepository as any
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========================================================================
  // VALIDATION
  // ========================================================================

  it('lanza ValidationError si messages esta vacio', async () => {
    await expect(useCase.execute({ messages: [] })).rejects.toBeInstanceOf(ValidationError);
    await expect(useCase.execute({ messages: [] })).rejects.toThrow('At least one message is required');
  });

  it('lanza ValidationError si el ultimo mensaje no es del usuario', async () => {
    const invalidMessages: ChatMessage[] = [
      { role: 'user', content: 'Question 1' },
      { role: 'assistant', content: 'Answer' },
    ];

    await expect(useCase.execute({ messages: invalidMessages })).rejects.toBeInstanceOf(ValidationError);
    await expect(useCase.execute({ messages: invalidMessages })).rejects.toThrow('Last message must be from user');
  });

  // ========================================================================
  // HAPPY PATH (RAG)
  // ========================================================================

  it('RAG exitoso: genera embedding, recupera contexto y responde', async () => {
    const userQuestion = 'What is happening with the topic today?';
    const mockEmbedding = [0.1, 0.2, 0.3];
    const mockResults = createMockQueryResults();

    mockGeminiClient.generateEmbedding.mockResolvedValueOnce(mockEmbedding);
    mockChromaClient.querySimilarWithDocuments.mockResolvedValueOnce(mockResults);
    mockGeminiClient.generateChatResponse.mockResolvedValueOnce('Final response');

    const result = await useCase.execute({ messages: createChatMessages(userQuestion) });

    expect(mockGeminiClient.generateEmbedding).toHaveBeenCalledWith(userQuestion);
    expect(mockChromaClient.querySimilarWithDocuments).toHaveBeenCalledWith(mockEmbedding, 5);
    expect(mockGeminiClient.generateChatResponse).toHaveBeenCalledTimes(1);

    const contextArg = mockGeminiClient.generateChatResponse.mock.calls[0][0];
    expect(contextArg).toContain('[1] Article Title 1 | Source 1 -');
    expect(contextArg).toContain('Context snippet about a topic in the news.');

    expect(result.response).toBe('Final response');
    expect(result.sourcesCount).toBe(2);
  });

  // ========================================================================
  // FALLBACK
  // ========================================================================

  it('fallback: usa BD si Chroma falla', async () => {
    const articles = [
      createMockArticle({ id: 'news-1' }),
      createMockArticle({ id: 'news-2', url: 'https://example.com/news-2' }),
    ];

    mockGeminiClient.generateEmbedding.mockRejectedValueOnce(new Error('Chroma down'));
    mockNewsRepository.findAll.mockResolvedValueOnce(articles);
    mockGeminiClient.generateChatResponse.mockResolvedValueOnce('Fallback response');

    const result = await useCase.execute({ messages: createChatMessages('Any updates?') });

    expect(mockNewsRepository.findAll).toHaveBeenCalledWith({
      limit: 5,
      offset: 0,
      category: undefined,
      userId: undefined,
    });
    expect(mockGeminiClient.generateChatResponse).toHaveBeenCalledTimes(1);

    const contextArg = mockGeminiClient.generateChatResponse.mock.calls[0][0];
    expect(contextArg).toContain('Summary of the article');

    expect(result.sourcesCount).toBe(2);
  });

  it('fallback: si BD tambien falla, lanza ValidationError', async () => {
    mockGeminiClient.generateEmbedding.mockRejectedValueOnce(new Error('Chroma down'));
    mockNewsRepository.findAll.mockResolvedValueOnce([]);

    await expect(useCase.execute({ messages: createChatMessages('Any updates?') })).rejects.toBeInstanceOf(ValidationError);
    await expect(useCase.execute({ messages: createChatMessages('Any updates?') })).rejects.toThrow(
      'No se pueden recuperar noticias en este momento.'
    );
  });
});

