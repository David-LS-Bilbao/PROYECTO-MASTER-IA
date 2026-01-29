/**
 * GeminiClient Implementation (Infrastructure Layer)
 * Uses Google's Gemini API for article analysis
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import {
  IGeminiClient,
  AnalyzeContentInput,
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
  private readonly genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new ConfigurationError('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    // Modelo disponible en tu cuenta
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
