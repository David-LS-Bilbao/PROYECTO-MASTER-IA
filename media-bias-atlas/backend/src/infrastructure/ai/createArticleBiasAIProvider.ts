import { IArticleBiasAIProvider } from '../../application/contracts/IArticleBiasAIProvider';
import { DisabledArticleBiasAIProvider } from './DisabledArticleBiasAIProvider';
import { GeminiArticleBiasAIProvider } from './GeminiArticleBiasAIProvider';
import { OpenAICompatibleArticleBiasAIProvider } from './OpenAICompatibleArticleBiasAIProvider';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

function parseTimeout(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 20000;
  }

  return parsed;
}

export function createArticleBiasAIProvider(): IArticleBiasAIProvider {
  const provider = (process.env.BIAS_AI_PROVIDER ?? 'disabled').trim().toLowerCase();
  const apiKey = process.env.BIAS_AI_API_KEY?.trim();
  const configuredModel = process.env.BIAS_AI_MODEL?.trim();
  const timeoutMs = parseTimeout(process.env.BIAS_AI_TIMEOUT_MS);

  if (provider === 'gemini' || provider === 'google-gemini') {
    if (!apiKey) {
      return new DisabledArticleBiasAIProvider();
    }

    return new GeminiArticleBiasAIProvider({
      apiKey,
      model: configuredModel || DEFAULT_GEMINI_MODEL,
      providerName: 'gemini',
      timeoutMs,
    });
  }

  if (provider === 'openai' || provider === 'openai-compatible') {
    if (!apiKey || !configuredModel) {
      return new DisabledArticleBiasAIProvider();
    }

    return new OpenAICompatibleArticleBiasAIProvider({
      apiKey,
      model: configuredModel,
      providerName: provider,
      baseUrl: process.env.BIAS_AI_BASE_URL?.trim() || 'https://api.openai.com/v1',
      timeoutMs,
    });
  }

  return new DisabledArticleBiasAIProvider();
}
