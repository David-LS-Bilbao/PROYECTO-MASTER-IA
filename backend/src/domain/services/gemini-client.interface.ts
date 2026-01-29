/**
 * IGeminiClient Interface (Domain Layer)
 * Contract for AI analysis service - NO implementation details
 */

import { ArticleAnalysis } from '../entities/news-article.entity';

export interface AnalyzeContentInput {
  title: string;
  content: string;
  source: string;
  language: string;
}

export interface IGeminiClient {
  /**
   * Analyze article content for summary, bias, and sentiment
   * @throws ExternalAPIError if API call fails
   */
  analyzeArticle(input: AnalyzeContentInput): Promise<ArticleAnalysis>;

  /**
   * Check if the service is available
   */
  isAvailable(): Promise<boolean>;
}
