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
   * Find article by ID (UUID)
   * @returns NewsArticle if found, null otherwise
   */
  findById(id: string): Promise<NewsArticle | null>;

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
   * Find articles that have not been analyzed yet
   * @param limit Maximum number of articles to return
   */
  findUnanalyzed(limit: number): Promise<NewsArticle[]>;

  /**
   * Check if article exists by URL
   */
  existsByUrl(url: string): Promise<boolean>;

  /**
   * Get total count of articles
   */
  count(): Promise<number>;

  /**
   * Count articles that have been analyzed
   */
  countAnalyzed(): Promise<number>;

  /**
   * Find all articles with pagination, ordered by date (descending)
   * @param limit Maximum number of articles to return (default 50)
   * @param offset Number of articles to skip (default 0)
   */
  findAll(limit?: number, offset?: number): Promise<NewsArticle[]>;
}
