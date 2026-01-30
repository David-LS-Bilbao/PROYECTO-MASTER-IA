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

const ANALYSIS_PROMPT = `Eres un analista de noticias experto. Analiza el siguiente artículo y proporciona un análisis estructurado en formato JSON.

IMPORTANTE: Responde SOLO con el JSON, sin texto adicional ni markdown.

Artículo a analizar:
Título: {title}
Fuente: {source}
Idioma: {language}

Contenido:
{content}

Proporciona el análisis con la siguiente estructura JSON:
{
  "summary": "Resumen conciso del artículo en 2-3 oraciones",
  "biasScore": 0.0 a 1.0 (0 = neutral, 1 = muy sesgado),
  "biasIndicators": ["lista de indicadores de sesgo encontrados"],
  "sentiment": "positive" | "negative" | "neutral",
  "mainTopics": ["tema1", "tema2", "tema3"],
  "factualClaims": ["afirmación factual 1", "afirmación factual 2"]
}

Criterios para el biasScore:
- 0.0-0.2: Neutral, factual, múltiples perspectivas
- 0.2-0.4: Ligero sesgo, lenguaje mayormente neutral
- 0.4-0.6: Sesgo moderado, omisión de perspectivas
- 0.6-0.8: Sesgo significativo, lenguaje emocional
- 0.8-1.0: Altamente sesgado, propaganda o desinformación`;

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

    try {
      console.log(`      [GeminiClient] Llamando a API...`);
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      console.log(`      [GeminiClient] Respuesta recibida OK`);

      return this.parseAnalysisResponse(text);
    } catch (error) {
      const err = error as Error;
      console.error(`      [GeminiClient] ERROR completo: ${err.message}`);

      if (err.message?.includes('API key')) {
        throw new ExternalAPIError('Gemini', 'Invalid API key', 401, err);
      }

      // Detectar modelo no encontrado (404)
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        throw new ExternalAPIError('Gemini', `Model not found: ${err.message}`, 404, err);
      }

      // Detectar rate limit
      if (err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED') ||
          err.message?.includes('429') || err.message?.includes('Too Many Requests')) {
        throw new ExternalAPIError('Gemini', 'Rate limit exceeded', 429, err);
      }

      throw new ExternalAPIError(
        'Gemini',
        `Analysis failed: ${err.message}`,
        500,
        err
      );
    }
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

      if (typeof parsed.biasScore !== 'number' || parsed.biasScore < 0 || parsed.biasScore > 1) {
        parsed.biasScore = 0.5; // Default to neutral if invalid
      }

      if (!Array.isArray(parsed.biasIndicators)) {
        parsed.biasIndicators = [];
      }

      if (!['positive', 'negative', 'neutral'].includes(parsed.sentiment)) {
        parsed.sentiment = 'neutral';
      }

      if (!Array.isArray(parsed.mainTopics)) {
        parsed.mainTopics = [];
      }

      if (!Array.isArray(parsed.factualClaims)) {
        parsed.factualClaims = [];
      }

      return {
        summary: parsed.summary,
        biasScore: parsed.biasScore,
        biasIndicators: parsed.biasIndicators,
        sentiment: parsed.sentiment,
        mainTopics: parsed.mainTopics,
        factualClaims: parsed.factualClaims,
      };
    } catch (error) {
      throw new ExternalAPIError(
        'Gemini',
        `Failed to parse analysis response: ${(error as Error).message}`,
        500
      );
    }
  }
}
