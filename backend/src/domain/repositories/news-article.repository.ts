/**
 * INewsArticleRepository Interface (Domain Layer)
 * Pure contract - NO implementation details
 */

import { NewsArticle } from '../entities/news-article.entity';

export interface INewsArticleRepository {
  /**
   * Save a single news article
   * @throws InfrastructureError if database operation fails
   */
  save(article: NewsArticle): Promise<void>;

  /**
   * Save multiple news articles in a transaction
   * @throws InfrastructureError if database operation fails
   */
  saveMany(articles: NewsArticle[]): Promise<void>;

  /**
   * Find article by URL (unique constraint)
   * @returns NewsArticle if found, null otherwise
   */
  findByUrl(url: string): Promise<NewsArticle | null>;

  /**
   * Find articles by source and date range
   */
  findBySourceAndDateRange(
    source: string,
    startDate: Date,
    endDate: Date
  ): Promise<NewsArticle[]>;

  /**
   * Check if article exists by URL
   */
  existsByUrl(url: string): Promise<boolean>;

  /**
   * Get total count of articles
   */
  count(): Promise<number>;
}
