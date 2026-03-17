import { ArticleBiasAIInput, ArticleBiasAIResponse, IArticleBiasAIProvider } from '../../application/contracts/IArticleBiasAIProvider';

interface OpenAICompatibleProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  providerName: string;
  timeoutMs: number;
}

interface OpenAIChatCompletionResponse {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

export class OpenAICompatibleArticleBiasAIProvider implements IArticleBiasAIProvider {
  readonly providerName: string;
  readonly modelName: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: OpenAICompatibleProviderConfig) {
    this.providerName = config.providerName;
    this.modelName = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs;
  }

  async analyzeArticle(input: ArticleBiasAIInput): Promise<ArticleBiasAIResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: [
                'Eres un analista de sesgo ideologico de noticias politicas.',
                'Solo puedes usar el titular proporcionado; si no hay evidencia suficiente usa UNCLEAR y baja confianza.',
                'Devuelve SOLO un JSON estricto sin markdown ni texto extra.',
                'El JSON debe tener exactamente estas claves:',
                '{',
                '  "ideologyLabel": "LEFT|CENTER_LEFT|CENTER|CENTER_RIGHT|RIGHT|UNCLEAR",',
                '  "confidence": 0.0,',
                '  "summary": "resumen corto",',
                '  "reasoningShort": "justificacion breve"',
                '}'
              ].join('\n'),
            },
            {
              role: 'user',
              content: [
                `articleId: ${input.articleId}`,
                `title: ${input.title}`,
                `url: ${input.url}`,
                `publishedAt: ${input.publishedAt}`,
              ].join('\n'),
            }
          ]
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Proveedor IA respondio ${response.status}: ${errorBody.slice(0, 300)}`);
      }

      const payload = await response.json() as OpenAIChatCompletionResponse;
      const rawText = payload.choices?.[0]?.message?.content;

      if (!rawText || !rawText.trim()) {
        throw new Error('El proveedor IA no devolvio contenido util');
      }

      return {
        provider: this.providerName,
        model: payload.model ?? this.modelName,
        rawText,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Timeout llamando al proveedor IA');
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
