/**
 * JinaReaderClient Implementation (Infrastructure Layer)
 * Uses Jina Reader API for web scraping and content extraction
 */

import {
  IJinaReaderClient,
  ScrapedContent,
} from '../../domain/services/jina-reader-client.interface';
import {
  ExternalAPIError,
  ConfigurationError,
} from '../../domain/errors/infrastructure.error';

const JINA_READER_BASE_URL = 'https://r.jina.ai/';
const REQUEST_TIMEOUT = 30000; // 30 seconds

export class JinaReaderClient implements IJinaReaderClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new ConfigurationError('JINA_API_KEY is required');
    }
    this.apiKey = apiKey;
  }

  async scrapeUrl(url: string): Promise<ScrapedContent> {
    // Validate URL format
    if (!this.isValidUrl(url)) {
      throw new ExternalAPIError('JinaReader', 'Invalid URL format', 400);
    }

    const encodedUrl = encodeURIComponent(url);
    const jinaUrl = `${JINA_READER_BASE_URL}${encodedUrl}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(jinaUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
          'X-Return-Format': 'json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new ExternalAPIError('JinaReader', 'Invalid API key', 401);
        }
        if (response.status === 429) {
          throw new ExternalAPIError('JinaReader', 'Rate limit exceeded', 429);
        }
        if (response.status === 404) {
          throw new ExternalAPIError('JinaReader', 'URL not found or inaccessible', 404);
        }
        throw new ExternalAPIError(
          'JinaReader',
          `HTTP error: ${response.status}`,
          response.status
        );
      }

      const data = await response.json();
      return this.parseJinaResponse(data, url);
    } catch (error) {
      if (error instanceof ExternalAPIError) {
        throw error;
      }

      const err = error as Error;

      if (err.name === 'AbortError') {
        throw new ExternalAPIError(
          'JinaReader',
          'Request timeout - page took too long to load',
          408
        );
      }

      throw new ExternalAPIError(
        'JinaReader',
        `Scraping failed: ${err.message}`,
        500,
        err
      );
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const testUrl = 'https://example.com';
      const response = await fetch(`${JINA_READER_BASE_URL}${encodeURIComponent(testUrl)}`, {
        method: 'HEAD',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Parse Jina Reader response
   */
  private parseJinaResponse(data: unknown, originalUrl: string): ScrapedContent {
    // Jina Reader returns different formats depending on the page
    // Handle both direct content and structured response

    if (typeof data === 'string') {
      // Plain text/markdown response
      return {
        title: this.extractTitleFromMarkdown(data),
        content: data,
        description: null,
        author: null,
        publishedDate: null,
        imageUrl: null,
      };
    }

    // Structured JSON response
    const payload = (data && typeof data === 'object') ? (data as Record<string, unknown>) : {};
    const content =
      this.getStringField(payload, ['content', 'text', 'markdown']) || '';
    const title =
      this.getStringField(payload, ['title']) || this.extractTitleFromMarkdown(content);

    if (!content || content.trim().length === 0) {
      throw new ExternalAPIError(
        'JinaReader',
        `No content could be extracted from URL: ${originalUrl}`,
        422
      );
    }

    // Extract image URL from Open Graph metadata or other fields
    const imageUrl = this.extractImageUrl(payload);

    return {
      title: title || 'Untitled',
      content: this.cleanContent(content),
      description: this.getStringField(payload, ['description', 'excerpt']),
      author: this.getStringField(payload, ['author', 'byline']),
      publishedDate: this.getStringField(payload, ['publishedDate', 'date']),
      imageUrl,
    };
  }

  /**
   * Extract title from markdown content
   */
  private extractTitleFromMarkdown(markdown: string): string {
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      return titleMatch[1].trim();
    }

    // Fallback: use first line if it's short enough
    const firstLine = markdown.split('\n')[0]?.trim();
    if (firstLine && firstLine.length < 200) {
      return firstLine;
    }

    return 'Untitled';
  }

  /**
   * Extract image URL from Jina Reader response
   * Prioritizes: og:image > twitter:image > images array > null
   */
  private extractImageUrl(data: Record<string, unknown>): string | null {
    // Priority 1: Open Graph image
    const ogImage = this.getStringField(data, ['ogImage', 'og:image']);
    if (ogImage) {
      return ogImage;
    }

    // Priority 2: Twitter card image
    const twitterImage = this.getStringField(data, ['twitterImage', 'twitter:image']);
    if (twitterImage) {
      return twitterImage;
    }

    // Priority 3: Generic image field
    const image = this.getStringField(data, ['image']);
    if (image) {
      return image;
    }

    // Priority 4: Images array (take first)
    if (Array.isArray(data.images) && data.images.length > 0) {
      const firstImage = data.images[0];
      if (typeof firstImage === 'string') {
        return firstImage;
      }
    }

    // Priority 5: Featured image
    const featuredImage = this.getStringField(data, ['featuredImage']);
    if (featuredImage) {
      return featuredImage;
    }

    return null;
  }

  private getStringField(data: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = data[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    return null;
  }

  /**
   * Clean extracted content
   */
  private cleanContent(content: string): string {
    return content
      .replace(/\[.*?\]\(javascript:.*?\)/g, '') // Remove JS links
      .replace(/!\[.*?\]\(data:.*?\)/g, '') // Remove base64 images
      .replace(/\n{4,}/g, '\n\n\n') // Limit consecutive newlines
      .replace(/\s{2,}/g, ' ') // Normalize spaces
      .trim();
  }
}
