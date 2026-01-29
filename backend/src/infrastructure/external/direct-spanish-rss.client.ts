/**
 * Direct Spanish RSS Client (Infrastructure Layer)
 * Fetches news from direct RSS feeds of major Spanish media outlets
 * Uses clean URLs (no Google News redirects) for better metadata extraction
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
 * Spanish media RSS feeds with clean URLs
 * These feeds provide direct links to articles without obfuscation
 */
const SPANISH_RSS_FEEDS = [
  {
    name: 'El País',
    url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada',
    id: 'elpais',
  },
  {
    name: 'El Mundo',
    url: 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml',
    id: 'elmundo',
  },
  {
    name: '20 Minutos',
    url: 'https://www.20minutos.es/rss/',
    id: '20minutos',
  },
  {
    name: 'Europa Press',
    url: 'https://www.europapress.es/rss/rss.aspx',
    id: 'europapress',
  },
];

interface RssItem {
  title?: string;
  description?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  content?: string;
  contentSnippet?: string;
  creator?: string;
  'dc:creator'?: string;
  enclosure?: {
    url?: string;
    type?: string;
  };
}

export class DirectSpanishRssClient implements INewsAPIClient {
  private parser: Parser;
  private readonly timeout: number = 10000;
  private readonly maxFeedsToFetch: number = 3; // Fetch from 3 sources for diversity

  constructor() {
    this.parser = new Parser({
      customFields: {
        item: [
          ['media:content', 'mediaContent'],
          ['media:thumbnail', 'mediaThumbnail'],
          ['dc:creator', 'creator'],
        ],
      },
      timeout: this.timeout,
    });
  }

  /**
   * Fetch news from multiple direct Spanish RSS feeds
   * @param params Search parameters
   * @returns FetchNewsResult with aggregated articles from multiple sources
   */
  async fetchTopHeadlines(params: FetchNewsParams): Promise<FetchNewsResult> {
    try {
      console.log(`[DirectSpanishRssClient] Fetching from ${this.maxFeedsToFetch} Spanish media outlets...`);

      // Select feeds to fetch (rotate or use top N)
      const feedsToFetch = this.selectFeeds(params);

      // Fetch all feeds in parallel
      const feedPromises = feedsToFetch.map((feed) =>
        this.fetchSingleFeed(feed.url, feed.name, feed.id)
      );

      const feedResults = await Promise.allSettled(feedPromises);

      // Aggregate articles from successful feeds
      const allArticles: NewsAPIArticle[] = [];
      let successfulFeeds = 0;

      feedResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allArticles.push(...result.value);
          successfulFeeds++;
          console.log(
            `[DirectSpanishRssClient] ✅ ${feedsToFetch[index].name}: ${result.value.length} articles`
          );
        } else {
          console.warn(
            `[DirectSpanishRssClient] ⚠️ ${feedsToFetch[index].name} failed:`,
            result.reason.message
          );
        }
      });

      if (allArticles.length === 0) {
        throw new InfrastructureError(
          'All RSS feeds failed to fetch',
          new Error(`0/${feedsToFetch.length} feeds successful`)
        );
      }

      // Sort by publication date (newest first)
      allArticles.sort((a, b) => {
        const dateA = new Date(a.publishedAt).getTime();
        const dateB = new Date(b.publishedAt).getTime();
        return dateB - dateA;
      });

      // Apply pageSize limit
      const pageSize = params.pageSize || 20;
      const articles = allArticles.slice(0, pageSize);

      console.log(
        `[DirectSpanishRssClient] 📊 Total: ${articles.length} articles from ${successfulFeeds}/${feedsToFetch.length} sources`
      );

      return {
        status: 'ok',
        totalResults: articles.length,
        articles,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch from Spanish RSS feeds';
      throw new InfrastructureError(
        `Direct RSS fetch failed: ${message}`,
        error instanceof Error ? error : new Error(message)
      );
    }
  }

  /**
   * Fetch everything - same as top headlines for RSS feeds
   */
  async fetchEverything(params: FetchNewsParams): Promise<FetchNewsResult> {
    return this.fetchTopHeadlines(params);
  }

  /**
   * Select which feeds to fetch based on params
   * @param _params Search parameters (reserved for future query-based filtering)
   * @returns Array of selected feeds
   */
  private selectFeeds(_params: FetchNewsParams) {
    // For now, use first N feeds
    // TODO: Implement query-based filtering or rotation
    return SPANISH_RSS_FEEDS.slice(0, this.maxFeedsToFetch);
  }

  /**
   * Fetch and parse a single RSS feed
   * @param url RSS feed URL
   * @param sourceName Human-readable source name
   * @param sourceId Source identifier
   * @returns Array of NewsAPIArticle
   */
  private async fetchSingleFeed(
    url: string,
    sourceName: string,
    sourceId: string
  ): Promise<NewsAPIArticle[]> {
    try {
      const feed = await this.parser.parseURL(url);

      return (feed.items || []).map((item) =>
        this.transformRssItemToArticle(item, sourceName, sourceId)
      );
    } catch (error) {
      throw new InfrastructureError(
        `Failed to fetch ${sourceName}`,
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Transform RSS item to NewsAPIArticle format
   * @param item RSS feed item
   * @param sourceName Source name
   * @param sourceId Source identifier
   * @returns NewsAPIArticle compatible object
   */
  private transformRssItemToArticle(
    item: RssItem,
    sourceName: string,
    sourceId: string
  ): NewsAPIArticle {
    // Extract image URL from enclosure or media:content
    let imageUrl: string | null = null;

    // Try enclosure (standard RSS 2.0)
    if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
      imageUrl = item.enclosure.url;
    }

    // Try media:content (common in news feeds)
    const mediaContent = (item as any).mediaContent;
    if (!imageUrl && mediaContent) {
      if (Array.isArray(mediaContent)) {
        imageUrl = mediaContent[0]?.$ ? mediaContent[0].$.url : null;
      } else if (mediaContent.$) {
        imageUrl = mediaContent.$.url;
      }
    }

    // Try media:thumbnail
    const mediaThumbnail = (item as any).mediaThumbnail;
    if (!imageUrl && mediaThumbnail) {
      if (Array.isArray(mediaThumbnail)) {
        imageUrl = mediaThumbnail[0]?.$ ? mediaThumbnail[0].$.url : null;
      } else if (mediaThumbnail.$) {
        imageUrl = mediaThumbnail.$.url;
      }
    }

    return {
      title: item.title || 'Sin título',
      description: this.cleanDescription(item.description || item.contentSnippet || null),
      content: item.content || null,
      url: item.link || '', // Clean direct URL (no Google News redirect)
      urlToImage: imageUrl, // Will be null if not in RSS, MetadataExtractor will handle it
      source: {
        id: sourceId,
        name: sourceName,
      },
      author: item['dc:creator'] || item.creator || null,
      publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
    };
  }

  /**
   * Clean HTML tags from description
   * @param description Raw description text
   * @returns Cleaned description
   */
  private cleanDescription(description: string | null): string | null {
    if (!description) return null;

    // Remove HTML tags
    let cleaned = description.replace(/<[^>]*>/g, '');

    // Decode HTML entities
    cleaned = cleaned
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#039;/g, "'");

    // Trim and truncate to reasonable length
    cleaned = cleaned.trim();
    if (cleaned.length > 300) {
      cleaned = cleaned.substring(0, 297) + '...';
    }

    return cleaned || null;
  }
}
