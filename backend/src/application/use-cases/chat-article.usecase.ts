/**
 * ChatArticleUseCase (Application Layer)
 * Implements RAG (Retrieval-Augmented Generation) for article Q&A
 *
 * Flow:
 * 1. Receive articleId and user message
 * 2. Generate embedding of the question
 * 3. Query pgvector for relevant context
 * 4. Combine retrieved documents as context
 * 5. Generate response using Gemini with context
 *
 * === COST OPTIMIZATION (Sprint 8) ===
 * - Contexto compactado: eliminados headers verbosos y duplicados
 * - Límite de documentos RAG: máximo 3 fragmentos
 * - Límite de caracteres por fragmento: 2000 chars
 * - Formato compacto para metadatos
 */

import { INewsArticleRepository } from '../../domain/repositories/news-article.repository';
import { IGeminiClient, ChatMessage } from '../../domain/services/gemini-client.interface';
import { IVectorClient, QueryResult } from '../../domain/services/vector-client.interface';
import { EntityNotFoundError, ValidationError, LowRelevanceError } from '../../domain/errors/domain.error';
import { GeminiErrorMapper } from '../../infrastructure/external/gemini-error-mapper';

// ============================================================================
// COST OPTIMIZATION CONSTANTS
// ============================================================================

/**
 * Máximo de documentos recuperados del vector store.
 * Más documentos = más contexto = más tokens = más coste.
 * 3 documentos es suficiente para la mayoría de preguntas.
 */
const MAX_RAG_DOCUMENTS = 3;

/**
 * Máximo de caracteres por fragmento de documento.
 * Evita que un solo documento consuma demasiados tokens.
 */
const MAX_DOCUMENT_CHARS = 2000;

/**
 * Máximo de caracteres para contenido de fallback.
 * Cuando el vector store no está disponible, limitar el contenido del artículo.
 */
const MAX_FALLBACK_CONTENT_CHARS = 3000;

// ============================================================================
// GRACEFUL DEGRADATION CONSTANTS (Sprint 29)
// ============================================================================

/**
 * Threshold de similitud de coseno para considerar contexto relevante.
 * Score < 0.25 indica que la pregunta está fuera del dominio del artículo.
 *
 * Valores típicos:
 * - 0.8-1.0: Muy similar (mismas palabras clave)
 * - 0.5-0.8: Relacionado (mismo tema)
 * - 0.25-0.5: Vagamente relacionado
 * - < 0.25: No relacionado (Out-of-Domain)
 */
const SIMILARITY_THRESHOLD = 0.25;

export interface ChatArticleInput {
  articleId: string;
  messages: ChatMessage[];
}

export interface ChatArticleOutput {
  articleId: string;
  response: string;
  articleTitle: string;
}

export class ChatArticleUseCase {
  constructor(
    private readonly articleRepository: INewsArticleRepository,
    private readonly geminiClient: IGeminiClient,
    private readonly vectorClient: IVectorClient
  ) {}

  /**
   * Process a chat message about an article using RAG
   */
  async execute(input: ChatArticleInput): Promise<ChatArticleOutput> {
    const { articleId, messages } = input;

    // Validate input
    if (!articleId || articleId.trim() === '') {
      throw new ValidationError('Article ID is required');
    }

    if (!messages || messages.length === 0) {
      throw new ValidationError('At least one message is required');
    }

    // Validate last message is from user
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
      throw new ValidationError('Last message must be from user');
    }

    const userQuestion = lastMessage.content;

    // 1. Fetch article from database (for title and fallback context)
    const article = await this.articleRepository.findById(articleId);
    if (!article) {
      throw new EntityNotFoundError('Article', articleId);
    }

    console.log(`\n💬 [RAG Chat] Pregunta sobre: "${article.title}"`);
    console.log(`   📝 Pregunta: "${userQuestion.substring(0, 100)}..."`);

    // 2. RETRIEVAL: Generate embedding and query ChromaDB
    let retrievedContext: string;
    try {
      retrievedContext = await this.retrieveContext(userQuestion, articleId);
      console.log(`   🔍 Contexto recuperado: ${retrievedContext.length} caracteres`);
    } catch (error) {
      // Fallback to article content if ChromaDB fails
      console.warn(`   ⚠️ ChromaDB no disponible, usando contenido del artículo como fallback`);
      retrievedContext = this.buildFallbackContext(article);
    }

    // 3. AUGMENTATION: Combine retrieved context with article metadata
    const augmentedContext = this.augmentContext(retrievedContext, article);

    // 4. GENERATION: Call Gemini with the augmented context
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
      articleId: article.id,
      response,
      articleTitle: article.title,
    };
  }

  /**
   * RETRIEVAL STEP: Query ChromaDB for relevant context
   * Generates embedding of question and searches for similar documents
   *
   * COST OPTIMIZATION:
   * - Límite de documentos: MAX_RAG_DOCUMENTS (3)
   * - Límite de caracteres por documento: MAX_DOCUMENT_CHARS (2000)
   * - Formato compacto sin headers verbosos
   */
  private async retrieveContext(question: string, articleId: string): Promise<string> {
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
    console.log(`   🔎 Buscando en pgvector (max ${MAX_RAG_DOCUMENTS} docs)...`);
    const results: QueryResult[] = await this.vectorClient.querySimilarWithDocuments(
      questionEmbedding,
      MAX_RAG_DOCUMENTS
    );

    // =========================================================================
    // GRACEFUL DEGRADATION (Sprint 29): Detectar preguntas fuera de contexto
    // =========================================================================
    // Si no hay resultados O el mejor resultado tiene score muy bajo:
    // - NO llamar a Gemini (ahorra tokens)
    // - Lanzar LowRelevanceError para trigger fallback a Chat General
    if (results.length === 0) {
      console.log(`   ⚠️ Sin resultados RAG → Pregunta fuera de contexto`);
      throw new LowRelevanceError('No encuentro información sobre eso en esta noticia.');
    }

    // Score de similitud = 1 - distance (pgvector usa distancia coseno)
    // distance=0 → 100% similar, distance=1 → 0% similar
    const bestDistance = results[0].distance ?? 1;
    const bestScore = 1 - bestDistance;

    if (bestScore < SIMILARITY_THRESHOLD) {
      console.log(`   ⚠️ Score bajo (${bestScore.toFixed(3)} < ${SIMILARITY_THRESHOLD}) → Pregunta fuera de contexto`);
      throw new LowRelevanceError('No encuentro información sobre eso en esta noticia.');
    }

    console.log(`   ✅ Contexto relevante encontrado (score: ${bestScore.toFixed(3)})`);


    // Prioritize the requested article if found in results
    const sortedResults = this.prioritizeArticle(results, articleId);

    // COST OPTIMIZATION: Formato compacto para contexto
    // - Eliminados headers verbosos ("--- Fragmento X ---")
    // - Eliminada nota de relevancia redundante
    // - Truncado de documentos largos
    // - BLOQUEANTE #4: Formato [N] Title | Source - Content (guión en misma línea)
    const contextParts = sortedResults.map((result, index) => {
      // Truncar documento si es muy largo
      const truncatedDoc = result.document.length > MAX_DOCUMENT_CHARS
        ? result.document.substring(0, MAX_DOCUMENT_CHARS) + '...'
        : result.document;

      // ✅ BLOQUEANTE #4 RESUELTO: Formato [N] Título | Fuente - Contenido
      // El guión y contenido van en la misma línea que los metadatos
      return `[${index + 1}] ${result.metadata.title} | ${result.metadata.source} - ${truncatedDoc}`;
    });

    return contextParts.join('\n\n');
  }

  /**
   * Prioritize the requested article in results
   * Moves the target article to the front if found
   */
  private prioritizeArticle(results: QueryResult[], articleId: string): QueryResult[] {
    const targetIndex = results.findIndex(r => r.id === articleId);

    if (targetIndex > 0) {
      // Move target article to front
      const [targetResult] = results.splice(targetIndex, 1);
      results.unshift(targetResult);
    }

    return results;
  }

  /**
   * AUGMENTATION STEP: Enhance context with article metadata
   *
   * COST OPTIMIZATION:
   * - Formato compacto en una línea para metadatos
   * - Eliminados headers verbosos ("=== INFORMACIÓN ===")
   * - Fecha en formato ISO corto (YYYY-MM-DD)
   * - Eliminada duplicación de título (ya está en retrievedContext)
   */
  private augmentContext(
    retrievedContext: string,
    article: {
      title: string;
      source: string;
      author: string | null;
      publishedAt: Date;
      summary: string | null;
      biasScore: number | null;
    }
  ): string {
    const parts: string[] = [];

    // COST OPTIMIZATION: Metadatos en formato compacto (una línea)
    const dateStr = article.publishedAt.toISOString().split('T')[0]; // YYYY-MM-DD
    parts.push(`[META] ${article.title} | ${article.source} | ${dateStr}`);

    // Include AI analysis if available (formato compacto)
    if (article.summary) {
      parts.push(`[RESUMEN] ${article.summary}`);
    }
    if (article.biasScore !== null) {
      parts.push(`[SESGO] ${Math.round(article.biasScore * 100)}%`);
    }

    // Add retrieved context
    if (retrievedContext) {
      parts.push(`\n${retrievedContext}`);
    }

    return parts.join('\n');
  }

  /**
   * Build fallback context when ChromaDB is unavailable
   * Uses article content from the database
   *
   * COST OPTIMIZATION:
   * - Límite de contenido: MAX_FALLBACK_CONTENT_CHARS
   * - Formato compacto sin headers verbosos
   */
  private buildFallbackContext(article: {
    title: string;
    content: string | null;
    description: string | null;
    source: string;
    author: string | null;
    publishedAt: Date;
    summary: string | null;
    biasScore: number | null;
  }): string {
    const parts: string[] = [];
    const dateStr = article.publishedAt.toISOString().split('T')[0];

    // COST OPTIMIZATION: Formato compacto
    parts.push(`[META] ${article.title} | ${article.source} | ${dateStr}`);

    // COST OPTIMIZATION: Truncar contenido largo
    if (article.content) {
      const truncatedContent = article.content.length > MAX_FALLBACK_CONTENT_CHARS
        ? article.content.substring(0, MAX_FALLBACK_CONTENT_CHARS) + '...'
        : article.content;
      parts.push(`\n${truncatedContent}`);
    } else if (article.description) {
      parts.push(`\n${article.description}`);
    }

    if (article.summary) {
      parts.push(`\n[RESUMEN] ${article.summary}`);
    }

    return parts.join('\n');
  }
}
