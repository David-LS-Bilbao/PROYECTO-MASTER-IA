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
 * Extended list with 60+ feeds for maximum coverage and ideological balance
 * FEATURE: RSS AUTO-DISCOVERY (Sprint 9) - Base catalog of Spanish media
 */
const RSS_SOURCES: Record<string, string[]> = {
  // 1. GENERAL (TOP 10 - MIX IDEOLÓGICO)
  general: [
    'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', // ACTIVO por defecto
    'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml', // ACTIVO por defecto
    'https://www.20minutos.es/rss/', // ACTIVO por defecto
    'https://www.abc.es/rss/2.0/portada',
    'https://www.lavanguardia.com/mvc/feed/rss/home',
    'https://rss.elconfidencial.com/espana/',
    'https://www.elespanol.com/rss/',
    'https://www.larazon.es/rss/portada.xml',
    'https://www.eldiario.es/rss/',
    'https://www.publico.es/rss/',
  ],

  // 2. ECONOMÍA (TOP 10)
  economia: [
    'https://www.eleconomista.es/rss/rss-portada.php',
    'https://cincodias.elpais.com/seccion/rss/portada/',
    'https://e00-expansion.uecdn.es/rss/portada.xml',
    'https://www.elespanol.com/invertia/rss/',
    'https://www.bolsamania.com/rss/rss_bolsamania.xml',
    'https://www.capitalradio.es/rss',
    'https://www.lainformacion.com/rss/',
    'https://www.merca2.es/feed/',
    'https://www.emprendedores.es/feed/',
    'https://www.businessinsider.es/rss',
  ],

  // 3. DEPORTES (TOP 10)
  deportes: [
    'https://e00-marca.uecdn.es/rss/portada.xml',
    'https://as.com/rss/tikitakas/portada.xml',
    'https://www.mundodeportivo.com/mvc/feed/rss/home',
    'https://www.sport.es/rss/last-news/news.xml',
    'https://www.estadiodeportivo.com/rss/',
    'https://www.superdeporte.es/rss/section/2',
    'https://www.defensacentral.com/rss/',
    'https://www.palco23.com/rss',
    'https://espanol.eurosport.com/rss.xml',
    'https://es.besoccer.com/rss/noticias',
  ],

  // 4. TECNOLOGÍA (TOP 10)
  tecnologia: [
    'https://www.xataka.com/feed/index.xml',
    'https://www.genbeta.com/feed/index.xml',
    'https://www.applesfera.com/feed/index.xml',
    'https://computerhoy.com/feed',
    'https://es.gizmodo.com/rss',
    'https://www.microsiervos.com/index.xml',
    'https://hipertextual.com/feed',
    'https://elchapuzasinformatico.com/feed/',
    'https://www.softonic.com/es/articulos/feed',
    'https://www.muycomputer.com/feed/',
  ],

  // 5. CIENCIA (TOP 8)
  ciencia: [
    'https://www.agenciasinc.es/var/ezflow_site/storage/rss/rss_portada.xml',
    'https://www.muyinteresante.es/rss',
    'https://www.nationalgeographic.com.es/feeds/rss/',
    'https://www.investigacionyciencia.es/rss/noticias.xml',
    'https://www.efeverde.com/feed/',
    'https://naukas.com/feed/',
    'https://theconversation.com/es/articles.atom',
    'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/ciencia/portada',
  ],

  // 6. POLÍTICA (TOP 8)
  politica: [
    'https://www.europapress.es/rss/rss.aspx?ch=00066',
    'https://www.efe.com/efe/espana/politica/10002.xml',
    'https://www.eldiario.es/rss/politica/',
    'https://www.infolibre.es/rss/',
    'https://www.vozpopuli.com/rss',
    'https://theobjective.com/feed/',
    'https://www.moncloa.com/feed/',
    'https://www.elplural.com/rss',
  ],

  // 7. INTERNACIONAL (Heredado)
  internacional: [
    'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional',
    'https://e00-elmundo.uecdn.es/elmundo/rss/internacional.xml',
    'https://www.abc.es/rss/2.0/internacional/',
    'https://www.lavanguardia.com/rss/internacional.xml',
  ],

  // 8. CULTURA (Heredado)
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
 * Extended with 60+ Spanish media outlets (Sprint 9)
 */
function getSourceFromUrl(url: string): { name: string; id: string } {
  // General
  if (url.includes('cincodias.elpais.com')) return { name: 'Cinco Días', id: 'cincodias' };
  if (url.includes('elpais.com')) return { name: 'El País', id: 'elpais' };
  if (url.includes('elmundo.')) return { name: 'El Mundo', id: 'elmundo' };
  if (url.includes('abc.es')) return { name: 'ABC', id: 'abc' };
  if (url.includes('lavanguardia.com')) return { name: 'La Vanguardia', id: 'lavanguardia' };
  if (url.includes('20minutos.es')) return { name: '20 Minutos', id: '20minutos' };
  if (url.includes('elconfidencial.com')) return { name: 'El Confidencial', id: 'elconfidencial' };
  if (url.includes('eldiario.es')) return { name: 'elDiario.es', id: 'eldiario' };
  if (url.includes('elespanol.com')) return { name: 'El Español', id: 'elespanol' };
  if (url.includes('larazon.es')) return { name: 'La Razón', id: 'larazon' };
  if (url.includes('publico.es')) return { name: 'Público', id: 'publico' };

  // Economía
  if (url.includes('eleconomista.es')) return { name: 'El Economista', id: 'eleconomista' };
  if (url.includes('expansion.')) return { name: 'Expansión', id: 'expansion' };
  if (url.includes('invertia')) return { name: 'Invertia', id: 'invertia' };
  if (url.includes('bolsamania.com')) return { name: 'Bolsamanía', id: 'bolsamania' };
  if (url.includes('capitalradio.es')) return { name: 'Capital Radio', id: 'capitalradio' };
  if (url.includes('lainformacion.com')) return { name: 'La Información', id: 'lainformacion' };
  if (url.includes('merca2.es')) return { name: 'Merca2', id: 'merca2' };
  if (url.includes('emprendedores.es')) return { name: 'Emprendedores', id: 'emprendedores' };
  if (url.includes('businessinsider.es')) return { name: 'Business Insider ES', id: 'businessinsider' };

  // Deportes
  if (url.includes('as.com')) return { name: 'AS', id: 'as' };
  if (url.includes('marca.')) return { name: 'Marca', id: 'marca' };
  if (url.includes('mundodeportivo.com')) return { name: 'Mundo Deportivo', id: 'mundodeportivo' };
  if (url.includes('sport.es')) return { name: 'Sport', id: 'sport' };
  if (url.includes('estadiodeportivo.com')) return { name: 'Estadio Deportivo', id: 'estadiodeportivo' };
  if (url.includes('superdeporte.es')) return { name: 'Superdeporte', id: 'superdeporte' };
  if (url.includes('defensacentral.com')) return { name: 'Defensa Central', id: 'defensacentral' };
  if (url.includes('palco23.com')) return { name: 'Palco23', id: 'palco23' };
  if (url.includes('eurosport.com')) return { name: 'Eurosport ES', id: 'eurosport' };
  if (url.includes('besoccer.com')) return { name: 'BeSoccer', id: 'besoccer' };

  // Tecnología
  if (url.includes('xataka.com')) return { name: 'Xataka', id: 'xataka' };
  if (url.includes('genbeta.com')) return { name: 'Genbeta', id: 'genbeta' };
  if (url.includes('applesfera.com')) return { name: 'Applesfera', id: 'applesfera' };
  if (url.includes('computerhoy.com')) return { name: 'Computer Hoy', id: 'computerhoy' };
  if (url.includes('gizmodo.com')) return { name: 'Gizmodo ES', id: 'gizmodo' };
  if (url.includes('microsiervos.com')) return { name: 'Microsiervos', id: 'microsiervos' };
  if (url.includes('hipertextual.com')) return { name: 'Hipertextual', id: 'hipertextual' };
  if (url.includes('elchapuzasinformatico.com')) return { name: 'El Chapuzas Informático', id: 'elchapuzas' };
  if (url.includes('softonic.com')) return { name: 'Softonic News', id: 'softonic' };
  if (url.includes('muycomputer.com')) return { name: 'MuyComputer', id: 'muycomputer' };

  // Ciencia
  if (url.includes('agenciasinc.es')) return { name: 'Agencia SINC', id: 'sinc' };
  if (url.includes('muyinteresante.es')) return { name: 'Muy Interesante', id: 'muyinteresante' };
  if (url.includes('nationalgeographic.com')) return { name: 'National Geographic ES', id: 'natgeo' };
  if (url.includes('investigacionyciencia.es')) return { name: 'Investigación y Ciencia', id: 'investigacionyciencia' };
  if (url.includes('efeverde.com')) return { name: 'EFE Verde', id: 'efeverde' };
  if (url.includes('naukas.com')) return { name: 'Naukas', id: 'naukas' };
  if (url.includes('theconversation.com')) return { name: 'The Conversation ES', id: 'theconversation' };

  // Política
  if (url.includes('europapress.es')) return { name: 'Europa Press', id: 'europapress' };
  if (url.includes('efe.com')) return { name: 'EFE', id: 'efe' };
  if (url.includes('infolibre.es')) return { name: 'InfoLibre', id: 'infolibre' };
  if (url.includes('vozpopuli.com')) return { name: 'VozPópuli', id: 'vozpopuli' };
  if (url.includes('theobjective.com')) return { name: 'The Objective', id: 'theobjective' };
  if (url.includes('moncloa.com')) return { name: 'Moncloa.com', id: 'moncloa' };
  if (url.includes('elplural.com')) return { name: 'El Plural', id: 'elplural' };

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
