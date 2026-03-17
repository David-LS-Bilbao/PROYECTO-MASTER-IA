import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createArticleBiasAIProvider } from '../../src/infrastructure/ai/createArticleBiasAIProvider';
import { DisabledArticleBiasAIProvider } from '../../src/infrastructure/ai/DisabledArticleBiasAIProvider';
import { GeminiArticleBiasAIProvider } from '../../src/infrastructure/ai/GeminiArticleBiasAIProvider';
import { OpenAICompatibleArticleBiasAIProvider } from '../../src/infrastructure/ai/OpenAICompatibleArticleBiasAIProvider';

const originalEnv = { ...process.env };

describe('createArticleBiasAIProvider', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.BIAS_AI_PROVIDER;
    delete process.env.BIAS_AI_API_KEY;
    delete process.env.BIAS_AI_MODEL;
    delete process.env.BIAS_AI_BASE_URL;
    delete process.env.BIAS_AI_TIMEOUT_MS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('devuelve disabled si Gemini no tiene API key', () => {
    process.env.BIAS_AI_PROVIDER = 'gemini';

    const provider = createArticleBiasAIProvider();

    expect(provider).toBeInstanceOf(DisabledArticleBiasAIProvider);
  });

  it('crea provider Gemini con modelo por defecto alineado con Verity', () => {
    process.env.BIAS_AI_PROVIDER = 'gemini';
    process.env.BIAS_AI_API_KEY = 'gemini-test-key';

    const provider = createArticleBiasAIProvider();

    expect(provider).toBeInstanceOf(GeminiArticleBiasAIProvider);
    expect(provider.providerName).toBe('gemini');
    expect(provider.modelName).toBe('gemini-2.5-flash');
  });

  it('mantiene soporte openai-compatible sin romper el contrato actual', () => {
    process.env.BIAS_AI_PROVIDER = 'openai-compatible';
    process.env.BIAS_AI_API_KEY = 'openai-key';
    process.env.BIAS_AI_MODEL = 'gpt-4o-mini';

    const provider = createArticleBiasAIProvider();

    expect(provider).toBeInstanceOf(OpenAICompatibleArticleBiasAIProvider);
    expect(provider.providerName).toBe('openai-compatible');
    expect(provider.modelName).toBe('gpt-4o-mini');
  });
});
