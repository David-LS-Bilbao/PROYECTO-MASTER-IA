/**
 * GeminiClient Implementation (Infrastructure Layer)
 * Uses Google's Gemini API for article analysis
 *
 * === COST OPTIMIZATION (Sprint 8) ===
 * - Prompts compactados para reducir tokens de entrada (~67% menos)
 * - Límites explícitos de output para controlar tokens de salida
 * - Ventana deslizante de historial para evitar crecimiento exponencial
 * - Documentación de decisiones de optimización
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import {
  IGeminiClient,
  AnalyzeContentInput,
  ChatWithContextInput,
  ChatResponse,
} from '../../domain/services/gemini-client.interface';
import { ArticleAnalysis, TokenUsage } from '../../domain/entities/news-article.entity';
import {
  ExternalAPIError,
  ConfigurationError,
} from '../../domain/errors/infrastructure.error';
import { TokenTaximeter } from '../monitoring/token-taximeter';
import { GeminiErrorMapper } from './gemini-error-mapper';
import { createModuleLogger } from '../logger/logger';
import { Sentry } from '../monitoring/sentry'; // Sprint 15 - Paso 3: Custom Spans for distributed tracing
import {
  ANALYSIS_PROMPT,
  MAX_ARTICLE_CONTENT_LENGTH,
  buildRagChatPrompt,
  buildGroundingChatPrompt,
  MAX_CHAT_HISTORY_MESSAGES,
  buildRssDiscoveryPrompt,
} from './prompts';

// ============================================================================
// LOGGER - SEGURIDAD (Sprint 14 - Bloqueante #1)
// ============================================================================

/**
 * Logger específico para GeminiClient
 * Usa Pino con redaction automática de datos sensibles (PII)
 *
 * IMPORTANTE: Nunca loguear:
 * - Títulos de artículos (puede contener información privada)
 * - Contenido de usuarios (preguntas, datos personales)
 * - URLs de fuentes privadas
 *
 * OK loguear:
 * - Metadatos: conteos, dimensiones, tokens
 * - Estados: "iniciando", "completado", "reintentando"
 * - Errores técnicos: codigos, tipos de error (sin detalles sensibles)
 */
const logger = createModuleLogger('GeminiClient');

const getErrorCode = (error: unknown): string | undefined => {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code);
  }
  return undefined;
};

// ============================================================================
// TOKEN TAXIMETER - DEPENDENCY INJECTION (Bloqueante #2 resuelto)
// ============================================================================

/**
 * TokenTaximeter ya NO es un singleton global.
 * Ahora se inyecta en el constructor (Dependency Injection).
 *
 * Beneficios:
 * - Testing aislado con mocks
 * - Sin estado global compartido
 * - Mejor control del ciclo de vida
 */

// ============================================================================
// MODEL CONFIGURATION & LIMITS
// ============================================================================

/**
 * Límite de caracteres para texto de embedding.
 * El modelo text-embedding-004 tiene límite de ~8000 tokens (~6000 chars).
 * Evita enviar textos enormes que consumen tokens innecesarios.
 */
const MAX_EMBEDDING_TEXT_LENGTH = 6000;

export class GeminiClient implements IGeminiClient {
  private readonly model: GenerativeModel;
  private readonly chatModel: GenerativeModel;
  private readonly genAI: GoogleGenerativeAI;
  private readonly taximeter: TokenTaximeter;

  constructor(apiKey: string, taximeter: TokenTaximeter) {
    if (!apiKey || apiKey.trim() === '') {
      throw new ConfigurationError('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.taximeter = taximeter;

    // Modelo base para análisis (sin herramientas externas)
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Modelo para chat con Google Search habilitado (Grounding)
    this.chatModel = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
          // @ts-expect-error - googleSearch tool typing not yet available in current SDK
          tools: [{ googleSearch: {} }],
    });
  }

  /**
   * Generic retry mechanism with exponential backoff
   * 
   * RESILIENCIA: Reintentos inteligentes para errores transitorios
   * - Solo reintenta errores 429 (Rate Limit) y 5xx (Server Errors)
   * - No reintenta errores 401 (Auth), 404 (Not Found), 400 (Bad Request)
   * - Exponential Backoff: delay * (2 ^ attempt)
   * 
   * @param operation Función asíncrona a ejecutar
   * @param retries Número máximo de reintentos (default: 3)
   * @param initialDelay Delay inicial en ms (default: 1000)
   * @returns Resultado de la operación
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message || '';

        // No reintentar errores no transitorios
        const isRetryable = GeminiErrorMapper.isRetryable(errorMessage);

        if (!isRetryable || attempt >= retries) {
          // Último intento o error no retriable
          throw GeminiErrorMapper.toExternalAPIError(lastError);
        }

        // Calcular delay con exponential backoff
        const delay = initialDelay * Math.pow(2, attempt - 1);

        logger.warn(
          {
            attempt,
            retries,
            delayMs: delay,
            errorCode: getErrorCode(error),
          },
          `Gemini API transient error - retrying`
        );

        // Esperar antes de reintentar
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Si llegamos aquí, todos los reintentos fallaron
    throw new ExternalAPIError(
      'Gemini',
      `Operation failed after ${retries} attempts: ${lastError?.message}`,
      500,
      lastError || undefined
    );
  }

  /**
   * Analyze article content with AI
   * Security: Includes retry with exponential backoff for rate limit handling
   */
  async analyzeArticle(input: AnalyzeContentInput): Promise<ArticleAnalysis> {
    // COST OPTIMIZATION: 'language' eliminado del prompt (se infiere del contenido)
    const { title, content, source } = input;

    // Validate input
    if (!content || content.trim().length < 50) {
      throw new ExternalAPIError(
        'Gemini',
        'Content is too short for meaningful analysis',
        400
      );
    }

    // Sanitize inputs to prevent prompt injection
    const sanitizedTitle = this.sanitizeInput(title);
    const sanitizedContent = this.sanitizeInput(content);
    const sanitizedSource = this.sanitizeInput(source);

    // COST OPTIMIZATION: Limitar contenido para reducir tokens de entrada
    const prompt = ANALYSIS_PROMPT.replace('{title}', sanitizedTitle)
      .replace('{source}', sanitizedSource)
      .replace('{content}', sanitizedContent.substring(0, MAX_ARTICLE_CONTENT_LENGTH));

    // RESILIENCIA: executeWithRetry maneja reintentos automáticos
    return this.executeWithRetry(async () => {
      logger.info(
        { contentLength: sanitizedContent.length },
        'Starting article analysis'
      );

      // 🔍 Sprint 15 - Paso 3: Custom Span for Performance Monitoring
      // Envuelve la llamada a Gemini en un span para distributed tracing
      const result = await Sentry.startSpan(
        {
          name: 'gemini.analyze_article',
          op: 'ai.generation',
          attributes: {
            'ai.model': 'gemini-2.5-flash',
            'ai.operation': 'article_analysis',
            'input.content_length': sanitizedContent.length,
          },
        },
        async () => await this.model.generateContent(prompt)
      );

      const response = result.response;
      const text = response.text();

      // TOKEN TAXIMETER: Capturar uso de tokens
      const usageMetadata = response.usageMetadata;
      let tokenUsage: TokenUsage | undefined;

      if (usageMetadata) {
        const promptTokens = usageMetadata.promptTokenCount || 0;
        const completionTokens = usageMetadata.candidatesTokenCount || 0;
        const totalTokens = promptTokens + completionTokens; // Always calculate manually to avoid cached tokens inflation
        const costEstimated = this.taximeter.calculateCost(promptTokens, completionTokens);

        tokenUsage = {
          promptTokens,
          completionTokens,
          totalTokens,
          costEstimated,
        };

        // 🔍 Sprint 15 - Paso 3: Añadir métricas de tokens al span activo
        const activeSpan = Sentry.getActiveSpan();
        if (activeSpan) {
          activeSpan.setAttribute('ai.tokens.prompt', promptTokens);
          activeSpan.setAttribute('ai.tokens.completion', completionTokens);
          activeSpan.setAttribute('ai.tokens.total', totalTokens);
          activeSpan.setAttribute('ai.cost_eur', costEstimated);
        }

        // Log with taximeter (IMPORTANTE: no loguea títulos, solo metadatos)
        this.taximeter.logAnalysis('[REDACTED]', promptTokens, completionTokens, totalTokens, costEstimated);

        logger.debug(
          { promptTokens, completionTokens, totalTokens, costEUR: costEstimated },
          'Article analysis completed with token usage'
        );
      } else {
        logger.debug('Article analysis completed without token metadata');
      }

      return this.parseAnalysisResponse(text, tokenUsage);
    }, 3, 1000); // 3 reintentos, 1s delay inicial
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Sin reintentos para health check (queremos respuesta rápida)
      const result = await this.model.generateContent('Respond with "OK"');
      return result.response.text().includes('OK');
    } catch {
      return false;
    }
  }

  /**
   * Generate embedding vector for text using text-embedding-004
   * Includes retry logic for transient failures
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new ExternalAPIError('Gemini', 'Text is required for embedding generation', 400);
    }

    // COST OPTIMIZATION: Truncar texto para evitar tokens innecesarios
    const truncatedText = text.substring(0, MAX_EMBEDDING_TEXT_LENGTH);

    // RESILIENCIA: executeWithRetry maneja reintentos automáticos
    return this.executeWithRetry(async () => {
      logger.info(
        { textLength: truncatedText.length },
        'Starting embedding generation'
      );

      // 🔍 Sprint 15 - Paso 3: Custom Span for Embedding Generation
      const embedding = await Sentry.startSpan(
        {
          name: 'gemini.generate_embedding',
          op: 'ai.embedding',
          attributes: {
            'ai.model': 'text-embedding-004',
            'ai.operation': 'embedding_generation',
            'input.text_length': truncatedText.length,
          },
        },
        async () => {
          const embeddingModel = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
          const result = await embeddingModel.embedContent(truncatedText);
          const values = result.embedding.values;

          // Add embedding dimensions to span
          const activeSpan = Sentry.getActiveSpan();
          if (activeSpan) {
            activeSpan.setAttribute('ai.embedding.dimensions', values.length);
          }

          return values;
        }
      );

      logger.debug(
        { embeddingDimensions: embedding.length },
        'Embedding generated successfully'
      );
      return embedding;
    }, 3, 1000); // 3 reintentos, 1s delay inicial
  }

  /**
   * Chat with context injection for article Q&A
   * Uses Google Search Grounding for hybrid responses (article + external info)
   *
   * COST OPTIMIZATION: Ventana deslizante de historial
   * - Solo se envían los últimos MAX_CHAT_HISTORY_MESSAGES mensajes
   * - Evita crecimiento exponencial de tokens en conversaciones largas
   * - Ahorro estimado: ~70% en conversaciones de 20+ mensajes
   */
  async chatWithContext(input: ChatWithContextInput): Promise<ChatResponse> {
    const { systemContext, messages } = input;

    if (!messages || messages.length === 0) {
      throw new ExternalAPIError('Gemini', 'At least one message is required', 400);
    }

    // COST OPTIMIZATION: Ventana deslizante - solo últimos N mensajes
    const recentMessages = messages.slice(-MAX_CHAT_HISTORY_MESSAGES);

    if (messages.length > MAX_CHAT_HISTORY_MESSAGES) {
      logger.debug(
        { originalCount: messages.length, truncatedCount: recentMessages.length },
        'Chat history window truncated to optimize costs'
      );
    }

    // COST OPTIMIZATION: Prompt extraído a módulo centralizado
    const conversationParts = buildGroundingChatPrompt(recentMessages);
    conversationParts.unshift(`[CONTEXTO]\n${systemContext}`, '\n[HISTORIAL]');
    conversationParts.push('\nResponde a la última pregunta.');
    const prompt = conversationParts.join('\n');

    // RESILIENCIA: executeWithRetry maneja reintentos automáticos
    return this.executeWithRetry(async () => {
      logger.info(
        { messageCount: recentMessages.length },
        'Starting grounding chat with Google Search'
      );

      // 🔍 Sprint 15 - Paso 3: Custom Span for Grounding Chat
      const result = await Sentry.startSpan(
        {
          name: 'gemini.chat_with_grounding',
          op: 'ai.chat',
          attributes: {
            'ai.model': 'gemini-2.5-flash',
            'ai.operation': 'grounding_chat',
            'ai.grounding.enabled': true,
            'chat.message_count': recentMessages.length,
          },
        },
        async () => await this.chatModel.generateContent(prompt)
      );

      const response = result.response;
      const text = response.text();

      // Log if grounding was used
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      if (groundingMetadata?.searchEntryPoint) {
        logger.debug('Google Search grounding was utilized');

        // 🔍 Add grounding metadata to span
        const activeSpan = Sentry.getActiveSpan();
        if (activeSpan) {
          activeSpan.setAttribute('ai.grounding.used', true);
        }
      }

      // TOKEN TAXIMETER: Capturar uso de tokens para chat grounding
      const usageMetadata = response.usageMetadata;
      if (usageMetadata) {
        const promptTokens = usageMetadata.promptTokenCount || 0;
        const completionTokens = usageMetadata.candidatesTokenCount || 0;
        const totalTokens = usageMetadata.totalTokenCount || (promptTokens + completionTokens);
        const costEstimated = this.taximeter.calculateCost(promptTokens, completionTokens);

        // 🔍 Sprint 15 - Paso 3: Añadir métricas de tokens al span activo
        const activeSpan = Sentry.getActiveSpan();
        if (activeSpan) {
          activeSpan.setAttribute('ai.tokens.prompt', promptTokens);
          activeSpan.setAttribute('ai.tokens.completion', completionTokens);
          activeSpan.setAttribute('ai.tokens.total', totalTokens);
          activeSpan.setAttribute('ai.cost_eur', costEstimated);
        }

        // SECURITY: No loguear la pregunta del usuario, solo metadatos
        this.taximeter.logGroundingChat('[REDACTED]', promptTokens, completionTokens, totalTokens, costEstimated);

        logger.debug(
          { promptTokens, completionTokens, totalTokens, costEUR: costEstimated },
          'Grounding chat completed with token usage'
        );
      }

      return { message: text.trim() };
    }, 3, 1000); // 3 reintentos, 1s delay inicial
  }

  /**
   * Generate a chat response using RAG context
   * Uses a focused system prompt that only answers from provided context
   * NO Google Search Grounding - pure RAG response
   *
   * COST OPTIMIZATION: Prompt compactado
   * - Eliminado markdown decorativo en instrucciones
   * - Reducidos ejemplos de fallback (3 → 1)
   * - Headers simplificados
   * - Añadido límite de output (max 150 palabras)
   * - Ahorro estimado: ~70% en tokens de instrucciones
   */
  async generateChatResponse(context: string, question: string): Promise<string> {
    if (!context || context.trim().length === 0) {
      throw new ExternalAPIError('Gemini', 'Context is required for RAG response', 400);
    }

    if (!question || question.trim().length === 0) {
      throw new ExternalAPIError('Gemini', 'Question is required', 400);
    }

    // COST OPTIMIZATION: Prompt extraído a módulo centralizado
    const ragPrompt = buildRagChatPrompt(question, context);

    // RESILIENCIA: executeWithRetry maneja reintentos automáticos
    return this.executeWithRetry(async () => {
      logger.info('Starting RAG chat response generation');

      // 🔍 Sprint 15 - Paso 3: Custom Span for RAG Chat
      const result = await Sentry.startSpan(
        {
          name: 'gemini.rag_chat',
          op: 'ai.chat',
          attributes: {
            'ai.model': 'gemini-2.5-flash',
            'ai.operation': 'rag_chat',
            'ai.grounding.enabled': false,
            'rag.context_length': context.length,
          },
        },
        async () => await this.model.generateContent(ragPrompt)
      );

      const response = result.response;
      const text = response.text().trim();

      // TOKEN TAXIMETER: Capturar uso de tokens para RAG chat
      const usageMetadata = response.usageMetadata;
      if (usageMetadata) {
        const promptTokens = usageMetadata.promptTokenCount || 0;
        const completionTokens = usageMetadata.candidatesTokenCount || 0;
        const totalTokens = usageMetadata.totalTokenCount || (promptTokens + completionTokens);
        const costEstimated = this.taximeter.calculateCost(promptTokens, completionTokens);

        // 🔍 Sprint 15 - Paso 3: Añadir métricas de tokens al span activo
        const activeSpan = Sentry.getActiveSpan();
        if (activeSpan) {
          activeSpan.setAttribute('ai.tokens.prompt', promptTokens);
          activeSpan.setAttribute('ai.tokens.completion', completionTokens);
          activeSpan.setAttribute('ai.tokens.total', totalTokens);
          activeSpan.setAttribute('ai.cost_eur', costEstimated);
        }

        // SECURITY: No loguear la pregunta del usuario, solo metadatos
        this.taximeter.logRagChat('[REDACTED]', promptTokens, completionTokens, totalTokens, costEstimated);

        logger.debug(
          { promptTokens, completionTokens, totalTokens, costEUR: costEstimated },
          'RAG chat completed with token usage'
        );
      }

      return text;
    }, 3, 1000); // 3 reintentos, 1s delay inicial
  }

  /**
   * Generate a general chat response with conversation history and Google Search Grounding.
   * Uses chatModel (Google Search enabled) for real-time data access.
   *
   * Sprint 27.4: Chat General con conocimiento completo + Google Search
   */
  async generateGeneralResponse(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    if (!systemPrompt || systemPrompt.trim().length === 0) {
      throw new ExternalAPIError('Gemini', 'System prompt is required', 400);
    }

    if (!messages || messages.length === 0) {
      throw new ExternalAPIError('Gemini', 'At least one message is required', 400);
    }

    // COST OPTIMIZATION: Sliding window - only last N messages
    const recentMessages = messages.slice(-MAX_CHAT_HISTORY_MESSAGES);

    if (messages.length > MAX_CHAT_HISTORY_MESSAGES) {
      logger.debug(
        { originalCount: messages.length, truncatedCount: recentMessages.length },
        'General chat history window truncated to optimize costs'
      );
    }

    // Build multi-turn prompt with system prompt + conversation history
    const promptParts: string[] = [systemPrompt, '\n[HISTORIAL]'];
    for (const msg of recentMessages) {
      if (msg.role === 'user') {
        promptParts.push(`Usuario: ${msg.content}`);
      } else if (msg.role === 'assistant') {
        promptParts.push(`Asistente: ${msg.content}`);
      }
    }
    promptParts.push('\nResponde a la última pregunta del usuario.');
    const prompt = promptParts.join('\n');

    return this.executeWithRetry(async () => {
      logger.info(
        { messageCount: recentMessages.length },
        'Starting general chat with Google Search Grounding'
      );

      // Uses chatModel (Google Search enabled) for real-time data
      const result = await Sentry.startSpan(
        {
          name: 'gemini.general_chat',
          op: 'ai.chat',
          attributes: {
            'ai.model': 'gemini-2.5-flash',
            'ai.operation': 'general_chat',
            'ai.grounding.enabled': true,
            'chat.message_count': recentMessages.length,
          },
        },
        async () => await this.chatModel.generateContent(prompt)
      );

      const response = result.response;
      const text = response.text().trim();

      // TOKEN TAXIMETER
      const usageMetadata = response.usageMetadata;
      if (usageMetadata) {
        const promptTokens = usageMetadata.promptTokenCount || 0;
        const completionTokens = usageMetadata.candidatesTokenCount || 0;
        const totalTokens = usageMetadata.totalTokenCount || (promptTokens + completionTokens);
        const costEstimated = this.taximeter.calculateCost(promptTokens, completionTokens);

        const activeSpan = Sentry.getActiveSpan();
        if (activeSpan) {
          activeSpan.setAttribute('ai.tokens.prompt', promptTokens);
          activeSpan.setAttribute('ai.tokens.completion', completionTokens);
          activeSpan.setAttribute('ai.tokens.total', totalTokens);
          activeSpan.setAttribute('ai.cost_eur', costEstimated);
        }

        this.taximeter.logRagChat('[GENERAL]', promptTokens, completionTokens, totalTokens, costEstimated);

        logger.debug(
          { promptTokens, completionTokens, totalTokens, costEUR: costEstimated },
          'General chat completed with token usage'
        );
      }

      if (!text) {
        throw new ExternalAPIError('Gemini', 'Empty response from general chat', 500);
      }

      return text;
    }, 3, 1000);
  }

  /**
   * Sanitize input to prevent prompt injection
   */
  private sanitizeInput(input: string): string {
    return input
      .replace(/```/g, '')
      .replace(/\{/g, '(')
      .replace(/\}/g, ')')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Parse the JSON response from Gemini
   * Handles new analysis format with clickbait, reliability, and factCheck
   * Includes optional token usage for cost tracking
   */
  private parseAnalysisResponse(text: string, tokenUsage?: TokenUsage): ArticleAnalysis {
    // Clean up potential markdown formatting
    let cleanText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Try to extract JSON from the response
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new ExternalAPIError(
        'Gemini',
        'Invalid response format: no JSON found',
        500
      );
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (typeof parsed.summary !== 'string') {
        throw new Error('Missing or invalid summary');
      }

      // internal_reasoning: Chain-of-Thought para XAI auditing
      const internal_reasoning = typeof parsed.internal_reasoning === 'string'
        ? parsed.internal_reasoning
        : undefined;

      // category: categoría sugerida por IA
      const category = typeof parsed.category === 'string'
        ? parsed.category
        : undefined;

      // biasScore: -10 to +10, normalize to 0-1 for UI compatibility
      let biasRaw = 0;
      if (typeof parsed.biasScore === 'number') {
        biasRaw = Math.max(-10, Math.min(10, parsed.biasScore));
      }
      const biasScoreNormalized = Math.abs(biasRaw) / 10;

      // analysis.biasType: tipo de sesgo detectado
      const biasType = typeof parsed.analysis?.biasType === 'string'
        ? parsed.analysis.biasType
        : undefined;

      // analysis.explanation: transparencia AI Act
      const explanation = typeof parsed.analysis?.explanation === 'string'
        ? parsed.analysis.explanation
        : undefined;

      // biasIndicators: backward compat (prompt v4 no lo pide, v3 sí)
      const biasIndicators = Array.isArray(parsed.biasIndicators)
        ? parsed.biasIndicators
        : [];

      // reliabilityScore: 0-100
      let reliabilityScore = 50;
      if (typeof parsed.reliabilityScore === 'number') {
        reliabilityScore = Math.max(0, Math.min(100, parsed.reliabilityScore));
      }

      // clickbaitScore: backward compat (prompt v4 no lo pide)
      let clickbaitScore = 0;
      if (typeof parsed.clickbaitScore === 'number') {
        clickbaitScore = Math.max(0, Math.min(100, parsed.clickbaitScore));
      }

      // sentiment: backward compat (prompt v4 no lo pide)
      let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
      const sentimentRaw = String(parsed.sentiment || 'neutral').toLowerCase();
      if (['positive', 'negative', 'neutral'].includes(sentimentRaw)) {
        sentiment = sentimentRaw as 'positive' | 'negative' | 'neutral';
      }

      // suggestedTopics → mainTopics (backward compat mapping)
      const mainTopics = Array.isArray(parsed.suggestedTopics)
        ? parsed.suggestedTopics
        : Array.isArray(parsed.mainTopics)
          ? parsed.mainTopics
          : [];

      // factCheck: backward compat (prompt v4 no lo pide)
      const factCheck = {
        claims: Array.isArray(parsed.factCheck?.claims) ? parsed.factCheck.claims : [],
        verdict: this.validateVerdict(parsed.factCheck?.verdict),
        reasoning: typeof parsed.factCheck?.reasoning === 'string'
          ? parsed.factCheck.reasoning
          : 'Sin información suficiente para verificar',
      };

      return {
        internal_reasoning,
        summary: parsed.summary,
        category,
        biasScore: biasScoreNormalized,
        biasRaw,
        biasType,
        biasIndicators,
        clickbaitScore,
        reliabilityScore,
        sentiment,
        mainTopics,
        factCheck,
        explanation,
        ...(tokenUsage && { usage: tokenUsage }),
      };
    } catch (error) {
      throw new ExternalAPIError(
        'Gemini',
        `Failed to parse analysis response: ${(error as Error).message}`,
        500
      );
    }
  }

  /**
   * Validate and normalize factCheck verdict
   */
  private validateVerdict(verdict: unknown): 'Verified' | 'Mixed' | 'Unproven' | 'False' {
    const validVerdicts = ['Verified', 'Mixed', 'Unproven', 'False'];
    if (typeof verdict === 'string' && validVerdicts.includes(verdict)) {
      return verdict as 'Verified' | 'Mixed' | 'Unproven' | 'False';
    }
    return 'Unproven'; // Default if invalid
  }

  /**
   * Auto-discover RSS URL for a given media name
   * 
   * FEATURE: RSS AUTO-DISCOVERY (Sprint 9)
   * Usa Gemini para encontrar la URL del feed RSS oficial de un medio dado.
   * 
   * @param mediaName Nombre del medio (e.g., "El País", "BBC News")
   * @returns URL del RSS si se encuentra, null si no existe o no se puede determinar
   */
  async discoverRssUrl(mediaName: string): Promise<string | null> {
    logger.info(
      { mediaLength: mediaName.length },
      'Starting RSS URL discovery'
    );

    // COST OPTIMIZATION: Prompt extraído a módulo centralizado
    const prompt = buildRssDiscoveryPrompt(mediaName);

    try {
      // RESILIENCIA: executeWithRetry maneja reintentos automáticos
      const result = await this.executeWithRetry(async () => {
        // 🔍 Sprint 15 - Paso 3: Custom Span for RSS Discovery
        return await Sentry.startSpan(
          {
            name: 'gemini.discover_rss',
            op: 'ai.generation',
            attributes: {
              'ai.model': 'gemini-2.5-flash',
              'ai.operation': 'rss_discovery',
            },
          },
          async () => {
            const response = await this.model.generateContent(prompt);
            return response.response.text().trim().replace(/['"]/g, '');
          }
        );
      }, 2, 500); // 2 reintentos, 500ms delay (operación menos crítica)

      // Si la respuesta es literalmente "null" o vacía, retornar null
      if (result === 'null' || result === '' || result.length < 10) {
        logger.debug('No RSS URL found for media source');
        return null;
      }

      // Validar que sea una URL válida
      try {
        new URL(result);
        logger.info(
          { rssUrlLength: result.length },
          'Valid RSS URL discovered'
        );
        return result;
      } catch {
        logger.warn('RSS discovery returned invalid URL format');
        return null;
      }
    } catch (error) {
      logger.error(
        { errorCode: getErrorCode(error) },
        'Error during RSS URL discovery'
      );
      return null;
    }
  }

  /**
   * Sprint 24: Descubre fuentes de noticias locales para una ciudad usando Gemini
   *
   * @param city Nombre de la ciudad (e.g., "Bilbao", "Valencia")
   * @returns JSON string con array de fuentes sugeridas
   */
  async discoverLocalSources(city: string): Promise<string> {
    logger.info(
      { cityLength: city.length },
      'Starting local sources discovery'
    );

    // Usar el prompt de discovery de fuentes locales
    const { buildLocationSourcesPrompt } = await import('./prompts/rss-discovery.prompt');
    const prompt = buildLocationSourcesPrompt(city);

    try {
      // RESILIENCIA: executeWithRetry maneja reintentos automáticos
      const result = await this.executeWithRetry(async () => {
        // 🔍 Sprint 24: Custom Span for Local Source Discovery
        return await Sentry.startSpan(
          {
            name: 'gemini.discover_local_sources',
            op: 'ai.generation',
            attributes: {
              'ai.model': 'gemini-2.5-flash',
              'ai.operation': 'local_source_discovery',
              'location': city,
            },
          },
          async () => {
            const response = await this.model.generateContent(prompt);
            return response.response.text().trim();
          }
        );
      }, 2, 500); // 2 reintentos, 500ms delay

      logger.info(
        { responseLength: result.length },
        'Local sources discovery completed'
      );
      return result;
    } catch (error) {
      logger.error(
        { errorCode: getErrorCode(error) },
        'Error during local sources discovery'
      );
      throw error;
    }
  }

  /**
   * Obtiene el reporte de costes acumulados de la sesión
   */
  getSessionCostReport() {
    return this.taximeter.getReport();
  }
}
