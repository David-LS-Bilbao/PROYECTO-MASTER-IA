import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { ArticleBiasAIInput, ArticleBiasAIResponse, IArticleBiasAIProvider } from '../../application/contracts/IArticleBiasAIProvider';
import { buildArticleBiasPrompt } from './articleBiasPrompt';

interface GeminiProviderConfig {
  apiKey: string;
  model: string;
  providerName: string;
  timeoutMs: number;
}

const DEFAULT_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 1000;

export class GeminiArticleBiasAIProvider implements IArticleBiasAIProvider {
  readonly providerName: string;
  readonly modelName: string;

  private readonly model: GenerativeModel;
  private readonly timeoutMs: number;

  constructor(config: GeminiProviderConfig) {
    if (!config.apiKey.trim()) {
      throw new Error('BIAS_AI_API_KEY es obligatoria para usar Gemini.');
    }

    this.providerName = config.providerName;
    this.modelName = config.model;
    this.timeoutMs = config.timeoutMs;

    const genAI = new GoogleGenerativeAI(config.apiKey);
    this.model = genAI.getGenerativeModel({ model: config.model });
  }

  async analyzeArticle(input: ArticleBiasAIInput): Promise<ArticleBiasAIResponse> {
    return this.executeWithRetry(async () => {
      const prompt = buildArticleBiasPrompt(input);
      const result = await this.withTimeout(
        this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            maxOutputTokens: 400,
          },
        }),
        this.timeoutMs
      );

      const rawText = result.response.text()?.trim();

      if (!rawText) {
        throw new Error('Gemini no devolvio contenido util');
      }

      return {
        provider: this.providerName,
        model: this.modelName,
        rawText,
      };
    });
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries: number = DEFAULT_RETRIES,
    initialDelayMs: number = DEFAULT_INITIAL_DELAY_MS
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!this.isRetryableError(error) || attempt >= retries) {
          throw this.mapProviderError(error);
        }

        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw this.mapProviderError(lastError);
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<T>((_resolve, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error('Timeout llamando al proveedor Gemini')), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private isRetryableError(error: unknown): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    return (
      message.includes('quota') ||
      message.includes('resource_exhausted') ||
      message.includes('429') ||
      message.includes('too many requests') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('internal server error') ||
      message.includes('service unavailable') ||
      message.includes('gateway timeout') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('enotfound')
    );
  }

  private mapProviderError(error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();

    if (normalized.includes('api key') || normalized.includes('401')) {
      return new Error('API key Gemini invalida o no autorizada');
    }

    if (normalized.includes('404') || normalized.includes('not found')) {
      return new Error(`Modelo Gemini no encontrado: ${this.modelName}`);
    }

    if (normalized.includes('timeout')) {
      return new Error('Timeout llamando al proveedor Gemini');
    }

    return new Error(`Proveedor Gemini error: ${message}`);
  }
}
