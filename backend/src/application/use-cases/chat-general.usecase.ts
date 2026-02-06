/**
 * ChatGeneralUseCase (Application Layer)
 * Implements RAG (Retrieval-Augmented Generation) for general Q&A over all news articles
 *
 * Sprint 19.6 - Tarea 3: Chat General
 *
 * Flow:
 * 1. Receive user message
 * 2. Generate embedding of the question
 * 3. Query ChromaDB for relevant context (across ALL articles)
 * 4. Combine retrieved documents as context
 * 5. Generate response using Gemini with context
 *
 * === COST OPTIMIZATION ===
 * - Contexto compactado: eliminados headers verbosos y duplicados
 * - Límite de documentos RAG: máximo 5 fragmentos (más que chat de artículo porque necesita más contexto)
 * - Límite de caracteres por fragmento: 1500 chars
 * - Formato compacto para metadatos
 */

import { IGeminiClient, ChatMessage } from '../../domain/services/gemini-client.interface';
import { IChromaClient, QueryResult } from '../../domain/services/chroma-client.interface';
import { INewsArticleRepository } from '../../domain/repositories/news-article.repository';
import { ValidationError } from '../../domain/errors/domain.error';
import { GeminiErrorMapper } from '../../infrastructure/external/gemini-error-mapper';

// ============================================================================
// COST OPTIMIZATION CONSTANTS
// ============================================================================

/**
 * Máximo de documentos recuperados de ChromaDB.
 * 5 documentos para tener más contexto en consultas generales
 */
const MAX_RAG_DOCUMENTS = 5;

/**
 * Máximo de caracteres por fragmento de documento.
 * Evita que un solo documento consuma demasiados tokens.
 */
const MAX_DOCUMENT_CHARS = 1500;

export interface ChatGeneralInput {
  messages: ChatMessage[];
}

export interface ChatGeneralOutput {
  response: string;
  sourcesCount: number; // Número de artículos usados como contexto
}

export class ChatGeneralUseCase {
  constructor(
    private readonly geminiClient: IGeminiClient,
    private readonly chromaClient: IChromaClient,
    private readonly newsRepository: INewsArticleRepository
  ) {}

  /**
   * Process a general chat message using RAG over all news articles
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

    console.log(`\n💬 [RAG Chat General] Pregunta general sobre noticias`);
    console.log(`   📝 Pregunta: "${userQuestion.substring(0, 100)}..."`);

    // 1. RETRIEVAL: Generate embedding and query ChromaDB
    let retrievedContext: string;
    let sourcesCount = 0;
    try {
      const result = await this.retrieveContext(userQuestion);
      retrievedContext = result.context;
      sourcesCount = result.sourcesCount;
      console.log(`   🔍 Contexto recuperado de ChromaDB: ${retrievedContext.length} caracteres de ${sourcesCount} artículos`);
    } catch (error) {
      // FALLBACK: If ChromaDB fails, use recent articles from database
      console.warn(`   ⚠️ ChromaDB no disponible, usando fallback con artículos recientes de BD`);
      try {
        const result = await this.retrieveContextFromDatabase();
        retrievedContext = result.context;
        sourcesCount = result.sourcesCount;
        console.log(`   🔍 Contexto recuperado de BD (fallback): ${retrievedContext.length} caracteres de ${sourcesCount} artículos`);
      } catch (dbError) {
        console.error(`   ❌ Error en fallback de BD:`, dbError);
        throw new ValidationError('No se pueden recuperar noticias en este momento. Por favor, intenta más tarde.');
      }
    }

    // 2. AUGMENTATION: Prepare system context
    const augmentedContext = this.augmentContext(retrievedContext);

    // 3. GENERATION: Call Gemini with the augmented context
    let response: string;
    try {
      response = await this.geminiClient.generateChatResponse(
        augmentedContext,
        userQuestion
      );
      console.log(`   ✅ Respuesta RAG generada (${response.length} caracteres)`);
    } catch (error) {
      // Map Gemini errors for observability (AI_RULES.md compliance)
      const mappedError = GeminiErrorMapper.toExternalAPIError(error);
      console.error(`   ❌ Gemini chat response failed: ${mappedError.message}`);
      throw mappedError;
    }

    return {
      response,
      sourcesCount,
    };
  }

  /**
   * RETRIEVAL STEP: Query ChromaDB for relevant context
   * Generates embedding of question and searches for similar documents
   *
   * COST OPTIMIZATION:
   * - Límite de documentos: MAX_RAG_DOCUMENTS (5)
   * - Límite de caracteres por documento: MAX_DOCUMENT_CHARS (1500)
   * - Formato compacto sin headers verbosos
   */
  private async retrieveContext(question: string): Promise<{ context: string; sourcesCount: number }> {
    // Generate embedding for the user's question
    console.log(`   🧠 Generando embedding de la pregunta...`);

    let questionEmbedding: number[];
    try {
      questionEmbedding = await this.geminiClient.generateEmbedding(question);
    } catch (error) {
      // Map Gemini errors for observability (AI_RULES.md compliance)
      const mappedError = GeminiErrorMapper.toExternalAPIError(error);
      console.error(`   ❌ Gemini embedding failed: ${mappedError.message}`);
      throw mappedError;
    }

    // COST OPTIMIZATION: Límite de documentos recuperados
    console.log(`   🔎 Buscando en ChromaDB (max ${MAX_RAG_DOCUMENTS} docs)...`);
    const results: QueryResult[] = await this.chromaClient.querySimilarWithDocuments(
      questionEmbedding,
      MAX_RAG_DOCUMENTS
    );

    if (results.length === 0) {
      console.log(`   ℹ️ No se encontraron documentos similares en ChromaDB`);
      throw new ValidationError('No se encontraron noticias relacionadas con tu pregunta.');
    }

    // COST OPTIMIZATION: Formato compacto para contexto
    const contextParts = results.map((result, index) => {
      // Truncar documento si es muy largo
      const truncatedDoc = result.document.length > MAX_DOCUMENT_CHARS
        ? result.document.substring(0, MAX_DOCUMENT_CHARS) + '...'
        : result.document;

      // Formato [N] Título | Fuente - Contenido
      return `[${index + 1}] ${result.metadata.title} | ${result.metadata.source} - ${truncatedDoc}`;
    });

    return {
      context: contextParts.join('\n\n'),
      sourcesCount: results.length,
    };
  }

  /**
   * FALLBACK RETRIEVAL: Get recent articles from database when ChromaDB fails
   * Returns most recent analyzed articles with summaries
   */
  private async retrieveContextFromDatabase(): Promise<{ context: string; sourcesCount: number }> {
    console.log(`   🗄️ Recuperando artículos recientes de BD...`);

    // Get recent articles (last 24 hours, limit to 5)
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24);

    const recentArticles = await this.newsRepository.findAll({
      limit: 5,
      offset: 0,
      category: undefined,
      userId: undefined,
    });

    if (!recentArticles || recentArticles.length === 0) {
      throw new ValidationError('No hay noticias disponibles en este momento.');
    }

    // Format articles as context
    const contextParts = recentArticles.map((article, index) => {
      const dateStr = article.publishedAt.toISOString().split('T')[0];

      // Use summary if available, otherwise use description/content
      let content = article.summary || article.description || article.content || '';

      // Truncate if too long
      if (content.length > MAX_DOCUMENT_CHARS) {
        content = content.substring(0, MAX_DOCUMENT_CHARS) + '...';
      }

      return `[${index + 1}] ${article.title} | ${article.source} | ${dateStr} - ${content}`;
    });

    return {
      context: contextParts.join('\n\n'),
      sourcesCount: recentArticles.length,
    };
  }

  /**
   * AUGMENTATION STEP: Enhance context with system instructions
   *
   * COST OPTIMIZATION:
   * - Instrucciones concisas para minimizar tokens
   * - Formato compacto
   */
  private augmentContext(retrievedContext: string): string {
    const parts: string[] = [];

    // System instructions
    parts.push('[SISTEMA] Eres un asistente experto en noticias. Responde basándote SOLO en los artículos proporcionados.');
    parts.push('[INSTRUCCIONES] Si la respuesta no está en el contexto, indícalo claramente. Cita las fuentes cuando sea relevante ([N]).');

    // Add retrieved context
    parts.push(`\n[CONTEXTO]\n${retrievedContext}`);

    return parts.join('\n');
  }
}
