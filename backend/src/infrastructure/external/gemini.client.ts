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

// ============================================================================
// TOKEN TAXIMETER - PRICING CONSTANTS (Gemini 2.5 Flash)
// ============================================================================

/**
 * Precio por 1 millón de tokens de entrada (USD)
 * Fuente: https://ai.google.dev/pricing
 */
const PRICE_INPUT_1M = 0.075;

/**
 * Precio por 1 millón de tokens de salida (USD)
 */
const PRICE_OUTPUT_1M = 0.30;

/**
 * Ratio de conversión EUR/USD
 */
const EUR_USD_RATE = 0.95;

// ============================================================================
// TOKEN TAXIMETER - SESSION ACCUMULATOR
// ============================================================================

/**
 * Acumulador de costes por sesión del servidor
 * Se reinicia cuando se reinicia el servidor
 */
interface SessionCostAccumulator {
  analysisCount: number;
  analysisTotalTokens: number;
  analysisTotalCost: number;
  ragChatCount: number;
  ragChatTotalTokens: number;
  ragChatTotalCost: number;
  groundingChatCount: number;
  groundingChatTotalTokens: number;
  groundingChatTotalCost: number;
  sessionStart: Date;
}

const sessionCosts: SessionCostAccumulator = {
  analysisCount: 0,
  analysisTotalTokens: 0,
  analysisTotalCost: 0,
  ragChatCount: 0,
  ragChatTotalTokens: 0,
  ragChatTotalCost: 0,
  groundingChatCount: 0,
  groundingChatTotalTokens: 0,
  groundingChatTotalCost: 0,
  sessionStart: new Date(),
};

/**
 * Resetea el acumulador de sesión (solo para testing)
 * @internal
 */
export function resetSessionCosts(): void {
  sessionCosts.analysisCount = 0;
  sessionCosts.analysisTotalTokens = 0;
  sessionCosts.analysisTotalCost = 0;
  sessionCosts.ragChatCount = 0;
  sessionCosts.ragChatTotalTokens = 0;
  sessionCosts.ragChatTotalCost = 0;
  sessionCosts.groundingChatCount = 0;
  sessionCosts.groundingChatTotalTokens = 0;
  sessionCosts.groundingChatTotalCost = 0;
  sessionCosts.sessionStart = new Date();
}

/**
 * Calcula el coste en EUR a partir de tokens
 */
function calculateCostEUR(promptTokens: number, completionTokens: number): number {
  const costInputUSD = (promptTokens / 1_000_000) * PRICE_INPUT_1M;
  const costOutputUSD = (completionTokens / 1_000_000) * PRICE_OUTPUT_1M;
  return (costInputUSD + costOutputUSD) * EUR_USD_RATE;
}

/**
 * Muestra el log visual del taxímetro
 */
function logTaximeter(
  operationType: 'ANÁLISIS' | 'CHAT RAG' | 'CHAT GROUNDING',
  title: string,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number,
  costEUR: number
): void {
  const emoji = operationType === 'ANÁLISIS' ? '📰' : operationType === 'CHAT RAG' ? '💬' : '🌐';
  const titlePreview = title.substring(0, 45) + (title.length > 45 ? '...' : '');

  console.log(`\n      🧾 ═══════════════════════════════════════════════════════════`);
  console.log(`      🧾 TOKEN TAXIMETER - ${operationType}`);
  console.log(`      🧾 ═══════════════════════════════════════════════════════════`);
  console.log(`      ${emoji} ${operationType === 'ANÁLISIS' ? 'Título' : 'Pregunta'}: "${titlePreview}"`);
  console.log(`      🧠 Tokens entrada:  ${promptTokens.toLocaleString('es-ES')}`);
  console.log(`      🧠 Tokens salida:   ${completionTokens.toLocaleString('es-ES')}`);
  console.log(`      🧠 Tokens TOTAL:    ${totalTokens.toLocaleString('es-ES')}`);
  console.log(`      💰 Coste operación: €${costEUR.toFixed(6)}`);
  console.log(`      🧾 ───────────────────────────────────────────────────────────`);

  // Mostrar acumulado de sesión
  const totalSessionCost = sessionCosts.analysisTotalCost + sessionCosts.ragChatTotalCost + sessionCosts.groundingChatTotalCost;
  const totalSessionTokens = sessionCosts.analysisTotalTokens + sessionCosts.ragChatTotalTokens + sessionCosts.groundingChatTotalTokens;
  const totalOperations = sessionCosts.analysisCount + sessionCosts.ragChatCount + sessionCosts.groundingChatCount;

  console.log(`      📊 SESIÓN ACUMULADA (desde ${sessionCosts.sessionStart.toLocaleTimeString('es-ES')}):`);
  console.log(`      📊 Análisis: ${sessionCosts.analysisCount} ops | ${sessionCosts.analysisTotalTokens.toLocaleString('es-ES')} tokens | €${sessionCosts.analysisTotalCost.toFixed(6)}`);
  console.log(`      📊 Chat RAG: ${sessionCosts.ragChatCount} ops | ${sessionCosts.ragChatTotalTokens.toLocaleString('es-ES')} tokens | €${sessionCosts.ragChatTotalCost.toFixed(6)}`);
  console.log(`      📊 Grounding: ${sessionCosts.groundingChatCount} ops | ${sessionCosts.groundingChatTotalTokens.toLocaleString('es-ES')} tokens | €${sessionCosts.groundingChatTotalCost.toFixed(6)}`);
  console.log(`      💰 TOTAL SESIÓN: ${totalOperations} ops | ${totalSessionTokens.toLocaleString('es-ES')} tokens | €${totalSessionCost.toFixed(6)}`);
  console.log(`      🧾 ═══════════════════════════════════════════════════════════\n`);
}

// ============================================================================
// COST OPTIMIZATION CONSTANTS
// ============================================================================

/**
 * Máximo de mensajes enviados a Gemini en chat con historial.
 *
 * RAZÓN DE OPTIMIZACIÓN:
 * - Sin límite, cada mensaje reenvía TODO el historial anterior
 * - Mensaje 50 incluye los 49 anteriores = coste exponencial
 * - Con ventana de 6 mensajes (3 turnos), el coste es constante
 * - Ahorro estimado: ~70% en conversaciones largas
 *
 * VALOR: 6 mensajes = últimos 3 turnos (user→assistant→user→assistant→user→assistant)
 */
const MAX_CHAT_HISTORY_MESSAGES = 6;

/**
 * Límite de caracteres para contenido de artículo en análisis.
 * Evita enviar artículos enormes que consumen tokens innecesarios.
 */
const MAX_ARTICLE_CONTENT_LENGTH = 8000;

/**
 * Límite de caracteres para texto de embedding.
 * El modelo text-embedding-004 tiene límite de ~8000 tokens.
 */
const MAX_EMBEDDING_TEXT_LENGTH = 6000;

// ============================================================================
// OPTIMIZED PROMPTS
// ============================================================================

/**
 * ANALYSIS_PROMPT - Versión optimizada
 *
 * CAMBIOS vs versión anterior:
 * - Eliminado rol verboso ("Actúa como un analista experto...")
 * - Eliminado campo IDIOMA (se infiere del contenido)
 * - Escalas compactadas en una línea cada una
 * - Eliminados ejemplos en arrays (["indicador1", "indicador2"])
 * - Añadidos límites explícitos (max 3, max 50 palabras, 1 frase)
 * - Reducido summary de 60 a 50 palabras
 *
 * AHORRO: ~700 tokens → ~250 tokens (~65% reducción)
 */
const ANALYSIS_PROMPT = `Analiza esta noticia. Responde SOLO con JSON válido (sin markdown, sin backticks).

TÍTULO: {title}
FUENTE: {source}
CONTENIDO:
{content}

Devuelve este JSON exacto:
{"summary":"<max 50 palabras: qué, quién, cuándo>","biasScore":<-10 a +10>,"biasIndicators":["<max 3 indicadores>"],"clickbaitScore":<0-100>,"reliabilityScore":<0-100>,"sentiment":"positive|neutral|negative","mainTopics":["<max 3>"],"factCheck":{"claims":["<max 2 afirmaciones clave>"],"verdict":"Verified|Mixed|Unproven|False","reasoning":"<1 frase explicativa>"}}

ESCALAS:
- biasScore: -10=izquierda extrema, 0=neutral, +10=derecha extrema
- clickbaitScore: 0=serio, 50=sensacionalista, 100=engañoso
- reliabilityScore: 0=bulo, 50=parcial, 100=verificado con fuentes oficiales
- verdict: Verified=comprobado, Mixed=parcial, Unproven=sin datos, False=falso`;

export class GeminiClient implements IGeminiClient {
  private readonly model: GenerativeModel;
  private readonly chatModel: GenerativeModel;
  private readonly genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new ConfigurationError('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);

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
        if (this.isNonRetryableError(errorMessage)) {
          throw this.wrapError(lastError);
        }

        // Verificar si es error retriable
        const isRetryable = this.isRetryableError(errorMessage);

        if (!isRetryable || attempt >= retries) {
          // Último intento o error no retriable
          throw this.wrapError(lastError);
        }

        // Calcular delay con exponential backoff
        const delay = initialDelay * Math.pow(2, attempt - 1);
        
        console.warn(
          `⚠️ [GeminiClient] Gemini API error (intento ${attempt}/${retries}): ${errorMessage}. ` +
          `Reintentando en ${delay}ms...`
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
   * Verifica si un error NO debe ser reintentado
   */
  private isNonRetryableError(errorMessage: string): boolean {
    return (
      errorMessage.includes('API key') ||
      errorMessage.includes('401') ||
      errorMessage.includes('404') ||
      errorMessage.includes('not found') ||
      errorMessage.includes('Invalid argument')
    );
  }

  /**
   * Verifica si un error debe ser reintentado
   * Solo reintentar Rate Limits (429) y Server Errors (5xx)
   */
  private isRetryableError(errorMessage: string): boolean {
    return (
      // Rate Limit (429)
      errorMessage.includes('quota') ||
      errorMessage.includes('RESOURCE_EXHAUSTED') ||
      errorMessage.includes('429') ||
      errorMessage.includes('Too Many Requests') ||
      // Server Errors (5xx)
      errorMessage.includes('500') ||
      errorMessage.includes('502') ||
      errorMessage.includes('503') ||
      errorMessage.includes('504') ||
      errorMessage.includes('Internal Server Error') ||
      errorMessage.includes('Service Unavailable') ||
      errorMessage.includes('Gateway Timeout') ||
      // Network errors
      errorMessage.includes('ECONNRESET') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('ENOTFOUND')
    );
  }

  /**
   * Envuelve un error en ExternalAPIError con el código HTTP apropiado
   */
  private wrapError(error: Error): ExternalAPIError {
    const errorMessage = error.message || '';

    // 401 - Unauthorized (API key inválida)
    if (errorMessage.includes('API key') || errorMessage.includes('401')) {
      return new ExternalAPIError('Gemini', 'Invalid API key', 401, error);
    }

    // 404 - Not Found (Modelo no encontrado)
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      return new ExternalAPIError('Gemini', `Model not found: ${errorMessage}`, 404, error);
    }

    // 429 - Rate Limit
    if (this.isRetryableError(errorMessage) && 
        (errorMessage.includes('429') || errorMessage.includes('quota'))) {
      return new ExternalAPIError('Gemini', 'Rate limit exceeded after retries', 429, error);
    }

    // 500 - Generic server error
    return new ExternalAPIError('Gemini', `API error: ${errorMessage}`, 500, error);
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
      console.log(`      [GeminiClient] Analizando artículo: "${sanitizedTitle.substring(0, 40)}..."`);
      
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // TOKEN TAXIMETER: Capturar uso de tokens
      const usageMetadata = response.usageMetadata;
      let tokenUsage: TokenUsage | undefined;

      if (usageMetadata) {
        const promptTokens = usageMetadata.promptTokenCount || 0;
        const completionTokens = usageMetadata.candidatesTokenCount || 0;
        const totalTokens = usageMetadata.totalTokenCount || (promptTokens + completionTokens);
        const costEstimated = calculateCostEUR(promptTokens, completionTokens);

        tokenUsage = {
          promptTokens,
          completionTokens,
          totalTokens,
          costEstimated,
        };

        // Actualizar acumulador de sesión
        sessionCosts.analysisCount++;
        sessionCosts.analysisTotalTokens += totalTokens;
        sessionCosts.analysisTotalCost += costEstimated;

        // Log visual
        logTaximeter('ANÁLISIS', sanitizedTitle, promptTokens, completionTokens, totalTokens, costEstimated);
      } else {
        console.log(`      [GeminiClient] Respuesta recibida OK (sin metadata de tokens)`);
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
      console.log(`      [GeminiClient] Generando embedding (${truncatedText.length} chars)...`);

      const embeddingModel = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const result = await embeddingModel.embedContent(truncatedText);
      const embedding = result.embedding.values;

      console.log(`      [GeminiClient] Embedding OK - dimensiones: ${embedding.length}`);
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
      console.log(`      [GeminiClient] Chat - Historial truncado: ${messages.length} → ${recentMessages.length} mensajes`);
    }

    // Build the conversation with system context (formato compacto)
    const conversationParts: string[] = [];
    conversationParts.push(`[CONTEXTO]\n${systemContext}`);
    conversationParts.push('\n[HISTORIAL]');

    // Add message history (formato compacto: U/A en lugar de Usuario/Asistente)
    for (const msg of recentMessages) {
      const roleLabel = msg.role === 'user' ? 'U' : 'A';
      conversationParts.push(`${roleLabel}: ${msg.content}`);
    }

    conversationParts.push('\nResponde a la última pregunta.');
    const prompt = conversationParts.join('\n');

    // RESILIENCIA: executeWithRetry maneja reintentos automáticos
    return this.executeWithRetry(async () => {
      console.log(`      [GeminiClient] Chat (con Google Search) - Enviando conversación...`);
      
      const result = await this.chatModel.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Log if grounding was used
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      if (groundingMetadata?.searchEntryPoint) {
        console.log(`      [GeminiClient] Chat - Google Search utilizado para grounding`);
      }

      // TOKEN TAXIMETER: Capturar uso de tokens para chat grounding
      const usageMetadata = response.usageMetadata;
      if (usageMetadata) {
        const promptTokens = usageMetadata.promptTokenCount || 0;
        const completionTokens = usageMetadata.candidatesTokenCount || 0;
        const totalTokens = usageMetadata.totalTokenCount || (promptTokens + completionTokens);
        const costEstimated = calculateCostEUR(promptTokens, completionTokens);

        // Actualizar acumulador de sesión
        sessionCosts.groundingChatCount++;
        sessionCosts.groundingChatTotalTokens += totalTokens;
        sessionCosts.groundingChatTotalCost += costEstimated;

        // Obtener la última pregunta del usuario para el log
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        const questionPreview = lastUserMessage?.content || 'Conversación';

        // Log visual
        logTaximeter('CHAT GROUNDING', questionPreview, promptTokens, completionTokens, totalTokens, costEstimated);
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

    // COST OPTIMIZATION: Prompt compacto (antes ~370 tokens, ahora ~120 tokens)
    const ragPrompt = `Asistente de noticias. Responde en español, max 150 palabras.

REGLAS:
- Prioriza el CONTEXTO. Si no está ahí, usa conocimiento general con prefijo "Según información general..."
- Formato: bullets para listas, **negrita** para datos clave, párrafos cortos (2-3 líneas max)

[CONTEXTO]
${context}

[PREGUNTA]
${question}`;

    // RESILIENCIA: executeWithRetry maneja reintentos automáticos
    return this.executeWithRetry(async () => {
      console.log(`      [GeminiClient] RAG Chat - Generando respuesta...`);
      
      const result = await this.model.generateContent(ragPrompt);
      const response = result.response;
      const text = response.text().trim();

      // TOKEN TAXIMETER: Capturar uso de tokens para RAG chat
      const usageMetadata = response.usageMetadata;
      if (usageMetadata) {
        const promptTokens = usageMetadata.promptTokenCount || 0;
        const completionTokens = usageMetadata.candidatesTokenCount || 0;
        const totalTokens = usageMetadata.totalTokenCount || (promptTokens + completionTokens);
        const costEstimated = calculateCostEUR(promptTokens, completionTokens);

        // Actualizar acumulador de sesión
        sessionCosts.ragChatCount++;
        sessionCosts.ragChatTotalTokens += totalTokens;
        sessionCosts.ragChatTotalCost += costEstimated;

        // Log visual
        logTaximeter('CHAT RAG', question, promptTokens, completionTokens, totalTokens, costEstimated);
      }

      return text;
    }, 3, 1000); // 3 reintentos, 1s delay inicial
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

      // biasScore: now -10 to +10, normalize to 0-1 for UI compatibility
      let biasRaw = 0;
      if (typeof parsed.biasScore === 'number') {
        // Clamp to valid range
        biasRaw = Math.max(-10, Math.min(10, parsed.biasScore));
      }
      // Normalize: abs(biasRaw)/10 gives 0-1 where 0 is neutral, 1 is extreme
      const biasScoreNormalized = Math.abs(biasRaw) / 10;

      if (!Array.isArray(parsed.biasIndicators)) {
        parsed.biasIndicators = [];
      }

      // clickbaitScore: 0-100
      let clickbaitScore = 50; // Default to moderate
      if (typeof parsed.clickbaitScore === 'number') {
        clickbaitScore = Math.max(0, Math.min(100, parsed.clickbaitScore));
      }

      // reliabilityScore: 0-100
      let reliabilityScore = 50; // Default to moderate
      if (typeof parsed.reliabilityScore === 'number') {
        reliabilityScore = Math.max(0, Math.min(100, parsed.reliabilityScore));
      }

      // Normalize sentiment to lowercase
      let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
      const sentimentRaw = String(parsed.sentiment || 'neutral').toLowerCase();
      if (['positive', 'negative', 'neutral'].includes(sentimentRaw)) {
        sentiment = sentimentRaw as 'positive' | 'negative' | 'neutral';
      }

      if (!Array.isArray(parsed.mainTopics)) {
        parsed.mainTopics = [];
      }

      // Parse factCheck object
      const factCheck = {
        claims: Array.isArray(parsed.factCheck?.claims) ? parsed.factCheck.claims : [],
        verdict: this.validateVerdict(parsed.factCheck?.verdict),
        reasoning: typeof parsed.factCheck?.reasoning === 'string'
          ? parsed.factCheck.reasoning
          : 'Sin información suficiente para verificar',
      };

      // Legacy factualClaims for backwards compatibility
      const factualClaims = factCheck.claims.length > 0
        ? factCheck.claims
        : (Array.isArray(parsed.factualClaims) ? parsed.factualClaims : []);

      return {
        summary: parsed.summary,
        biasScore: biasScoreNormalized,
        biasRaw,
        biasIndicators: parsed.biasIndicators,
        clickbaitScore,
        reliabilityScore,
        sentiment,
        mainTopics: parsed.mainTopics,
        factCheck,
        factualClaims,
        // Token Taximeter: Include usage if available
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
    console.log(`🔍 Buscando RSS automático para: "${mediaName}"`);

    const prompt = `El usuario busca el RSS de: '${mediaName}'. Devuelve EXCLUSIVAMENTE la URL del feed RSS oficial más probable. Sin texto, sin markdown, solo la URL. Si no tiene RSS o no lo sabes, devuelve 'null'.`;

    try {
      // RESILIENCIA: executeWithRetry maneja reintentos automáticos
      const result = await this.executeWithRetry(async () => {
        const response = await this.model.generateContent(prompt);
        return response.response.text().trim().replace(/['"]/g, '');
      }, 2, 500); // 2 reintentos, 500ms delay (operación menos crítica)

      // Si la respuesta es literalmente "null" o vacía, retornar null
      if (result === 'null' || result === '' || result.length < 10) {
        console.log(`❌ No se encontró RSS para "${mediaName}"`);
        return null;
      }

      // Validar que sea una URL válida
      try {
        new URL(result);
        console.log(`✅ RSS encontrado: ${result}`);
        return result;
      } catch {
        console.log(`⚠️ Respuesta inválida (no es URL): ${result}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error al buscar RSS: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Obtiene el reporte de costes acumulados de la sesión
   */
  getSessionCostReport() {
    const totalSessionCost = sessionCosts.analysisTotalCost + sessionCosts.ragChatTotalCost + sessionCosts.groundingChatTotalCost;
    const totalSessionTokens = sessionCosts.analysisTotalTokens + sessionCosts.ragChatTotalTokens + sessionCosts.groundingChatTotalTokens;
    const totalOperations = sessionCosts.analysisCount + sessionCosts.ragChatCount + sessionCosts.groundingChatCount;

    return {
      analysis: {
        count: sessionCosts.analysisCount,
        tokens: sessionCosts.analysisTotalTokens,
        cost: sessionCosts.analysisTotalCost,
      },
      ragChat: {
        count: sessionCosts.ragChatCount,
        tokens: sessionCosts.ragChatTotalTokens,
        cost: sessionCosts.ragChatTotalCost,
      },
      groundingChat: {
        count: sessionCosts.groundingChatCount,
        tokens: sessionCosts.groundingChatTotalTokens,
        cost: sessionCosts.groundingChatTotalCost,
      },
      total: {
        operations: totalOperations,
        tokens: totalSessionTokens,
        cost: totalSessionCost,
      },
      sessionStart: sessionCosts.sessionStart,
      uptime: Date.now() - sessionCosts.sessionStart.getTime(),
    };
  }
}
