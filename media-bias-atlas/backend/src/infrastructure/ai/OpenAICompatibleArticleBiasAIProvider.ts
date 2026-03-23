import {
  ArticleBiasAIInput,
  ArticleBiasAIResponse,
  ArticleBiasProviderPromptDescriptors,
  IArticleBiasAIProvider,
} from '../../application/contracts/IArticleBiasAIProvider';
import {
  ARTICLE_BIAS_INPUT_CONTEXT_PROMPT_KEY,
  ARTICLE_BIAS_INPUT_CONTEXT_TEMPLATE,
  ARTICLE_BIAS_INSTRUCTIONS_PROMPT_KEY,
  ARTICLE_BIAS_INSTRUCTIONS_TEMPLATE,
  ARTICLE_BIAS_PROMPT_SOURCE_FILE,
  ARTICLE_BIAS_PROMPT_VERSION,
  buildArticleBiasInputContext,
  buildArticleBiasInstructions,
} from './articleBiasPrompt';

interface OpenAICompatibleProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  providerName: string;
  timeoutMs: number;
}

interface OpenAIChatCompletionResponse {
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
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

  getPromptDescriptors(): ArticleBiasProviderPromptDescriptors {
    return {
      primaryPrompt: {
        promptKey: ARTICLE_BIAS_INSTRUCTIONS_PROMPT_KEY,
        version: ARTICLE_BIAS_PROMPT_VERSION,
        template: ARTICLE_BIAS_INSTRUCTIONS_TEMPLATE,
        sourceFile: ARTICLE_BIAS_PROMPT_SOURCE_FILE,
      },
      relatedPrompts: [
        {
          promptKey: ARTICLE_BIAS_INPUT_CONTEXT_PROMPT_KEY,
          version: ARTICLE_BIAS_PROMPT_VERSION,
          template: ARTICLE_BIAS_INPUT_CONTEXT_TEMPLATE,
          sourceFile: ARTICLE_BIAS_PROMPT_SOURCE_FILE,
        },
      ],
    };
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
              content: buildArticleBiasInstructions(),
            },
            {
              role: 'user',
              content: buildArticleBiasInputContext(input),
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
        tokenUsage: {
          promptTokens: payload.usage?.prompt_tokens ?? null,
          completionTokens: payload.usage?.completion_tokens ?? null,
          totalTokens: payload.usage?.total_tokens ?? null,
        },
        metadata: {
          providerType: 'openai-compatible',
          endpointPath: '/chat/completions',
          usageAvailable: Boolean(payload.usage),
          choicesCount: payload.choices?.length ?? 0,
        },
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
