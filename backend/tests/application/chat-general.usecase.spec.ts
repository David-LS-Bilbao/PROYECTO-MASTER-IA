/**
 * ChatGeneralUseCase Unit Tests
 *
 * Sprint 27.4: Chat General usa conocimiento completo de Gemini (NO RAG)
 * Verifica validaciones y llamada directa a generateGeneralResponse.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatGeneralUseCase } from '../../src/application/use-cases/chat-general.usecase';
import { ValidationError } from '../../src/domain/errors/domain.error';
import type { ChatMessage } from '../../src/domain/services/gemini-client.interface';

// ============================================================================
// MOCKS
// ============================================================================

const mockGeminiClient = {
  generateGeneralResponse: vi.fn(),
  generateChatResponse: vi.fn(),
  generateEmbedding: vi.fn(),
  analyzeArticle: vi.fn(),
  chatWithContext: vi.fn(),
  isAvailable: vi.fn(),
  discoverRssUrl: vi.fn(),
};

// ============================================================================
// TEST DATA
// ============================================================================

function createChatMessages(userMessage: string): ChatMessage[] {
  return [{ role: 'user', content: userMessage }];
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('ChatGeneralUseCase', () => {
  let useCase: ChatGeneralUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ChatGeneralUseCase(mockGeminiClient as any);
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
  // HAPPY PATH - Knowledge-First Strategy (NO RAG)
  // ========================================================================

  it('genera respuesta usando conocimiento general de Gemini', async () => {
    const userQuestion = '¿Qué es la fotosíntesis?';
    mockGeminiClient.generateGeneralResponse.mockResolvedValueOnce(
      'La fotosíntesis es el proceso por el cual las plantas convierten la luz solar en energía.'
    );

    const result = await useCase.execute({ messages: createChatMessages(userQuestion) });

    expect(mockGeminiClient.generateGeneralResponse).toHaveBeenCalledTimes(1);
    expect(mockGeminiClient.generateGeneralResponse).toHaveBeenCalledWith(
      expect.stringContaining('asistente inteligente'),
      userQuestion
    );
    expect(result.response).toBe(
      'La fotosíntesis es el proceso por el cual las plantas convierten la luz solar en energía.'
    );
  });

  it('NO llama a generateChatResponse (método RAG)', async () => {
    mockGeminiClient.generateGeneralResponse.mockResolvedValueOnce('Respuesta general');

    await useCase.execute({ messages: createChatMessages('¿Quién inventó la bombilla?') });

    expect(mockGeminiClient.generateGeneralResponse).toHaveBeenCalledTimes(1);
    expect(mockGeminiClient.generateChatResponse).not.toHaveBeenCalled();
    expect(mockGeminiClient.generateEmbedding).not.toHaveBeenCalled();
  });

  it('pasa el system prompt de conocimiento general', async () => {
    mockGeminiClient.generateGeneralResponse.mockResolvedValueOnce('Respuesta');

    await useCase.execute({ messages: createChatMessages('Test') });

    const systemPrompt = mockGeminiClient.generateGeneralResponse.mock.calls[0][0];
    expect(systemPrompt).toContain('conocimiento general');
    expect(systemPrompt).toContain('español');
  });

  // ========================================================================
  // ERROR HANDLING
  // ========================================================================

  it('propaga error de Gemini correctamente', async () => {
    mockGeminiClient.generateGeneralResponse.mockRejectedValueOnce(new Error('Gemini API error'));

    await expect(
      useCase.execute({ messages: createChatMessages('Pregunta') })
    ).rejects.toThrow();
  });
});
