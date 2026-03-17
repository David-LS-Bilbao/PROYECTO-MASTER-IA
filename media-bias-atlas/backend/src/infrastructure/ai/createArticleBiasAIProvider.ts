import { IArticleBiasAIProvider } from '../../application/contracts/IArticleBiasAIProvider';
import { DisabledArticleBiasAIProvider } from './DisabledArticleBiasAIProvider';
import { OpenAICompatibleArticleBiasAIProvider } from './OpenAICompatibleArticleBiasAIProvider';

function parseTimeout(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 20000;
  }

  return parsed;
}

export function createArticleBiasAIProvider(): IArticleBiasAIProvider {
  const provider = (process.env.BIAS_AI_PROVIDER ?? 'disabled').trim().toLowerCase();

  if (provider === 'openai' || provider === 'openai-compatible') {
    const apiKey = process.env.BIAS_AI_API_KEY?.trim();
    const model = process.env.BIAS_AI_MODEL?.trim();

    if (!apiKey || !model) {
      return new DisabledArticleBiasAIProvider();
    }

    return new OpenAICompatibleArticleBiasAIProvider({
      apiKey,
      model,
      providerName: provider,
      baseUrl: process.env.BIAS_AI_BASE_URL?.trim() || 'https://api.openai.com/v1',
      timeoutMs: parseTimeout(process.env.BIAS_AI_TIMEOUT_MS),
    });
  }

  return new DisabledArticleBiasAIProvider();
}
