export interface ArticleBiasAIInput {
  articleId: string;
  title: string;
  url: string;
  publishedAt: string;
}

export interface ArticleBiasPromptDescriptor {
  promptKey: string;
  version: string;
  template: string;
  sourceFile: string;
}

export interface ArticleBiasProviderPromptDescriptors {
  primaryPrompt: ArticleBiasPromptDescriptor | null;
  relatedPrompts?: ArticleBiasPromptDescriptor[];
}

export interface ArticleBiasTokenUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

export interface ArticleBiasAIResponse {
  provider: string;
  model: string | null;
  rawText: string;
  tokenUsage?: ArticleBiasTokenUsage;
  metadata?: Record<string, unknown>;
}

export interface IArticleBiasAIProvider {
  readonly providerName: string;
  readonly modelName: string | null;
  getPromptDescriptors(): ArticleBiasProviderPromptDescriptors;
  analyzeArticle(input: ArticleBiasAIInput): Promise<ArticleBiasAIResponse>;
}
