/**
 * ChatGeneralUseCase (Application Layer)
 * Implements general-purpose Q&A using Gemini's full knowledge base
 *
 * Sprint 19.6 - Tarea 3: Chat General
 * Sprint 27.4 - Refactorización: Eliminado RAG estricto
 *
 * Flow:
 * 1. Receive user message
 * 2. Generate response using Gemini with full knowledge access
 *
 * === DIFERENCIA CON CHAT DE ARTÍCULO ===
 * - Chat de Artículo (chat-article): RAG estricto sobre UN artículo específico
 * - Chat General (este): Conocimiento general completo de Gemini
 *
 * === COST OPTIMIZATION ===
 * - No usa RAG (sin embedding generation ni vector search)
 * - Llamada directa a Gemini para respuestas generales
 * - Más eficiente para preguntas de conocimiento general
 */

import { IGeminiClient, ChatMessage } from '../../domain/services/gemini-client.interface';
import { ValidationError } from '../../domain/errors/domain.error';
import { GeminiErrorMapper } from '../../infrastructure/external/gemini-error-mapper';
import { buildGeneralChatSystemPrompt } from '../../infrastructure/external/prompts/general-chat.prompt';

export interface ChatGeneralInput {
  messages: ChatMessage[];
}

export interface ChatGeneralOutput {
  response: string;
}

export class ChatGeneralUseCase {
  constructor(
    private readonly geminiClient: IGeminiClient
  ) {}

  /**
   * Process a general chat message using Gemini's full knowledge base
   *
   * Este use case NO usa RAG - permite preguntas abiertas sobre cualquier tema
   * usando el conocimiento general completo de Gemini.
   */
  async execute(input: ChatGeneralInput): Promise<ChatGeneralOutput> {
    const { messages } = input;

    // Validate input
    if (!messages || messages.length === 0) {
      throw new ValidationError('At least one message is required');
    }

    // Validate last message is from user
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
      throw new ValidationError('Last message must be from user');
    }

    const userQuestion = lastMessage.content;

    console.log(`\n💬 [Chat General] Pregunta de conocimiento general`);
    console.log(`   📝 Pregunta: "${userQuestion.substring(0, 100)}..."`);

    // Build system prompt for general chat (allows full knowledge access)
    const systemPrompt = buildGeneralChatSystemPrompt();

    // Call Gemini directly with full knowledge access
    let response: string;
    try {
      response = await this.geminiClient.generateChatResponse(
        systemPrompt,
        userQuestion
      );
      console.log(`   ✅ Respuesta generada (${response.length} caracteres)`);
    } catch (error) {
      // Map Gemini errors for observability (AI_RULES.md compliance)
      const mappedError = GeminiErrorMapper.toExternalAPIError(error);
      console.error(`   ❌ Gemini chat response failed: ${mappedError.message}`);
      throw mappedError;
    }

    return {
      response,
    };
  }
}
