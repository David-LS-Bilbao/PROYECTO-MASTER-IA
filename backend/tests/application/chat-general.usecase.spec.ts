/**
 * ChatGeneralUseCase Unit Tests
 *
 * Sprint 27.4: Chat General con historial multi-turno + Google Search Grounding
 * Verifica validaciones, paso de historial completo y system prompt.
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

function createMultiTurnMessages(): ChatMessage[] {
  return [
    { role: 'user', content: '¿Quién es el presidente de España?' },
    { role: 'assistant', content: 'El presidente del Gobierno de España es Pedro Sánchez.' },
    { role: 'user', content: '¿Y cuándo asumió el cargo?' },
  ];
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
  // HAPPY PATH - Knowledge-First + Google Search + Multi-turn
  // ========================================================================

  it('genera respuesta usando conocimiento general de Gemini', async () => {
    const userQuestion = '¿Qué es la fotosíntesis?';
    mockGeminiClient.generateGeneralResponse.mockResolvedValueOnce(
      'La fotosíntesis es el proceso por el cual las plantas convierten la luz solar en energía.'
    );

    const result = await useCase.execute({ messages: createChatMessages(userQuestion) });

    expect(mockGeminiClient.generateGeneralResponse).toHaveBeenCalledTimes(1);
    expect(result.response).toBe(
      'La fotosíntesis es el proceso por el cual las plantas convierten la luz solar en energía.'
    );
  });

  it('pasa el historial completo de mensajes a Gemini', async () => {
    const multiTurnMessages = createMultiTurnMessages();
    mockGeminiClient.generateGeneralResponse.mockResolvedValueOnce('Asumió el cargo en 2018.');

    const result = await useCase.execute({ messages: multiTurnMessages });

    expect(mockGeminiClient.generateGeneralResponse).toHaveBeenCalledTimes(1);

    // Verify full history is passed (not just last message)
    const passedMessages = mockGeminiClient.generateGeneralResponse.mock.calls[0][1];
    expect(passedMessages).toHaveLength(3);
    expect(passedMessages[0].content).toBe('¿Quién es el presidente de España?');
    expect(passedMessages[1].role).toBe('assistant');
    expect(passedMessages[2].content).toBe('¿Y cuándo asumió el cargo?');

    expect(result.response).toBe('Asumió el cargo en 2018.');
  });

  it('pasa el system prompt con Google Search y conocimiento general', async () => {
    mockGeminiClient.generateGeneralResponse.mockResolvedValueOnce('Respuesta');

    await useCase.execute({ messages: createChatMessages('Test') });

    const systemPrompt = mockGeminiClient.generateGeneralResponse.mock.calls[0][0];
    expect(systemPrompt).toContain('conocimiento general');
    expect(systemPrompt).toContain('Google Search');
    expect(systemPrompt).toContain('español');
  });

  it('NO llama a generateChatResponse (método RAG)', async () => {
    mockGeminiClient.generateGeneralResponse.mockResolvedValueOnce('Respuesta general');

    await useCase.execute({ messages: createChatMessages('¿Quién inventó la bombilla?') });

    expect(mockGeminiClient.generateGeneralResponse).toHaveBeenCalledTimes(1);
    expect(mockGeminiClient.generateChatResponse).not.toHaveBeenCalled();
    expect(mockGeminiClient.generateEmbedding).not.toHaveBeenCalled();
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
