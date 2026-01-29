/**
 * ChatArticleUseCase (Application Layer)
 * Handles chat conversations about news articles using Context Injection
 */

import { INewsArticleRepository } from '../../domain/repositories/news-article.repository';
import { IGeminiClient, ChatMessage } from '../../domain/services/gemini-client.interface';
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
    private readonly geminiClient: IGeminiClient
  ) {}

  /**
   * Process a chat message about an article
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

    // 1. Fetch article from database
    const article = await this.articleRepository.findById(articleId);
    if (!article) {
      throw new EntityNotFoundError('Article', articleId);
    }

    console.log(`\n💬 [Chat] Pregunta sobre: "${article.title}"`);

    // 2. Build system context with article information
    const systemContext = this.buildSystemContext(article);

    // 3. Send to Gemini with context
    const response = await this.geminiClient.chatWithContext({
      systemContext,
      messages,
    });

    console.log(`   ✅ Respuesta generada (${response.message.length} caracteres)`);

    return {
      articleId: article.id,
      response: response.message,
      articleTitle: article.title,
    };
  }

  /**
   * Build the system context from article data
   * Now includes hybrid instructions for Google Search Grounding
   */
  private buildSystemContext(article: {
    title: string;
    content: string | null;
    description: string | null;
    source: string;
    author: string | null;
    publishedAt: Date;
    summary: string | null;
    biasScore: number | null;
    analysis: string | null;
  }): string {
    const parts: string[] = [];

    // System instructions with hybrid capabilities
    parts.push(`Actúas como un analista de noticias experto. Tienes acceso al contenido de una noticia específica (proporcionada abajo) Y acceso a Google Search para información externa.

REGLAS:
1. Tu PRIORIDAD es responder basándote en la noticia proporcionada.
2. SI (y solo si) el usuario pide información externa, hechos recientes posteriores a la noticia, contexto histórico, o buscar "noticias similares", UTILIZA la herramienta de búsqueda.
3. Si buscas información externa, CÍTALA explícitamente indicando que proviene de una búsqueda web.
4. Mantén las respuestas concisas y con estilo periodístico.
5. Responde en el mismo idioma que el usuario.`);

    parts.push('\n=== NOTICIA DE REFERENCIA ===');
    parts.push(`Título: ${article.title}`);
    parts.push(`Fuente: ${article.source}`);

    if (article.author) {
      parts.push(`Autor: ${article.author}`);
    }

    parts.push(`Fecha de publicación: ${article.publishedAt.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`);

    if (article.content) {
      parts.push(`\nContenido completo:\n${article.content}`);
    } else if (article.description) {
      parts.push(`\nDescripción:\n${article.description}`);
    }

    // Include AI analysis if available
    if (article.summary || article.biasScore !== null) {
      parts.push('\n=== ANÁLISIS DE IA ===');

      if (article.summary) {
        parts.push(`Resumen: ${article.summary}`);
      }

      if (article.biasScore !== null) {
        const biasLevel = this.getBiasLevel(article.biasScore);
        parts.push(`Puntuación de sesgo: ${Math.round(article.biasScore * 100)}% (${biasLevel})`);
      }

      if (article.analysis) {
        try {
          const analysisData = JSON.parse(article.analysis);
          if (analysisData.sentiment) {
            parts.push(`Sentimiento: ${analysisData.sentiment}`);
          }
          if (analysisData.mainTopics?.length > 0) {
            parts.push(`Temas principales: ${analysisData.mainTopics.join(', ')}`);
          }
          if (analysisData.biasIndicators?.length > 0) {
            parts.push(`Indicadores de sesgo: ${analysisData.biasIndicators.join(', ')}`);
          }
        } catch {
          // Ignore parse errors
        }
      }
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
