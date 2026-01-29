/**
 * MetadataExtractor (Infrastructure Layer)
 * Lightweight Open Graph & Twitter Card metadata extractor
 * NO external API costs - direct HTML parsing with Cheerio
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { ExternalAPIError } from '../../domain/errors/infrastructure.error';

export interface ArticleMetadata {
  ogImage: string | null;
  twitterImage: string | null;
  title: string | null;
  description: string | null;
}

export class MetadataExtractor {
  private readonly timeout: number = 2000; // 2 seconds - fast extraction
  private readonly maxRedirects: number = 5; // Follow redirects from Google News to original sources

  /**
   * Extract Open Graph and Twitter Card metadata from URL
   * @param url Article URL to extract metadata from
   * @returns ArticleMetadata with image URLs and basic info
   */
  async extractMetadata(url: string): Promise<ArticleMetadata> {
    try {
      // Validate URL
      if (!this.isValidUrl(url)) {
        throw new ExternalAPIError('MetadataExtractor', 'Invalid URL format', 400);
      }

      // Fetch HTML with timeout and User-Agent to avoid blocking
      const response = await axios.get(url, {
        timeout: this.timeout,
        maxRedirects: this.maxRedirects,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VerityNewsBot/1.0; +https://verity-news.com/bot)',
          Accept: 'text/html',
        },
        validateStatus: (status) => status >= 200 && status < 400,
      });

      // Parse HTML with Cheerio
      const $ = cheerio.load(response.data);

      // Extract metadata with priority order
      const metadata: ArticleMetadata = {
        ogImage: this.extractOgImage($),
        twitterImage: this.extractTwitterImage($),
        title: this.extractTitle($),
        description: this.extractDescription($),
      };

      return metadata;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new ExternalAPIError(
            'MetadataExtractor',
            `Timeout after ${this.timeout}ms`,
            408
          );
        }
        if (error.response?.status === 403 || error.response?.status === 401) {
          throw new ExternalAPIError(
            'MetadataExtractor',
            'Access forbidden - site may block bots',
            error.response.status
          );
        }
        if (error.response?.status === 404) {
          throw new ExternalAPIError(
            'MetadataExtractor',
            'URL not found',
            404
          );
        }
      }

      throw new ExternalAPIError(
        'MetadataExtractor',
        `Failed to extract metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        error as Error
      );
    }
  }

  /**
   * Extract best image URL from metadata
   * Prioritizes: og:image > twitter:image
   */
  getBestImageUrl(metadata: ArticleMetadata): string | null {
    return metadata.ogImage || metadata.twitterImage || null;
  }

  /**
   * Extract Open Graph image
   */
  private extractOgImage($: cheerio.CheerioAPI): string | null {
    // Try og:image
    let imageUrl = $('meta[property="og:image"]').attr('content');
    if (imageUrl) return this.normalizeUrl(imageUrl);

    // Try og:image:secure_url (HTTPS version)
    imageUrl = $('meta[property="og:image:secure_url"]').attr('content');
    if (imageUrl) return this.normalizeUrl(imageUrl);

    // Try link rel="image_src" (older standard)
    imageUrl = $('link[rel="image_src"]').attr('href');
    if (imageUrl) return this.normalizeUrl(imageUrl);

    return null;
  }

  /**
   * Extract Twitter Card image
   */
  private extractTwitterImage($: cheerio.CheerioAPI): string | null {
    // Try twitter:image
    let imageUrl = $('meta[name="twitter:image"]').attr('content');
    if (imageUrl) return this.normalizeUrl(imageUrl);

    // Try twitter:image:src
    imageUrl = $('meta[name="twitter:image:src"]').attr('content');
    if (imageUrl) return this.normalizeUrl(imageUrl);

    return null;
  }

  /**
   * Extract page title (og:title > twitter:title > <title>)
   */
  private extractTitle($: cheerio.CheerioAPI): string | null {
    let title = $('meta[property="og:title"]').attr('content');
    if (title) return title;

    title = $('meta[name="twitter:title"]').attr('content');
    if (title) return title;

    title = $('title').text();
    if (title) return title.trim();

    return null;
  }

  /**
   * Extract page description (og:description > twitter:description > meta description)
   */
  private extractDescription($: cheerio.CheerioAPI): string | null {
    let description = $('meta[property="og:description"]').attr('content');
    if (description) return description;

    description = $('meta[name="twitter:description"]').attr('content');
    if (description) return description;

    description = $('meta[name="description"]').attr('content');
    if (description) return description;

    return null;
  }

  /**
   * Normalize URL (handle relative URLs, protocol-relative URLs)
   */
  private normalizeUrl(url: string): string {
    // Remove leading/trailing whitespace
    url = url.trim();

    // Handle protocol-relative URLs (//example.com/image.jpg)
    if (url.startsWith('//')) {
      return `https:${url}`;
    }

    // Handle relative URLs (need base URL - skip for now)
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // TODO: Could resolve with base URL if needed
      return url;
    }

    return url;
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
}
