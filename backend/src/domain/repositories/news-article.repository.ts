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
  userId?: string; // Per-user favorite filtering & enrichment
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
  countFiltered(params: { category?: string; onlyFavorites?: boolean; userId?: string }): Promise<number>;

  /**
   * Count articles that have been analyzed
   */
  countAnalyzed(): Promise<number>;

  /**
   * Get bias distribution for analyzed articles
   * @returns Object with counts for left, neutral, and right bias
   */
  getBiasDistribution(): Promise<{ left: number; neutral: number; right: number }>;

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
   * Toggle favorite status of an article (LEGACY - global)
   * @deprecated Use toggleFavoriteForUser instead
   */
  toggleFavorite(id: string): Promise<NewsArticle | null>;

  // =========================================================================
  // PER-USER FAVORITES (Privacy-compliant)
  // =========================================================================

  /**
   * Toggle favorite for a specific user (uses Favorite junction table)
   * @returns true if now favorited, false if unfavorited
   */
  toggleFavoriteForUser(userId: string, articleId: string): Promise<boolean>;

  /**
   * Add article to user's favorites
   * @param unlocked - If true, marks analysis as unlocked (user requested analysis)
   *                   If false, user only liked the article (no analysis access)
   */
  addFavoriteForUser(userId: string, articleId: string, unlocked?: boolean): Promise<void>;

  /**
   * Get set of article IDs that a user has favorited
   * Used for enriching article lists with per-user favorite status
   */
  getUserFavoriteArticleIds(userId: string, articleIds: string[]): Promise<Set<string>>;

  /**
   * Get set of article IDs where user has unlocked analysis
   * Used for determining which articles' analysis should be visible to user
   */
  getUserUnlockedArticleIds(userId: string, articleIds: string[]): Promise<Set<string>>;

  /**
   * Find user's favorite articles with pagination
   */
  findFavoritesByUser(userId: string, limit: number, offset: number): Promise<NewsArticle[]>;

  /**
   * Count user's favorites
   */
  countFavoritesByUser(userId: string): Promise<number>;

  // =========================================================================
  // SEARCH (Sprint 19)
  // =========================================================================

  /**
   * Search articles by query string using Full-Text Search
   * Searches in title, description, summary, and content
   * @param query Search query string
   * @param limit Maximum number of results
   * @param userId Optional user ID for favorite enrichment
   * @returns Articles matching the search query, ordered by relevance
   */
  searchArticles(query: string, limit: number, userId?: string): Promise<NewsArticle[]>;

  /**
   * Search LOCAL articles by city name (Sprint 28: Local News Fix)
   * Combines category='local' filter with city text search.
   * Only returns articles stored as local news that mention the city.
   * @param city City name to search for
   * @param limit Maximum number of results
   * @param offset Pagination offset
   * @param userId Optional user ID for favorite enrichment
   */
  searchLocalArticles(city: string, limit: number, offset: number, userId?: string): Promise<NewsArticle[]>;

  /**
   * Count LOCAL articles for a city filter.
   * Applies the same fallback behavior as searchLocalArticles:
   * if no city-matching local articles are found, counts all local articles.
   */
  countLocalArticles(city: string): Promise<number>;
}
