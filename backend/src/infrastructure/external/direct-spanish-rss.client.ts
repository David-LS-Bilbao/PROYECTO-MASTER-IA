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
 * Spanish media RSS feeds organized by category
 * Each category has multiple sources for robustness and variety
 * Extended list with 40+ feeds for maximum coverage and ideological balance
 */
const RSS_SOURCES: Record<string, string[]> = {
  // 1. PORTADA / GENERAL (Mix Ideológico)
  general: [
    'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada',
    'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml',
    'https://www.abc.es/rss/2.0/portada/',
    'https://www.lavanguardia.com/rss/home.xml',
    'https://www.20minutos.es/rss/',
    'https://www.elconfidencial.com/rss/',
    'https://www.eldiario.es/rss/',
  ],
  // 2. INTERNACIONAL
  internacional: [
    'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional',
    'https://e00-elmundo.uecdn.es/elmundo/rss/internacional.xml',
    'https://www.abc.es/rss/2.0/internacional/',
    'https://www.lavanguardia.com/rss/internacional.xml',
  ],
  // 3. DEPORTES
  deportes: [
    'https://as.com/rss/tags/ultimas_noticias.xml',
    'https://e00-marca.uecdn.es/rss/portada.xml',
    'https://www.mundodeportivo.com/rss/futbol.xml',
    'https://www.sport.es/rss/last-news/football.xml',
    'https://www.superdeporte.es/rss/section/3',
  ],
  // 4. ECONOMÍA
  economia: [
    'https://www.20minutos.es/rss/economia',
    'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia',
    'https://www.eleconomista.es/rss/rss-economia.php',
    'https://cincodias.elpais.com/seccion/rss/',
    'https://www.expansion.com/rss/portada.xml',
  ],
  // 5. POLÍTICA
  politica: [
    'https://www.europapress.es/rss/rss.aspx?ch=00066',
    'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/espana',
    'https://www.abc.es/rss/2.0/espana/',
    'https://www.eldiario.es/rss/politica/',
  ],
  // 6. CIENCIA Y SALUD
  ciencia: [
    'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/ciencia',
    'https://www.20minutos.es/rss/salud',
    'https://www.agenciasinc.es/var/ezwebin_site/storage/rss/rss_design_es.xml',
    'https://www.abc.es/rss/2.0/ciencia/',
  ],
  // 7. TECNOLOGÍA
  tecnologia: [
    'https://www.20minutos.es/rss/tecnologia',
    'https://e00-elmundo.uecdn.es/elmundo/rss/navegante.xml',
    'https://www.xataka.com/index.xml',
    'https://www.genbeta.com/index.xml',
    'https://hipertextual.com/feed',
  ],
  // 8. CULTURA
  cultura: [
    'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/cultura',
    'https://www.20minutos.es/rss/cultura',
    'https://www.abc.es/rss/2.0/cultura/',
    'https://e00-elmundo.uecdn.es/elmundo/rss/cultura.xml',
  ],
};

/**
 * Available categories for fetching news
 */
const CATEGORIES = Object.keys(RSS_SOURCES) as Array<keyof typeof RSS_SOURCES>;

/**
 * Map URL to source metadata
 */
function getSourceFromUrl(url: string): { name: string; id: string } {
  if (url.includes('cincodias.elpais.com')) return { name: 'Cinco Días', id: 'cincodias' };
  if (url.includes('elpais.com')) return { name: 'El País', id: 'elpais' };
  if (url.includes('elmundo.')) return { name: 'El Mundo', id: 'elmundo' };
  if (url.includes('abc.es')) return { name: 'ABC', id: 'abc' };
  if (url.includes('lavanguardia.com')) return { name: 'La Vanguardia', id: 'lavanguardia' };
  if (url.includes('20minutos.es')) return { name: '20 Minutos', id: '20minutos' };
  if (url.includes('elconfidencial.com')) return { name: 'El Confidencial', id: 'elconfidencial' };
  if (url.includes('eldiario.es')) return { name: 'elDiario.es', id: 'eldiario' };
  if (url.includes('europapress.es')) return { name: 'Europa Press', id: 'europapress' };
  if (url.includes('as.com')) return { name: 'AS', id: 'as' };
  if (url.includes('marca.')) return { name: 'Marca', id: 'marca' };
  if (url.includes('mundodeportivo.com')) return { name: 'Mundo Deportivo', id: 'mundodeportivo' };
  if (url.includes('sport.es')) return { name: 'Sport', id: 'sport' };
  if (url.includes('superdeporte.es')) return { name: 'Superdeporte', id: 'superdeporte' };
  if (url.includes('eleconomista.es')) return { name: 'El Economista', id: 'eleconomista' };
  if (url.includes('expansion.com')) return { name: 'Expansión', id: 'expansion' };
  if (url.includes('agenciasinc.es')) return { name: 'SINC', id: 'sinc' };
  if (url.includes('xataka.com')) return { name: 'Xataka', id: 'xataka' };
  if (url.includes('genbeta.com')) return { name: 'Genbeta', id: 'genbeta' };
  if (url.includes('hipertextual.com')) return { name: 'Hipertextual', id: 'hipertextual' };
  return { name: 'Unknown', id: 'unknown' };
}

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
   * Fetch news from multiple direct Spanish RSS feeds by category
   * @param params Search parameters (category or query field)
   * @returns FetchNewsResult with aggregated articles from multiple sources
   */
  async fetchTopHeadlines(params: FetchNewsParams): Promise<FetchNewsResult> {
    try {
      // Determine category: prioritize params.category, then params.query, then default to 'general'
      const category = this.resolveCategory(params.category || params.query);
      const feedUrls = RSS_SOURCES[category] || RSS_SOURCES.general;

      console.log(`[DirectSpanishRssClient] 📂 Category: ${category} (${feedUrls.length} sources)`);

      // Fetch all feeds for this category in parallel using Promise.allSettled
      const feedPromises = feedUrls.map((url) => {
        const source = getSourceFromUrl(url);
        return this.fetchSingleFeed(url, source.name, source.id);
      });

      const feedResults = await Promise.allSettled(feedPromises);

      // Aggregate articles from successful feeds
      const allArticles: NewsAPIArticle[] = [];
      let successfulFeeds = 0;

      feedResults.forEach((result: PromiseSettledResult<NewsAPIArticle[]>, index: number) => {
        const source = getSourceFromUrl(feedUrls[index]);
        if (result.status === 'fulfilled') {
          allArticles.push(...result.value);
          successfulFeeds++;
          console.log(
            `[DirectSpanishRssClient] ✅ ${source.name}: ${result.value.length} articles`
          );
        } else {
          console.warn(
            `[DirectSpanishRssClient] ⚠️ ${source.name} failed:`,
            result.reason?.message || 'Unknown error'
          );
        }
      });

      if (allArticles.length === 0) {
        throw new InfrastructureError(
          'All RSS feeds failed to fetch',
          new Error(`0/${feedUrls.length} feeds successful for category: ${category}`)
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
        `[DirectSpanishRssClient] 📊 Total: ${articles.length} articles from ${successfulFeeds}/${feedUrls.length} sources (${category})`
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
   * Get available categories
   */
  getCategories(): string[] {
    return CATEGORIES;
  }

  /**
   * Resolve category from query string
   * Maps common query terms to category keys
   */
  private resolveCategory(query?: string): string {
    if (!query) return 'general';

    const normalized = query.toLowerCase().trim();

    // Direct category match
    if (RSS_SOURCES[normalized]) return normalized;

    // Keyword mapping
    const categoryMap: Record<string, string[]> = {
      deportes: ['deporte', 'futbol', 'fútbol', 'liga', 'baloncesto', 'tenis', 'f1'],
      economia: ['economía', 'dinero', 'bolsa', 'mercados', 'finanzas', 'empresas'],
      politica: ['política', 'gobierno', 'congreso', 'elecciones', 'partidos'],
      tecnologia: ['tecnología', 'tech', 'ia', 'inteligencia artificial', 'apps', 'móvil'],
      ciencia: ['ciencia', 'salud', 'medicina', 'investigación', 'espacio', 'clima'],
      cultura: ['cultura', 'cine', 'música', 'arte', 'libros', 'teatro'],
      internacional: ['internacional', 'mundo', 'global', 'europa', 'eeuu', 'asia'],
    };

    for (const [category, keywords] of Object.entries(categoryMap)) {
      if (keywords.some((kw) => normalized.includes(kw))) {
        return category;
      }
    }

    return 'general';
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
