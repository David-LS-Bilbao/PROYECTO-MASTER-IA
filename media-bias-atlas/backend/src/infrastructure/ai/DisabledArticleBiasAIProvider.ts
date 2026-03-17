import { ArticleBiasAIInput, ArticleBiasAIResponse, IArticleBiasAIProvider } from '../../application/contracts/IArticleBiasAIProvider';

export class DisabledArticleBiasAIProvider implements IArticleBiasAIProvider {
  readonly providerName = 'disabled';
  readonly modelName = null;

  async analyzeArticle(_input: ArticleBiasAIInput): Promise<ArticleBiasAIResponse> {
    throw new Error(
      'Proveedor IA no configurado. Define BIAS_AI_PROVIDER=openai-compatible, BIAS_AI_API_KEY y BIAS_AI_MODEL.'
    );
  }
}
