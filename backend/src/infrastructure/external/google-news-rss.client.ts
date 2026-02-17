/**
 * Google News RSS Client (Infrastructure Layer)
 * Fetches news from Google News RSS feed without API key requirements
 * Provides free, unlimited access to Spanish news
 */

import Parser from 'rss-parser';
import {
  INewsAPIClient,
  NewsAPIArticle,
  FetchNewsParams,
  FetchNewsResult,
} from '../../domain/services/news-api-client.interface';
import { InfrastructureError } from '../../domain/errors/infrastructure.error';

/**
 * Google News RSS Feed URLs by region and language
 * Format: https://news.google.com/rss/search?q={query}&hl={language}&gl={country}&ceid={country}:{language}
 */
const GOOGLE_NEWS_BASE_URL = 'https://news.google.com/rss';
const ENTERTAINMENT_QUERY = 'cine OR series OR musica OR videojuegos OR espectaculos';

interface GoogleNewsItem {
  title?: string;
  description?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  source?: string;
  author?: string;
  content?: string;
}

export class GoogleNewsRssClient implements INewsAPIClient {
  private parser: Parser;
  private readonly timeout: number = 10000;

  constructor() {
    this.parser = new Parser({
      customFields: {
        item: [['media:content', 'mediaContent']],
      },
      timeout: this.timeout,
    });
  }

  /**
   * Fetch news from Google News RSS feed
   * @param params Search parameters
   * @returns FetchNewsResult compatible with NewsAPI interface
   */
  async fetchTopHeadlines(params: FetchNewsParams): Promise<FetchNewsResult> {
    try {
      // Build search URL
      const url = this.buildGoogleNewsUrl(params);

      // Parse RSS feed
      const feed = await this.parser.parseURL(url);

      // Transform RSS items to NewsAPIArticle format
      const articles: NewsAPIArticle[] = (feed.items || [])
        .slice(0, params.pageSize || 20)
        .map((item) => this.transformRssItemToArticle(item));

      return {
        status: 'ok',
        totalResults: articles.length,
        articles,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch from Google News RSS';
      throw new InfrastructureError(
        `Google News RSS fetch failed: ${message}`,
        error instanceof Error ? error : new Error(message)
      );
    }
  }

  /**
   * Fetch everything from Google News RSS feed
   * For compatibility with NewsAPI interface
   */
  async fetchEverything(params: FetchNewsParams): Promise<FetchNewsResult> {
    // Google News RSS doesn't distinguish between top headlines and everything
    // Use same implementation
    return this.fetchTopHeadlines(params);
  }

  /**
   * Build Google News RSS feed URL with search parameters
   * @param params Search parameters
   * @returns Complete Google News RSS URL
   */
  private buildGoogleNewsUrl(params: FetchNewsParams): string {
    const searchParams = new URLSearchParams();

    // Add search query (with geographic context for local news)
    let query = params.query || this.getCategoryQuery(params.category);
    if (query && params.category === 'local') {
      // Sprint 28 BUG #3 FIX: Add geographic context for local queries
      // "Madrid" → "noticias locales Madrid" for more relevant local results
      query = `noticias locales ${query}`;
    }
    if (query) {
      searchParams.append('q', query);
    }

    // Language: Spanish (es or es-ES)
    const language = params.language || 'es';
    searchParams.append('hl', language === 'es' ? 'es-ES' : `${language}-${language.toUpperCase()}`);

    // Country: Spain by default for Spanish language, can be overridden
    const country = 'ES';
    searchParams.append('gl', country);
    searchParams.append('ceid', `${country}:${language}`);

    const url = `${GOOGLE_NEWS_BASE_URL}/search?${searchParams.toString()}`;

    console.log(`[GoogleNewsRssClient] Fetching from: ${url}`);

    return url;
  }

  private getCategoryQuery(category?: string): string | undefined {
    if (!category) return undefined;

    const normalized = category.toLowerCase().trim();

    if (normalized === 'entretenimiento' || normalized === 'entertainment') {
      return ENTERTAINMENT_QUERY;
    }

    return undefined;
  }

  /**
   * Transform RSS item to NewsAPIArticle format
   * @param item RSS feed item
   * @returns NewsAPIArticle compatible object
   */
  private transformRssItemToArticle(item: GoogleNewsItem): NewsAPIArticle {
    // Extract source and title from description if available
    // Google News RSS format: "<a href="...">Source Name</a> - Title"
    let source = 'Google News';
    let title = item.title || 'Sin título';

    // Parse source from description if present
    if (item.description) {
      const sourceMatch = item.description.match(/<a href="[^"]*">([^<]+)<\/a>/);
      if (sourceMatch) {
        source = sourceMatch[1];
      }
    }

    return {
      title,
      description: this.extractDescription(item),
      content: item.content || null,
      url: item.link || 'https://news.google.com',
      urlToImage: null, // Google News RSS doesn't provide image URLs directly
      source: {
        id: source.toLowerCase().replace(/\s+/g, '-'),
        name: source,
      },
      author: item.author || null,
      publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
    };
  }

  /**
   * Extract clean description from RSS item
   * Removes HTML tags and truncates to reasonable length
   * @param item RSS feed item
   * @returns Clean description string or null
   */
  private extractDescription(item: GoogleNewsItem): string | null {
    let description = item.description || item.content || '';

    // Remove HTML tags
    description = description.replace(/<[^>]*>/g, '');

    // Decode HTML entities
    description = this.decodeHtmlEntities(description);

    // Truncate to 500 characters
    if (description.length > 500) {
      description = description.substring(0, 497) + '...';
    }

    return description.trim() || null;
  }

  /**
   * Decode HTML entities in text
   * @param text Text with HTML entities
   * @returns Decoded text
   */
  private decodeHtmlEntities(text: string): string {
    const entities: { [key: string]: string } = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#039;': "'",
      '&mdash;': '—',
      '&ndash;': '–',
      '&nbsp;': ' ',
    };

    let decoded = text;
    Object.entries(entities).forEach(([entity, char]) => {
      decoded = decoded.replace(new RegExp(entity, 'g'), char);
    });

    return decoded;
  }
}
