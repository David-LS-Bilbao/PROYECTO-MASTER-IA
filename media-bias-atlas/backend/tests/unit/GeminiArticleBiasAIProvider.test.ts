import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  generateContentMock,
  getGenerativeModelMock,
  googleGenerativeAIMock,
} = vi.hoisted(() => {
  const generateContentMock = vi.fn();
  const getGenerativeModelMock = vi.fn(() => ({
    generateContent: generateContentMock,
  }));
  const googleGenerativeAIMock = vi.fn(() => ({
    getGenerativeModel: getGenerativeModelMock,
  }));

  return {
    generateContentMock,
    getGenerativeModelMock,
    googleGenerativeAIMock,
  };
});

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: googleGenerativeAIMock,
}));

import { GeminiArticleBiasAIProvider } from '../../src/infrastructure/ai/GeminiArticleBiasAIProvider';

describe('GeminiArticleBiasAIProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve rawText JSON usando el SDK oficial de Gemini', async () => {
    generateContentMock.mockResolvedValue({
      response: {
        text: () => '{"ideologyLabel":"CENTER","confidence":0.61,"summary":"Resumen","reasoningShort":"Motivo"}',
        usageMetadata: {
          promptTokenCount: 120,
          candidatesTokenCount: 40,
          totalTokenCount: 160,
        },
        candidates: [
          {
            finishReason: 'STOP',
          },
        ],
      },
    });

    const provider = new GeminiArticleBiasAIProvider({
      apiKey: 'gemini-test-key',
      model: 'gemini-2.5-flash',
      providerName: 'gemini',
      timeoutMs: 500,
    });

    const result = await provider.analyzeArticle({
      articleId: 'article-1',
      title: 'El gobierno negocia la reforma con la oposición',
      url: 'https://example.com/article-1',
      publishedAt: '2026-03-17T10:00:00.000Z',
    });

    expect(googleGenerativeAIMock).toHaveBeenCalledWith('gemini-test-key');
    expect(getGenerativeModelMock).toHaveBeenCalledWith({ model: 'gemini-2.5-flash' });
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      rawText: '{"ideologyLabel":"CENTER","confidence":0.61,"summary":"Resumen","reasoningShort":"Motivo"}',
      tokenUsage: {
        promptTokens: 120,
        completionTokens: 40,
        totalTokens: 160,
      },
      metadata: {
        providerType: 'gemini',
        responseMimeType: 'application/json',
        usageAvailable: true,
        candidateCount: 1,
        finishReasons: ['STOP'],
      },
    });
  });

  it('expone los prompt descriptors reales usados por Gemini', () => {
    const provider = new GeminiArticleBiasAIProvider({
      apiKey: 'gemini-test-key',
      model: 'gemini-2.5-flash',
      providerName: 'gemini',
      timeoutMs: 500,
    });

    const prompts = provider.getPromptDescriptors();

    expect(prompts.primaryPrompt?.promptKey).toBe('article_bias_prompt');
    expect(prompts.relatedPrompts?.map((prompt) => prompt.promptKey)).toEqual([
      'article_bias_instructions',
      'article_bias_input_context',
    ]);
  });
});
