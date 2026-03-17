export interface ArticleBiasAIInput {
  articleId: string;
  title: string;
  url: string;
  publishedAt: string;
}

export interface ArticleBiasAIResponse {
  provider: string;
  model: string | null;
  rawText: string;
}

export interface IArticleBiasAIProvider {
  readonly providerName: string;
  readonly modelName: string | null;
  analyzeArticle(input: ArticleBiasAIInput): Promise<ArticleBiasAIResponse>;
}
