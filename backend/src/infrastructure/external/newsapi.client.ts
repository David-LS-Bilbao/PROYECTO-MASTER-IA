/**
 * NewsAPI Client Implementation (Infrastructure Layer)
 * Adapter for NewsAPI.org external service
 */

import {
  INewsAPIClient,
  FetchNewsParams,
  FetchNewsResult,
} from '../../domain/services/news-api-client.interface';
import {
  ExternalAPIError,
  ConfigurationError,
} from '../../domain/errors/infrastructure.error';

const NEWSAPI_CATEGORIES = new Set([
  'business',
  'entertainment',
  'general',
  'health',
  'science',
  'sports',
  'technology',
]);

const CATEGORY_ALIASES: Record<string, string> = {
  espana: 'general',
  internacional: 'general',
  economia: 'business',
  politica: 'general',
  cultura: 'entertainment',
  entretenimiento: 'entertainment',
  deportes: 'sports',
  salud: 'health',
  ciencia: 'science',
  tecnologia: 'technology',
  'ciencia-tecnologia': 'science',
  local: 'general',
};

export class NewsAPIClient implements INewsAPIClient {
  private readonly baseUrl = 'https://newsapi.org/v2';
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEWS_API_KEY || '';
    if (!this.apiKey) {
      throw new ConfigurationError('NewsAPI key is not configured');
    }
  }

  async fetchTopHeadlines(params: FetchNewsParams): Promise<FetchNewsResult> {
    const mappedCategory = this.mapCategory(params.category);
    const queryParams = new URLSearchParams({
      apiKey: this.apiKey,
      ...(params.query && { q: params.query }),
      ...(mappedCategory && { category: mappedCategory }),
      ...(params.language && { language: params.language }),
      ...(params.pageSize && { pageSize: params.pageSize.toString() }),
      ...(params.page && { page: params.page.toString() }),
    });

    const url = `${this.baseUrl}/top-headlines?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { message?: string };
        throw new ExternalAPIError(
          'NewsAPI',
          errorData.message || 'Failed to fetch top headlines',
          response.status
        );
      }

      const data = await response.json();

      // Sanitize response to prevent potential security issues
      return this.sanitizeResponse(data);
    } catch (error) {
      if (error instanceof ExternalAPIError) {
        throw error;
      }
      throw new ExternalAPIError(
        'NewsAPI',
        'Network error or invalid response',
        undefined,
        error as Error
      );
    }
  }

  async fetchEverything(params: FetchNewsParams): Promise<FetchNewsResult> {
    const queryParams = new URLSearchParams({
      apiKey: this.apiKey,
      ...(params.query && { q: params.query }),
      ...(params.language && { language: params.language }),
      ...(params.pageSize && { pageSize: params.pageSize.toString() }),
      ...(params.page && { page: params.page.toString() }),
    });

    const url = `${this.baseUrl}/everything?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { message?: string };
        throw new ExternalAPIError(
          'NewsAPI',
          errorData.message || 'Failed to fetch everything',
          response.status
        );
      }

      const data = await response.json();

      return this.sanitizeResponse(data);
    } catch (error) {
      if (error instanceof ExternalAPIError) {
        throw error;
      }
      throw new ExternalAPIError(
        'NewsAPI',
        'Network error or invalid response',
        undefined,
        error as Error
      );
    }
  }

  /**
   * Sanitize API response to prevent XSS and injection attacks
   */
  private sanitizeResponse(data: unknown): FetchNewsResult {
    const payload = (data ?? {}) as {
      status?: unknown;
      totalResults?: unknown;
      articles?: Array<Record<string, unknown>>;
    };

    const articles = Array.isArray(payload.articles) ? payload.articles : [];
    const sanitizedArticles: FetchNewsResult['articles'] = [];

    articles.forEach((article) => {
      const url = this.sanitizeUrl(article.url);
      if (!url) {
        return;
      }

      sanitizedArticles.push({
        title: this.sanitizeString(article.title) ?? 'Untitled',
        description: this.sanitizeString(article.description),
        content: this.sanitizeString(article.content),
        url,
        urlToImage: this.sanitizeUrl(article.urlToImage),
        source: {
          id: this.sanitizeString(article.source && (article.source as Record<string, unknown>).id),
          name:
            this.sanitizeString(article.source && (article.source as Record<string, unknown>).name) ||
            'Unknown',
        },
        author: this.sanitizeString(article.author),
        publishedAt: String(article.publishedAt || new Date().toISOString()),
      });
    });

    return {
      status: String(payload.status || 'error'),
      totalResults: Number(payload.totalResults || 0),
      articles: sanitizedArticles,
    };
  }

  private sanitizeString(value: unknown): string | null {
    if (!value || typeof value !== 'string') return null;
    // Remove potential script tags and trim
    return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim();
  }

  private sanitizeUrl(value: unknown): string | null {
    if (!value || typeof value !== 'string') return null;
    // Basic URL validation
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      return value;
    } catch {
      return null;
    }
  }

  private mapCategory(category: string | undefined): string | undefined {
    if (!category) return undefined;

    const lower = category.toLowerCase();
    if (CATEGORY_ALIASES[lower]) {
      return CATEGORY_ALIASES[lower];
    }

    if (NEWSAPI_CATEGORIES.has(lower)) {
      return lower;
    }

    return undefined;
  }
}
