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
 * === FEATURES ===
 * - Historial multi-turno: envía conversación completa a Gemini
 * - Google Search Grounding: datos en tiempo real via búsqueda web
 * - Sliding window: solo últimos 6 mensajes para optimizar costes
 *
 * IMPORTANTE: Este use case NO usa vectorClient ni RAG
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
   * Process a general chat with full conversation history
   *
   * Envía el historial completo a Gemini con Google Search Grounding
   * para respuestas con contexto conversacional y datos en tiempo real.
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

    console.log(`\n💬 [Chat General] Pregunta con historial (${messages.length} mensajes)`);
    console.log(`   📝 Última pregunta: "${lastMessage.content.substring(0, 100)}..."`);

    // Build system prompt for general chat (allows full knowledge access)
    const systemPrompt = buildGeneralChatSystemPrompt();

    // Call Gemini with full conversation history + Google Search
    let response: string;
    try {
      response = await this.geminiClient.generateGeneralResponse(
        systemPrompt,
        messages
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
