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

    // Resilience: Retry with exponential backoff for transient failures
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`      [GeminiClient] Analizando artículo (intento ${attempt}/${maxRetries})...`);
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

          // Calcular coste en USD
          const costInputUSD = (promptTokens / 1_000_000) * PRICE_INPUT_1M;
          const costOutputUSD = (completionTokens / 1_000_000) * PRICE_OUTPUT_1M;
          const costTotalUSD = costInputUSD + costOutputUSD;

          // Convertir a EUR
          const costEstimated = costTotalUSD * EUR_USD_RATE;

          tokenUsage = {
            promptTokens,
            completionTokens,
            totalTokens,
            costEstimated,
          };

          // TOKEN TAXIMETER: Log visual
          const titlePreview = sanitizedTitle.substring(0, 50) + (sanitizedTitle.length > 50 ? '...' : '');
          console.log(`\n      🧾 ═══════════════════════════════════════════════════════════`);
          console.log(`      🧾 TOKEN TAXIMETER - Análisis de Noticia`);
          console.log(`      🧾 ═══════════════════════════════════════════════════════════`);
          console.log(`      📰 Título: "${titlePreview}"`);
          console.log(`      🧠 Tokens entrada:  ${promptTokens.toLocaleString('es-ES')}`);
          console.log(`      🧠 Tokens salida:   ${completionTokens.toLocaleString('es-ES')}`);
          console.log(`      🧠 Tokens TOTAL:    ${totalTokens.toLocaleString('es-ES')}`);
          console.log(`      💰 Coste estimado:  €${costEstimated.toFixed(6)}`);
          console.log(`      🧾 ═══════════════════════════════════════════════════════════\n`);
        } else {
          console.log(`      [GeminiClient] Respuesta recibida OK (sin metadata de tokens)`);
        }

        return this.parseAnalysisResponse(text, tokenUsage);
      } catch (error) {
        lastError = error as Error;
        console.warn(`      [GeminiClient] Intento ${attempt} falló: ${lastError.message}`);

        // Don't retry on non-transient errors
        if (lastError.message?.includes('API key') || lastError.message?.includes('401')) {
          throw new ExternalAPIError('Gemini', 'Invalid API key', 401, lastError);
        }

        if (lastError.message?.includes('404') || lastError.message?.includes('not found')) {
          throw new ExternalAPIError('Gemini', `Model not found: ${lastError.message}`, 404, lastError);
        }

        // Retry on rate limit (429) with exponential backoff
        const isRateLimited = lastError.message?.includes('quota') ||
          lastError.message?.includes('RESOURCE_EXHAUSTED') ||
          lastError.message?.includes('429') ||
          lastError.message?.includes('Too Many Requests');

        if (isRateLimited && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`      [GeminiClient] Rate limit - esperando ${delay}ms antes de reintentar...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // If rate limited on last attempt, throw specific error
        if (isRateLimited) {
          throw new ExternalAPIError('Gemini', 'Rate limit exceeded after retries', 429, lastError);
        }

        // For other errors, retry with backoff
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 500; // 1s, 2s
          console.log(`      [GeminiClient] Esperando ${delay}ms antes de reintentar...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new ExternalAPIError(
      'Gemini',
      `Analysis failed after ${maxRetries} attempts: ${lastError?.message}`,
      500,
      lastError || undefined
    );
  }

  async isAvailable(): Promise<boolean> {
    try {
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
    // El modelo soporta ~8000 tokens pero usamos 6000 para margen de seguridad
    const truncatedText = text.substring(0, MAX_EMBEDDING_TEXT_LENGTH);
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`      [GeminiClient] Generando embedding (intento ${attempt}/${maxRetries})...`);

        const embeddingModel = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
        const result = await embeddingModel.embedContent(truncatedText);
        const embedding = result.embedding.values;

        console.log(`      [GeminiClient] Embedding OK - dimensiones: ${embedding.length}`);
        return embedding;

      } catch (error) {
        lastError = error as Error;
        console.warn(`      [GeminiClient] Embedding intento ${attempt} falló: ${lastError.message}`);

        // Don't retry on non-transient errors
        if (lastError.message?.includes('API key') || lastError.message?.includes('401')) {
          throw new ExternalAPIError('Gemini', 'Invalid API key', 401, lastError);
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`      [GeminiClient] Esperando ${delay}ms antes de reintentar...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new ExternalAPIError(
      'Gemini',
      `Embedding generation failed after ${maxRetries} attempts: ${lastError?.message}`,
      500,
      lastError || undefined
    );
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
    // Esto evita que el coste crezca exponencialmente con cada mensaje
    const recentMessages = messages.slice(-MAX_CHAT_HISTORY_MESSAGES);

    if (messages.length > MAX_CHAT_HISTORY_MESSAGES) {
      console.log(`      [GeminiClient] Chat - Historial truncado: ${messages.length} → ${recentMessages.length} mensajes`);
    }

    // Build the conversation with system context (formato compacto)
    const conversationParts: string[] = [];

    // Add system context as the foundation
    conversationParts.push(`[CONTEXTO]\n${systemContext}`);
    conversationParts.push('\n[HISTORIAL]');

    // Add message history (formato compacto: U/A en lugar de Usuario/Asistente)
    for (const msg of recentMessages) {
      const roleLabel = msg.role === 'user' ? 'U' : 'A';
      conversationParts.push(`${roleLabel}: ${msg.content}`);
    }

    conversationParts.push('\nResponde a la última pregunta.');

    const prompt = conversationParts.join('\n');

    try {
      console.log(`      [GeminiClient] Chat (con Google Search) - Enviando conversación...`);
      // Use chatModel which has Google Search Grounding enabled
      const result = await this.chatModel.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Log if grounding was used
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      if (groundingMetadata?.searchEntryPoint) {
        console.log(`      [GeminiClient] Chat - Google Search utilizado para grounding`);
      }

      console.log(`      [GeminiClient] Chat - Respuesta recibida OK`);

      return { message: text.trim() };
    } catch (error) {
      const err = error as Error;
      console.error(`      [GeminiClient] Chat ERROR: ${err.message}`);

      if (err.message?.includes('API key')) {
        throw new ExternalAPIError('Gemini', 'Invalid API key', 401, err);
      }

      if (err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED') ||
          err.message?.includes('429') || err.message?.includes('Too Many Requests')) {
        throw new ExternalAPIError('Gemini', 'Rate limit exceeded', 429, err);
      }

      throw new ExternalAPIError(
        'Gemini',
        `Chat failed: ${err.message}`,
        500,
        err
      );
    }
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

    try {
      console.log(`      [GeminiClient] RAG Chat - Generando respuesta...`);
      // Use base model (no Google Search) for pure RAG
      const result = await this.model.generateContent(ragPrompt);
      const response = result.response;
      const text = response.text().trim();

      console.log(`      [GeminiClient] RAG Chat - Respuesta OK (${text.length} chars)`);
      return text;
    } catch (error) {
      const err = error as Error;
      console.error(`      [GeminiClient] RAG Chat ERROR: ${err.message}`);

      if (err.message?.includes('API key')) {
        throw new ExternalAPIError('Gemini', 'Invalid API key', 401, err);
      }

      if (err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED') ||
          err.message?.includes('429') || err.message?.includes('Too Many Requests')) {
        throw new ExternalAPIError('Gemini', 'Rate limit exceeded', 429, err);
      }

      throw new ExternalAPIError(
        'Gemini',
        `RAG Chat failed: ${err.message}`,
        500,
        err
      );
    }
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
}
