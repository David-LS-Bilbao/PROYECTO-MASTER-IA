/**
 * GeminiClient Implementation (Infrastructure Layer)
 * Uses Google's Gemini API for article analysis
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import {
  IGeminiClient,
  AnalyzeContentInput,
  ChatWithContextInput,
  ChatResponse,
} from '../../domain/services/gemini-client.interface';
import { ArticleAnalysis } from '../../domain/entities/news-article.entity';
import {
  ExternalAPIError,
  ConfigurationError,
} from '../../domain/errors/infrastructure.error';

const ANALYSIS_PROMPT = `Actúa como un analista de veracidad de noticias experto. Analiza el siguiente artículo de forma objetiva y rigurosa.

IMPORTANTE: Responde SOLO con el JSON, sin texto adicional, sin markdown, sin backticks.

Artículo a analizar:
TÍTULO: {title}
FUENTE: {source}
IDIOMA: {language}

CONTENIDO:
{content}

Devuelve un JSON estricto con este formato exacto:
{
  "summary": "Resumen objetivo en máximo 50 palabras",
  "biasScore": number,
  "biasIndicators": ["indicador1", "indicador2"],
  "clickbaitScore": number,
  "reliabilityScore": number,
  "sentiment": "positive" | "neutral" | "negative",
  "mainTopics": ["Tema1", "Tema2", "Tema3"],
  "factCheck": {
    "claims": ["Afirmación 1 detectada", "Afirmación 2 detectada"],
    "verdict": "Verified" | "Mixed" | "Unproven" | "False",
    "reasoning": "Explicación breve del veredicto"
  }
}

CRITERIOS DE PUNTUACIÓN:

biasScore (-10 a +10):
- -10 a -6: Extrema izquierda (lenguaje muy ideológico progresista)
- -5 a -2: Izquierda moderada
- -1 a +1: Neutral/Centro (factual, múltiples perspectivas)
- +2 a +5: Derecha moderada
- +6 a +10: Extrema derecha (lenguaje muy ideológico conservador)

clickbaitScore (0 a 100):
- 0-20: Titular serio y descriptivo
- 21-50: Algo sensacionalista pero informativo
- 51-80: Claramente clickbait, exagerado
- 81-100: Clickbait extremo, engañoso

reliabilityScore (0 a 100):
- 0-20: Bulo, desinformación clara, sin fuentes
- 21-40: Opinión presentada como hecho, fuentes dudosas
- 41-60: Parcialmente verificable, algunas fuentes
- 61-80: Mayormente fiable, fuentes identificables
- 81-100: Altamente contrastado, fuentes oficiales/múltiples

factCheck.verdict:
- "Verified": Afirmaciones verificables con fuentes oficiales
- "Mixed": Algunas afirmaciones verificadas, otras no
- "Unproven": No hay suficiente información para verificar
- "False": Contiene afirmaciones demostrablemente falsas`;

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
    const { title, content, source, language } = input;

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

    const prompt = ANALYSIS_PROMPT.replace('{title}', sanitizedTitle)
      .replace('{source}', sanitizedSource)
      .replace('{language}', language)
      .replace('{content}', sanitizedContent.substring(0, 10000)); // Limit content length

    // Resilience: Retry with exponential backoff for transient failures
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`      [GeminiClient] Analizando artículo (intento ${attempt}/${maxRetries})...`);
        const result = await this.model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        console.log(`      [GeminiClient] Respuesta recibida OK`);

        return this.parseAnalysisResponse(text);
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

    // Truncate text to avoid token limits (max ~8000 tokens for embedding model)
    const truncatedText = text.substring(0, 8000);
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
   */
  async chatWithContext(input: ChatWithContextInput): Promise<ChatResponse> {
    const { systemContext, messages } = input;

    if (!messages || messages.length === 0) {
      throw new ExternalAPIError('Gemini', 'At least one message is required', 400);
    }

    // Build the conversation with system context
    const conversationParts: string[] = [];

    // Add system context as the foundation
    conversationParts.push(`CONTEXTO DEL SISTEMA:\n${systemContext}\n`);
    conversationParts.push('---\nHISTORIAL DE CONVERSACIÓN:\n');

    // Add message history
    for (const msg of messages) {
      const roleLabel = msg.role === 'user' ? 'Usuario' : 'Asistente';
      conversationParts.push(`${roleLabel}: ${msg.content}`);
    }

    // Instruction moved to use case (system prompt)
    conversationParts.push('\n---\nResponde a la última pregunta del usuario.');

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
   */
  async generateChatResponse(context: string, question: string): Promise<string> {
    if (!context || context.trim().length === 0) {
      throw new ExternalAPIError('Gemini', 'Context is required for RAG response', 400);
    }

    if (!question || question.trim().length === 0) {
      throw new ExternalAPIError('Gemini', 'Question is required', 400);
    }

    const ragPrompt = `Eres un asistente de noticias objetivo. Responde a la pregunta del usuario basándote ÚNICAMENTE en el contexto proporcionado.

REGLAS ESTRICTAS:
1. SOLO usa información del contexto proporcionado abajo.
2. Si la respuesta NO está en el contexto, responde: "No encuentro esa información en el artículo."
3. Sé conciso y directo.
4. Responde en español.
5. No inventes información ni uses conocimiento externo.

=== CONTEXTO ===
${context}

=== PREGUNTA DEL USUARIO ===
${question}

=== TU RESPUESTA ===`;

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
   */
  private parseAnalysisResponse(text: string): ArticleAnalysis {
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
