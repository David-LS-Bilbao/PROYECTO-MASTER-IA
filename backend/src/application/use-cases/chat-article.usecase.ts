/**
 * ChatArticleUseCase (Application Layer)
 * Implements RAG (Retrieval-Augmented Generation) for article Q&A
 *
 * Flow:
 * 1. Receive articleId and user message
 * 2. Generate embedding of the question
 * 3. Query ChromaDB for relevant context
 * 4. Combine retrieved documents as context
 * 5. Generate response using Gemini with context
 */

import { INewsArticleRepository } from '../../domain/repositories/news-article.repository';
import { IGeminiClient, ChatMessage } from '../../domain/services/gemini-client.interface';
import { IChromaClient, QueryResult } from '../../domain/services/chroma-client.interface';
import { EntityNotFoundError, ValidationError } from '../../domain/errors/domain.error';

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
    private readonly chromaClient: IChromaClient
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
    const response = await this.geminiClient.generateChatResponse(
      augmentedContext,
      userQuestion
    );

    console.log(`   ✅ Respuesta RAG generada (${response.length} caracteres)`);

    return {
      articleId: article.id,
      response,
      articleTitle: article.title,
    };
  }

  /**
   * RETRIEVAL STEP: Query ChromaDB for relevant context
   * Generates embedding of question and searches for similar documents
   */
  private async retrieveContext(question: string, articleId: string): Promise<string> {
    // Generate embedding for the user's question
    console.log(`   🧠 Generando embedding de la pregunta...`);
    const questionEmbedding = await this.geminiClient.generateEmbedding(question);

    // Query ChromaDB for similar documents (nResults = 3 as specified)
    console.log(`   🔎 Buscando en ChromaDB...`);
    const results: QueryResult[] = await this.chromaClient.querySimilarWithDocuments(
      questionEmbedding,
      3 // nResults = 3 as per specification
    );

    if (results.length === 0) {
      console.log(`   ℹ️ No se encontraron documentos similares en ChromaDB`);
      return '';
    }

    // Prioritize the requested article if found in results
    const sortedResults = this.prioritizeArticle(results, articleId);

    // Combine documents into context string
    const contextParts = sortedResults.map((result, index) => {
      const relevanceNote = result.id === articleId
        ? '(Artículo actual)'
        : '(Artículo relacionado)';

      return `--- Fragmento ${index + 1} ${relevanceNote} ---
Título: ${result.metadata.title}
Fuente: ${result.metadata.source}
Contenido:
${result.document}`;
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

    // Article metadata header
    parts.push('=== INFORMACIÓN DEL ARTÍCULO ===');
    parts.push(`Título: ${article.title}`);
    parts.push(`Fuente: ${article.source}`);
    if (article.author) {
      parts.push(`Autor: ${article.author}`);
    }
    parts.push(`Fecha: ${article.publishedAt.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`);

    // Include AI analysis if available
    if (article.summary || article.biasScore !== null) {
      parts.push('\n=== ANÁLISIS PREVIO ===');
      if (article.summary) {
        parts.push(`Resumen IA: ${article.summary}`);
      }
      if (article.biasScore !== null) {
        const biasLevel = this.getBiasLevel(article.biasScore);
        parts.push(`Sesgo detectado: ${Math.round(article.biasScore * 100)}% (${biasLevel})`);
      }
    }

    // Add retrieved context
    if (retrievedContext) {
      parts.push('\n=== CONTENIDO RECUPERADO ===');
      parts.push(retrievedContext);
    }

    return parts.join('\n');
  }

  /**
   * Build fallback context when ChromaDB is unavailable
   * Uses article content from the database
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

    parts.push('=== ARTÍCULO ===');
    parts.push(`Título: ${article.title}`);
    parts.push(`Fuente: ${article.source}`);

    if (article.author) {
      parts.push(`Autor: ${article.author}`);
    }

    parts.push(`Fecha: ${article.publishedAt.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`);

    if (article.content) {
      parts.push(`\nContenido:\n${article.content}`);
    } else if (article.description) {
      parts.push(`\nDescripción:\n${article.description}`);
    }

    if (article.summary) {
      parts.push(`\nResumen IA: ${article.summary}`);
    }

    return parts.join('\n');
  }

  /**
   * Get human-readable bias level
   */
  private getBiasLevel(score: number): string {
    if (score < 0.2) return 'Muy bajo - Neutral';
    if (score < 0.4) return 'Bajo';
    if (score < 0.6) return 'Moderado';
    if (score < 0.8) return 'Alto';
    return 'Muy alto';
  }
}
