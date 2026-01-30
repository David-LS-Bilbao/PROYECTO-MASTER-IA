/**
 * INewsArticleRepository Interface (Domain Layer)
 * Pure contract - NO implementation details
 */

import { NewsArticle } from '../entities/news-article.entity';

/**
 * Parameters for findAll query
 */
export interface FindAllParams {
  limit: number;
  offset: number;
  category?: string;
  onlyFavorites?: boolean;
}

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
   * Count articles matching filter criteria
   */
  countFiltered(params: { category?: string; onlyFavorites?: boolean }): Promise<number>;

  /**
   * Count articles that have been analyzed
   */
  countAnalyzed(): Promise<number>;

  /**
   * Find all articles with pagination and optional filtering
   * @param params Query parameters including limit, offset, category, and favorites filter
   */
  findAll(params: FindAllParams): Promise<NewsArticle[]>;

  /**
   * Find multiple articles by their IDs
   * @param ids Array of article UUIDs
   * @returns Articles found (may be fewer than requested if some don't exist)
   */
  findByIds(ids: string[]): Promise<NewsArticle[]>;

  /**
   * Toggle favorite status of an article
   * @param id Article UUID
   * @returns Updated article or null if not found
   */
  toggleFavorite(id: string): Promise<NewsArticle | null>;
}
