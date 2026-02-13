/**
 * GeminiClient Implementation (Infrastructure Layer)
 * Uses Google's Gemini API for article analysis
 *
 * === COST OPTIMIZATION (Sprint 8) ===
 * - Prompts compactados para reducir tokens de entrada (~67% menos)
 * - LÃ­mites explÃ­citos de output para controlar tokens de salida
 * - Ventana deslizante de historial para evitar crecimiento exponencial
 * - DocumentaciÃ³n de decisiones de optimizaciÃ³n
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import {
  IGeminiClient,
  AnalysisMode,
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
  analysisResponseSchema,
  type AnalysisResponsePayload,
  type ArticleLeaning,
  type LegacyBiasLeaning,
  type FactCheckVerdict,
  type FactualityStatus,
} from './schemas/analysis-response.schema';
import {
  ANALYSIS_PROMPT,
  ANALYSIS_PROMPT_LOW_COST,
  ANALYSIS_PROMPT_MODERATE,
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
 * Logger especÃ­fico para GeminiClient
 * Usa Pino con redaction automÃ¡tica de datos sensibles (PII)
 *
 * IMPORTANTE: Nunca loguear:
 * - TÃ­tulos de artÃ­culos (puede contener informaciÃ³n privada)
 * - Contenido de usuarios (preguntas, datos personales)
 * - URLs de fuentes privadas
 *
 * OK loguear:
 * - Metadatos: conteos, dimensiones, tokens
 * - Estados: "iniciando", "completado", "reintentando"
 * - Errores tÃ©cnicos: codigos, tipos de error (sin detalles sensibles)
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
 * LÃ­mite de caracteres para texto de embedding.
 * El modelo text-embedding-004 tiene lÃ­mite de ~8000 tokens (~6000 chars).
 * Evita enviar textos enormes que consumen tokens innecesarios.
 */
const MAX_EMBEDDING_TEXT_LENGTH = 6000;
const ANALYSIS_HEAD_CHARS = 3000;
const ANALYSIS_TAIL_CHARS = 2000;
const ANALYSIS_QUOTES_DATA_CHARS = 2000;
const AUTO_LOW_COST_CONTENT_THRESHOLD = 800;

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /disregard\s+(all\s+)?previous\s+instructions?/gi,
  /follow\s+these\s+new\s+instructions/gi,
  /system\s+prompt/gi,
  /developer\s+message/gi,
];

const HIGH_RISK_CLAIM_PATTERNS: RegExp[] = [
  /\b(cura|curacion|tratamiento definitivo|vacuna definitiva)\b/i,
  /\b(fraude electoral|elecciones manipuladas|golpe de estado)\b/i,
  /\b(colapso bancario|quiebra inminente|corrida bancaria)\b/i,
  /\b(ataque terrorista|amenaza inminente|riesgo de seguridad)\b/i,
  /\b(murio|mueren|fallecio|fallecieron)\b/i,
];

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

    // Modelo base para anÃ¡lisis (sin herramientas externas)
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
   * @param operation FunciÃ³n asÃ­ncrona a ejecutar
   * @param retries NÃºmero mÃ¡ximo de reintentos (default: 3)
   * @param initialDelay Delay inicial en ms (default: 1000)
   * @returns Resultado de la operaciÃ³n
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
          // Ãšltimo intento o error no retriable
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

    // Si llegamos aquÃ­, todos los reintentos fallaron
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

    // Neutralize known prompt-injection patterns without mutating article structure.
    const sanitizedTitle = this.sanitizeInput(title);
    const sanitizedContent = this.sanitizeInput(content);
    const sanitizedSource = this.sanitizeInput(source);
    const selectedContent = this.selectContentForAnalysis(sanitizedContent);
    const requestedMode = this.normalizeAnalysisMode(input.analysisMode);
    const effectiveMode = this.resolveAnalysisMode(requestedMode, sanitizedContent);

    // COST OPTIMIZATION: Seleccion inteligente de contenido para reducir tokens.
    const analysisPromptTemplate = this.getAnalysisPromptTemplate(effectiveMode);
    const prompt = analysisPromptTemplate.replace('{title}', sanitizedTitle)
      .replace('{source}', sanitizedSource)
      .replace('{content}', selectedContent);

    // RESILIENCIA: executeWithRetry maneja reintentos automÃ¡ticos
    return this.executeWithRetry(async () => {
      logger.info(
        {
          originalContentLength: sanitizedContent.length,
          selectedContentLength: selectedContent.length,
          promptProfile: effectiveMode,
        },
        'Starting article analysis'
      );

      // ðŸ” Sprint 15 - Paso 3: Custom Span for Performance Monitoring
      // Envuelve la llamada a Gemini en un span para distributed tracing
      const result = await Sentry.startSpan(
        {
          name: 'gemini.analyze_article',
          op: 'ai.generation',
          attributes: {
            'ai.model': 'gemini-2.5-flash',
            'ai.operation': 'article_analysis',
            'input.content_length': selectedContent.length,
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

        // ðŸ” Sprint 15 - Paso 3: AÃ±adir mÃ©tricas de tokens al span activo
        const activeSpan = Sentry.getActiveSpan();
        if (activeSpan) {
          activeSpan.setAttribute('ai.tokens.prompt', promptTokens);
          activeSpan.setAttribute('ai.tokens.completion', completionTokens);
          activeSpan.setAttribute('ai.tokens.total', totalTokens);
          activeSpan.setAttribute('ai.cost_eur', costEstimated);
        }

        // Log with taximeter (IMPORTANTE: no loguea tÃ­tulos, solo metadatos)
        this.taximeter.logAnalysis('[REDACTED]', promptTokens, completionTokens, totalTokens, costEstimated);

        logger.debug(
          { promptTokens, completionTokens, totalTokens, costEUR: costEstimated },
          'Article analysis completed with token usage'
        );
      } else {
        logger.debug('Article analysis completed without token metadata');
      }

      return this.parseAnalysisResponse(
        text,
        tokenUsage,
        sanitizedContent,
        effectiveMode
      );
    }, 3, 1000); // 3 reintentos, 1s delay inicial
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Sin reintentos para health check (queremos respuesta rÃ¡pida)
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

    // RESILIENCIA: executeWithRetry maneja reintentos automÃ¡ticos
    return this.executeWithRetry(async () => {
      logger.info(
        { textLength: truncatedText.length },
        'Starting embedding generation'
      );

      // ðŸ” Sprint 15 - Paso 3: Custom Span for Embedding Generation
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
   * - Solo se envÃ­an los Ãºltimos MAX_CHAT_HISTORY_MESSAGES mensajes
   * - Evita crecimiento exponencial de tokens en conversaciones largas
   * - Ahorro estimado: ~70% en conversaciones de 20+ mensajes
   */
  async chatWithContext(input: ChatWithContextInput): Promise<ChatResponse> {
    const { systemContext, messages } = input;

    if (!messages || messages.length === 0) {
      throw new ExternalAPIError('Gemini', 'At least one message is required', 400);
    }

    // COST OPTIMIZATION: Ventana deslizante - solo Ãºltimos N mensajes
    const recentMessages = messages.slice(-MAX_CHAT_HISTORY_MESSAGES);

    if (messages.length > MAX_CHAT_HISTORY_MESSAGES) {
      logger.debug(
        { originalCount: messages.length, truncatedCount: recentMessages.length },
        'Chat history window truncated to optimize costs'
      );
    }

    // COST OPTIMIZATION: Prompt extraÃ­do a mÃ³dulo centralizado
    const conversationParts = buildGroundingChatPrompt(recentMessages);
    conversationParts.unshift(`[CONTEXTO]\n${systemContext}`, '\n[HISTORIAL]');
    conversationParts.push('\nResponde a la Ãºltima pregunta.');
    const prompt = conversationParts.join('\n');

    // RESILIENCIA: executeWithRetry maneja reintentos automÃ¡ticos
    return this.executeWithRetry(async () => {
      logger.info(
        { messageCount: recentMessages.length },
        'Starting grounding chat with Google Search'
      );

      // ðŸ” Sprint 15 - Paso 3: Custom Span for Grounding Chat
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

        // ðŸ” Add grounding metadata to span
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

        // ðŸ” Sprint 15 - Paso 3: AÃ±adir mÃ©tricas de tokens al span activo
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
   * - Reducidos ejemplos de fallback (3 â†’ 1)
   * - Headers simplificados
   * - AÃ±adido lÃ­mite de output (max 150 palabras)
   * - Ahorro estimado: ~70% en tokens de instrucciones
   */
  async generateChatResponse(context: string, question: string): Promise<string> {
    if (!context || context.trim().length === 0) {
      throw new ExternalAPIError('Gemini', 'Context is required for RAG response', 400);
    }

    if (!question || question.trim().length === 0) {
      throw new ExternalAPIError('Gemini', 'Question is required', 400);
    }

    // COST OPTIMIZATION: Prompt extraÃ­do a mÃ³dulo centralizado
    const ragPrompt = buildRagChatPrompt(question, context);

    // RESILIENCIA: executeWithRetry maneja reintentos automÃ¡ticos
    return this.executeWithRetry(async () => {
      logger.info('Starting RAG chat response generation');

      // ðŸ” Sprint 15 - Paso 3: Custom Span for RAG Chat
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

        // ðŸ” Sprint 15 - Paso 3: AÃ±adir mÃ©tricas de tokens al span activo
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
    promptParts.push('\nResponde a la Ãºltima pregunta del usuario.');
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
   * Neutralize prompt injection patterns without altering article semantics.
   * IMPORTANT: Do not mutate article braces "{}".
   */
  private sanitizeInput(input: string): string {
    let sanitized = input
      .replace(/\r\n/g, '\n')
      .replace(/\u0000/g, '')
      // Keep <ARTICLE> delimiters safe even if present in the content itself.
      .replace(/<\/ARTICLE>/gi, '<\\/ARTICLE>')
      .replace(/<ARTICLE>/gi, '<ARTICLE_ESCAPED>');

    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[blocked_prompt_injection_pattern]');
    }

    return sanitized.replace(/\n{4,}/g, '\n\n\n').trim();
  }

  /**
   * Parse the JSON response from Gemini
   * Handles vNext analysis format with traceability and escalation fields
   * Includes optional token usage for cost tracking
   */
  private parseAnalysisResponse(
    text: string,
    tokenUsage?: TokenUsage,
    analyzedContent: string = '',
    analysisMode: AnalysisMode = 'low_cost'
  ): ArticleAnalysis {
    const cleanText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new ExternalAPIError('Gemini', 'Invalid response format: no JSON found', 500);
    }

    try {
      const rawPayload = JSON.parse(jsonMatch[0]);
      const repairedPayload = this.repairAnalysisPayload(rawPayload, analyzedContent);
      const parsed = analysisResponseSchema.parse(
        repairedPayload
      ) as AnalysisResponsePayload;

      const internal_reasoning = typeof parsed.internal_reasoning === 'string'
        ? parsed.internal_reasoning
        : undefined;

      const category = typeof parsed.category === 'string'
        ? parsed.category
        : undefined;

      const parsedBiasRawCandidate = typeof parsed.biasRaw === 'number'
        ? parsed.biasRaw
        : typeof parsed.biasScore === 'number'
          ? parsed.biasScore
          : 0;
      const parsedBiasRaw = this.clampScore(parsedBiasRawCandidate, -10, 10, 0);
      const parsedBiasScoreNormalized = typeof parsed.biasScoreNormalized === 'number'
        ? this.clampScore(parsed.biasScoreNormalized, 0, 1, Math.abs(parsedBiasRaw) / 10)
        : Math.abs(parsedBiasRaw) / 10;

      const parsedBiasType = typeof parsed.analysis?.biasType === 'string'
        ? parsed.analysis.biasType
        : undefined;

      const explanation = typeof parsed.analysis?.explanation === 'string'
        ? parsed.analysis.explanation
        : undefined;
      const parsedBiasComment = this.normalizeShortComment(parsed.biasComment);
      const parsedArticleLeaning = this.normalizeArticleLeaning(
        parsed.articleLeaning ?? parsed.biasLeaning
      );

      const parsedBiasIndicators = this.normalizeStringArray(parsed.biasIndicators).slice(0, 5);
      const hasCalibratedBiasSignals = this.hasThreeQuotedBiasIndicators(parsedBiasIndicators);
      const biasRaw = hasCalibratedBiasSignals ? parsedBiasRaw : 0;
      const biasScoreNormalized = hasCalibratedBiasSignals ? parsedBiasScoreNormalized : 0;
      const biasType = hasCalibratedBiasSignals ? (parsedBiasType ?? 'ninguno') : 'ninguno';
      const biasIndicators = hasCalibratedBiasSignals ? parsedBiasIndicators : [];
      const articleLeaning = hasCalibratedBiasSignals
        ? (parsedArticleLeaning ?? 'indeterminada')
        : 'indeterminada';
      const biasComment = hasCalibratedBiasSignals
        ? parsedBiasComment
        : 'No hay suficientes señales citadas para inferir una tendencia ideológica y, con esta evidencia interna, el sesgo queda indeterminado.';

      let reliabilityScore = this.clampScore(parsed.reliabilityScore, 0, 100, 50);
      let traceabilityScore = this.clampScore(
        parsed.traceabilityScore,
        0,
        100,
        reliabilityScore
      );

      const calibratedScores = this.calibrateEvidenceScores(
        analyzedContent,
        reliabilityScore,
        traceabilityScore
      );
      reliabilityScore = calibratedScores.reliabilityScore;
      traceabilityScore = calibratedScores.traceabilityScore;

      const factualityStatus: FactualityStatus =
        parsed.factualityStatus ?? 'no_determinable';
      const evidence_needed = this.normalizeStringArray(parsed.evidence_needed).slice(0, 4);
      const reliabilityComment = this.normalizeShortComment(parsed.reliabilityComment);

      const clickbaitScore = this.clampScore(parsed.clickbaitScore, 0, 100, 0);
      const sentiment = this.normalizeSentiment(parsed.sentiment);

      const mainTopics = this.normalizeStringArray(
        Array.isArray(parsed.suggestedTopics)
          ? parsed.suggestedTopics
          : parsed.mainTopics
      ).slice(0, 3);

      const claims = this.normalizeStringArray(parsed.factCheck?.claims).slice(0, 5);
      const verdict =
        claims.length === 0
          ? 'InsufficientEvidenceInArticle'
          : this.validateVerdict(parsed.factCheck?.verdict);
      const factCheck = {
        claims,
        verdict,
        reasoning: typeof parsed.factCheck?.reasoning === 'string'
          ? parsed.factCheck.reasoning
          : 'Sin informacion suficiente para verificar',
      };

      const should_escalate = typeof parsed.should_escalate === 'boolean'
        ? parsed.should_escalate
        : this.computeEscalation({
            claims,
            summary: parsed.summary,
            reliabilityScore,
            traceabilityScore,
            clickbaitScore,
          });
      const forcedLowCostEscalation =
        analysisMode === 'low_cost' &&
        this.hasStrongClaimsWithoutAttribution({
          claims,
          summary: parsed.summary,
          content: analyzedContent,
        });

      return {
        internal_reasoning,
        summary: parsed.summary,
        category,
        biasScore: biasScoreNormalized,
        biasRaw,
        biasScoreNormalized,
        biasType,
        biasIndicators,
        biasComment,
        articleLeaning,
        biasLeaning: this.toLegacyBiasLeaning(articleLeaning),
        analysisModeUsed: analysisMode,
        clickbaitScore,
        reliabilityScore,
        traceabilityScore,
        factualityStatus,
        evidence_needed,
        reliabilityComment,
        should_escalate: should_escalate || forcedLowCostEscalation,
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

  private repairAnalysisPayload(
    payload: unknown,
    analyzedContent: string
  ): Record<string, unknown> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {
        summary: this.buildFallbackSummary(analyzedContent),
      };
    }

    const candidate = { ...(payload as Record<string, unknown>) };
    const hasMissingSummary =
      typeof candidate.summary === 'undefined' ||
      (typeof candidate.summary === 'string' && candidate.summary.trim().length === 0);

    if (hasMissingSummary) {
      candidate.summary = this.buildFallbackSummary(analyzedContent);
      logger.warn(
        {
          reason: 'missing_summary',
          contentLength: analyzedContent.length,
        },
        'Gemini response repaired before schema validation'
      );
    }

    for (const boundedField of ['biasComment', 'reliabilityComment'] as const) {
      const value = candidate[boundedField];
      if (typeof value === 'string' && value.trim().length > 220) {
        candidate[boundedField] = `${value.trim().slice(0, 217).trimEnd()}...`;
      }
    }

    return candidate;
  }

  private buildFallbackSummary(content: string): string {
    const withoutFallbackHeader = content.replace(
      /^ADVERTENCIA:[\s\S]*?\n\n/i,
      ''
    );
    const compact = withoutFallbackHeader.replace(/\s+/g, ' ').trim();
    if (!compact) {
      return 'Resumen no disponible: respuesta incompleta del modelo.';
    }

    const snippet = compact.slice(0, 220).trim();
    const suffix = compact.length > 220 ? '...' : '';
    return `Resumen provisional basado en contenido interno: ${snippet}${suffix}`;
  }

  private clampScore(
    value: number | undefined,
    min: number,
    max: number,
    fallback: number
  ): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, value));
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  private normalizeShortComment(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return undefined;
    }

    if (normalized.length <= 220) {
      return normalized;
    }

    return `${normalized.slice(0, 217).trimEnd()}...`;
  }

  private normalizeArticleLeaning(value: unknown): ArticleLeaning | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    const validValues: ArticleLeaning[] = [
      'progresista',
      'conservadora',
      'extremista',
      'neutral',
      'indeterminada',
    ];

    if ((validValues as string[]).includes(normalized)) {
      return normalized as ArticleLeaning;
    }

    if (normalized === 'otra') {
      return 'indeterminada';
    }

    return undefined;
  }

  private toLegacyBiasLeaning(value: ArticleLeaning): LegacyBiasLeaning {
    if (value === 'extremista') {
      return 'otra';
    }

    return value;
  }

  private normalizeSentiment(raw: unknown): 'positive' | 'negative' | 'neutral' {
    const sentimentRaw = String(raw || 'neutral').toLowerCase();
    if (['positive', 'negative', 'neutral'].includes(sentimentRaw)) {
      return sentimentRaw as 'positive' | 'negative' | 'neutral';
    }
    return 'neutral';
  }

  private calibrateEvidenceScores(
    content: string,
    reliabilityScore: number,
    traceabilityScore: number
  ): { reliabilityScore: number; traceabilityScore: number } {
    if (!content || content.trim().length === 0) {
      return {
        reliabilityScore: Math.round(reliabilityScore),
        traceabilityScore: Math.round(traceabilityScore),
      };
    }

    const attributionMatches =
      content.match(
        /\b(seg[uú]n|according to|de acuerdo con|afirm[oó]|inform[oó]|report[oó]|dijo|stated|reported|ministerio|universidad|instituto)\b/gi
      ) ?? [];
    const linkMatches = content.match(/\bhttps?:\/\/\S+|\bwww\.\S+/gi) ?? [];
    const quoteMarks = content.match(/["“”]/g) ?? [];
    const quotePairs = Math.floor(quoteMarks.length / 2);
    const figureMatches =
      content.match(/\b\d+(?:[.,]\d+)?\s?(?:%|millones|miles|euros|d[oó]lares|USD|EUR|años|dias|years|deaths?)\b/gi) ??
      [];
    const vagueMatches =
      content.match(/\b(algunos|muchos|se dice|fuentes cercanas|experts say|sources say|everyone knows|todos lo saben)\b/gi) ??
      [];
    const clickbaitMatches =
      content.match(/\b(URGENTE|NO CREER[ÁA]S|ESC[ÁA]NDALO|BOMBAZO|IMPACTANTE|SHOCKING|BREAKING)\b|!{2,}/gi) ?? [];

    const positiveScore =
      Math.min(attributionMatches.length, 4) * 16 +
      Math.min(linkMatches.length, 3) * 24 +
      Math.min(quotePairs, 4) * 10 +
      Math.min(figureMatches.length, 4) * 12;

    const negativeScore =
      Math.min(vagueMatches.length, 4) * 18 +
      Math.min(clickbaitMatches.length, 4) * 26;

    const heuristicTraceability = this.clampScore(
      18 + positiveScore - negativeScore,
      0,
      100,
      50
    );

    const heuristicReliability = this.clampScore(
      15 + positiveScore - negativeScore - Math.min(clickbaitMatches.length, 4) * 4,
      0,
      100,
      50
    );

    const modelWeight = 0.4;
    const heuristicWeight = 0.6;

    return {
      reliabilityScore: Math.round(
        this.clampScore(
          reliabilityScore * modelWeight + heuristicReliability * heuristicWeight,
          0,
          100,
          reliabilityScore
        )
      ),
      traceabilityScore: Math.round(
        this.clampScore(
          traceabilityScore * modelWeight + heuristicTraceability * heuristicWeight,
          0,
          100,
          traceabilityScore
        )
      ),
    };
  }

  private hasThreeQuotedBiasIndicators(indicators: string[]): boolean {
    if (indicators.length < 3) {
      return false;
    }

    const citationPattern = /["'`][^"'`]{3,140}["'`]|\([^()]{3,120}\)|\[[^\[\]]{3,120}\]/;
    return indicators.slice(0, 3).every((indicator) => citationPattern.test(indicator));
  }

  private normalizeAnalysisMode(value: unknown): AnalysisMode {
    if (value === 'moderate' || value === 'standard' || value === 'low_cost') {
      return value;
    }

    // Default by design: low-cost in bulk/list contexts.
    return 'low_cost';
  }

  private resolveAnalysisMode(
    requestedMode: AnalysisMode,
    content: string
  ): AnalysisMode {
    if (this.shouldUseLowCostPrompt(content)) {
      return 'low_cost';
    }

    return requestedMode;
  }

  private getAnalysisPromptTemplate(mode: AnalysisMode): string {
    switch (mode) {
      case 'moderate':
        return ANALYSIS_PROMPT_MODERATE;
      case 'standard':
        return ANALYSIS_PROMPT;
      case 'low_cost':
      default:
        return ANALYSIS_PROMPT_LOW_COST;
    }
  }

  private shouldUseLowCostPrompt(content: string): boolean {
    if (content.length < AUTO_LOW_COST_CONTENT_THRESHOLD) {
      return true;
    }

    return /no\s+se\s+pudo\s+acceder\s+al\s+art[ií]culo\s+completo/i.test(content);
  }

  private selectContentForAnalysis(content: string): string {
    if (content.length <= MAX_ARTICLE_CONTENT_LENGTH) {
      return content;
    }

    const head = content.slice(0, ANALYSIS_HEAD_CHARS).trim();
    const tail = content.slice(-ANALYSIS_TAIL_CHARS).trim();
    const quotesAndData = this.extractQuoteAndDataSnippets(content, ANALYSIS_QUOTES_DATA_CHARS);

    const selection = [
      '[META]',
      `original_length_chars=${content.length}`,
      `selection=HEAD(${ANALYSIS_HEAD_CHARS})+TAIL(${ANALYSIS_TAIL_CHARS})+QUOTES_DATA(${ANALYSIS_QUOTES_DATA_CHARS})`,
      '',
      '[HEAD]',
      head,
      '',
      '[TAIL]',
      tail,
      '',
      '[QUOTES_DATA]',
      quotesAndData,
    ].join('\n');

    return selection.substring(0, MAX_ARTICLE_CONTENT_LENGTH).trim();
  }

  private extractQuoteAndDataSnippets(content: string, maxChars: number): string {
    const snippetPattern =
      /(^|\n)([^.\n]{0,120}(?:"[^"\n]{3,120}"|'[^'\n]{3,120}'|\bhttps?:\/\/\S+|\b\d+(?:[.,]\d+)?\s?(?:%|USD|EUR|\$|millones|miles|years|anos|casos|personas|deaths?)\b)[^.\n]{0,120}(?:[.\n]|$))/gim;

    const snippets: string[] = [];
    const seen = new Set<string>();
    let totalChars = 0;

    for (const match of content.matchAll(snippetPattern)) {
      const snippet = (match[2] ?? '').replace(/\s+/g, ' ').trim();
      if (snippet.length < 20) {
        continue;
      }

      const key = snippet.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      const projected = totalChars + snippet.length + 1;
      if (projected > maxChars) {
        break;
      }

      snippets.push(snippet);
      seen.add(key);
      totalChars = projected;
    }

    if (snippets.length === 0) {
      return content.slice(0, Math.min(400, maxChars)).trim();
    }

    return snippets.join('\n');
  }

  private computeEscalation(params: {
    claims: string[];
    summary: string;
    reliabilityScore: number;
    traceabilityScore: number;
    clickbaitScore: number;
  }): boolean {
    const allClaims = [...params.claims, params.summary].join(' ');
    const hasHighRiskClaim = HIGH_RISK_CLAIM_PATTERNS.some((pattern) =>
      pattern.test(allClaims)
    );
    const hasStrongClaim =
      /\b(siempre|nunca|todo esta|todo está|demuestra|100%|sin duda|definitivo)\b/i.test(
        allClaims
      ) || hasHighRiskClaim;

    const veryLowTraceability =
      params.traceabilityScore <= 35 && params.reliabilityScore <= 50;
    const hasAnyClaim = params.claims.length > 0;
    const extremeClickbait = params.clickbaitScore >= 70;

    return (
      hasHighRiskClaim ||
      extremeClickbait ||
      (veryLowTraceability && (hasStrongClaim || hasAnyClaim))
    );
  }

  private hasStrongClaimsWithoutAttribution(params: {
    claims: string[];
    summary: string;
    content: string;
  }): boolean {
    const claimsText = [...params.claims, params.summary].join(' ');
    const hasHighRiskClaim = HIGH_RISK_CLAIM_PATTERNS.some((pattern) =>
      pattern.test(claimsText)
    );
    const hasStrongClaim =
      hasHighRiskClaim ||
      /\b(siempre|nunca|todo esta|todo está|demuestra|100%|sin duda|definitivo|urgente|esc[áa]ndalo|bomba|inminente)\b/i.test(
        claimsText
      );
    if (!hasStrongClaim) {
      return false;
    }

    const hasAttribution = /\b(seg[uú]n|according to|de acuerdo con|afirm[oó]|inform[oó]|report[oó]|ministerio|universidad|instituto|documento|informe)\b|https?:\/\/\S+|www\.\S+/i.test(
      params.content
    );
    return !hasAttribution;
  }

  /**
   * Validate and normalize factCheck verdict
   */
  private validateVerdict(verdict: unknown): FactCheckVerdict {
    if (typeof verdict !== 'string') {
      return 'InsufficientEvidenceInArticle';
    }

    const trimmed = verdict.trim();
    const validVerdicts: FactCheckVerdict[] = [
      'SupportedByArticle',
      'NotSupportedByArticle',
      'InsufficientEvidenceInArticle',
    ];
    if ((validVerdicts as string[]).includes(trimmed)) {
      return trimmed as FactCheckVerdict;
    }

    switch (trimmed) {
      case 'Verified':
        return 'SupportedByArticle';
      case 'False':
        return 'NotSupportedByArticle';
      case 'Mixed':
      case 'Unproven':
      default:
        return 'InsufficientEvidenceInArticle';
    }
  }

  /**
   * Auto-discover RSS URL for a given media name
   * 
   * FEATURE: RSS AUTO-DISCOVERY (Sprint 9)
   * Usa Gemini para encontrar la URL del feed RSS oficial de un medio dado.
   * 
   * @param mediaName Nombre del medio (e.g., "El PaÃ­s", "BBC News")
   * @returns URL del RSS si se encuentra, null si no existe o no se puede determinar
   */
  async discoverRssUrl(mediaName: string): Promise<string | null> {
    logger.info(
      { mediaLength: mediaName.length },
      'Starting RSS URL discovery'
    );

    // COST OPTIMIZATION: Prompt extraÃ­do a mÃ³dulo centralizado
    const prompt = buildRssDiscoveryPrompt(mediaName);

    try {
      // RESILIENCIA: executeWithRetry maneja reintentos automÃ¡ticos
      const result = await this.executeWithRetry(async () => {
        // ðŸ” Sprint 15 - Paso 3: Custom Span for RSS Discovery
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
      }, 2, 500); // 2 reintentos, 500ms delay (operaciÃ³n menos crÃ­tica)

      // Si la respuesta es literalmente "null" o vacÃ­a, retornar null
      if (result === 'null' || result === '' || result.length < 10) {
        logger.debug('No RSS URL found for media source');
        return null;
      }

      // Validar que sea una URL vÃ¡lida
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
      // RESILIENCIA: executeWithRetry maneja reintentos automÃ¡ticos
      const result = await this.executeWithRetry(async () => {
        // ðŸ” Sprint 24: Custom Span for Local Source Discovery
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
   * Obtiene el reporte de costes acumulados de la sesiÃ³n
   */
  getSessionCostReport() {
    return this.taximeter.getReport();
  }
}


