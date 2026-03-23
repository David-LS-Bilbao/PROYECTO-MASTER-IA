import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleArticleBiasAIProvider } from '../../src/infrastructure/ai/OpenAICompatibleArticleBiasAIProvider';

const originalFetch = global.fetch;

describe('OpenAICompatibleArticleBiasAIProvider', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('extrae usage real cuando el provider openai-compatible lo devuelve', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'gpt-4o-mini',
        usage: {
          prompt_tokens: 90,
          completion_tokens: 30,
          total_tokens: 120,
        },
        choices: [
          {
            message: {
              content:
                '{"ideologyLabel":"CENTER","confidence":0.55,"summary":"Resumen","reasoningShort":"Motivo"}',
            },
          },
        ],
      }),
    } as Response);

    const provider = new OpenAICompatibleArticleBiasAIProvider({
      apiKey: 'openai-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      providerName: 'openai-compatible',
      timeoutMs: 2000,
    });

    const result = await provider.analyzeArticle({
      articleId: 'article-1',
      title: 'El gobierno negocia con la oposición',
      url: 'https://example.com/article-1',
      publishedAt: '2026-03-17T10:00:00.000Z',
    });

    expect(result).toEqual({
      provider: 'openai-compatible',
      model: 'gpt-4o-mini',
      rawText: '{"ideologyLabel":"CENTER","confidence":0.55,"summary":"Resumen","reasoningShort":"Motivo"}',
      tokenUsage: {
        promptTokens: 90,
        completionTokens: 30,
        totalTokens: 120,
      },
      metadata: {
        providerType: 'openai-compatible',
        endpointPath: '/chat/completions',
        usageAvailable: true,
        choicesCount: 1,
      },
    });
  });
});
