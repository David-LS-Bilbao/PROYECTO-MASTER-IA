/**
 * IJinaReaderClient Interface (Domain Layer)
 * Contract for web scraping service - NO implementation details
 */

export interface ScrapedContent {
  title: string;
  content: string;
  description: string | null;
  author: string | null;
  publishedDate: string | null;
}

export interface IJinaReaderClient {
  /**
   * Extract clean content from a URL
   * @throws ExternalAPIError if scraping fails
   */
  scrapeUrl(url: string): Promise<ScrapedContent>;

  /**
   * Check if the service is available
   */
  isAvailable(): Promise<boolean>;
}
