/**
 * IngestNewsUseCase (Application Layer)
 * Core business logic for news ingestion
 *
 * Responsibilities:
 * - Fetch news from external API
 * - Transform to domain entities
 * - Assign category correctly
 * - Filter duplicates
 * - Persist to database
 * - Record ingestion metadata
 */

import { randomUUID } from 'crypto';
import Parser from 'rss-parser';
import { INewsAPIClient } from '../../domain/services/news-api-client.interface';
import { INewsArticleRepository } from '../../domain/repositories/news-article.repository';
import { NewsArticle } from '../../domain/entities/news-article.entity';
import { ValidationError } from '../../domain/errors/domain.error';
import { PrismaClient } from '@prisma/client';

// OPTIMIZATION: Limit items per ingestion to avoid flooding the database
// Increased from 5 to 30 to allow better coverage for dynamic categories like sports
const MAX_ITEMS_PER_SOURCE = 30;

// Valid categories (Spanish) - Sprint 22: Extended with new topics
const VALID_CATEGORIES = [
  'general',
  'internacional',
  'deportes',
  'economia',
  'politica',
  'ciencia',
  'tecnologia',
  'cultura',
  'salud',
  'entretenimiento',
  'espana',
  'ciencia-tecnologia',
  'local',
] as const;

// English to Spanish category mapping for backwards compatibility
const CATEGORY_MAPPING: Record<string, string> = {
  business: 'economia',
  entertainment: 'cultura',
  health: 'ciencia',
  science: 'ciencia',
  sports: 'deportes',
  technology: 'tecnologia',
  general: 'general',
};

/**
 * SPRINT 22 FIX: Topic-to-Query Mapping
 * Maps topic slugs to specific search queries for better results from external API
 * These queries are used when category-based search doesn't yield results
 */
const TOPIC_QUERIES: Record<string, string> = {
  'ciencia-tecnologia': 'ciencia OR tecnología OR inteligencia artificial OR innovación',
  'ciencia': 'ciencia OR investigación OR descubrimiento OR experimento',
  'tecnologia': 'tecnología OR software OR hardware OR innovación OR digital',
  'economia': 'economía OR finanzas OR mercado OR bolsa OR empresas',
  'deportes': 'fútbol OR baloncesto OR deporte OR liga OR competición',
  'salud': 'salud OR medicina OR bienestar OR hospital OR tratamiento',
  'entretenimiento': 'cine OR música OR series OR cultura OR espectáculo',
  'cultura': 'cultura OR arte OR literatura OR teatro OR música',
  'internacional': 'internacional OR mundo OR guerra OR política exterior',
  'espana': 'España OR gobierno OR elecciones OR nacional',
  'politica': 'política OR gobierno OR partido OR elecciones',
  'general': 'noticias OR actualidad OR España',
  // 'local' se construye dinámicamente con la ubicación del usuario
};

export interface IngestNewsRequest {
  category?: string;
  topicSlug?: string; // Sprint 23: Topic slug for categorization
  language?: string;
  query?: string;
  pageSize?: number;
}

export interface IngestNewsResponse {
  success: boolean;
  totalFetched: number;
  newArticles: number;
  duplicates: number;
  errors: number;
  source: string;
  timestamp: Date;
}

export class IngestNewsUseCase {
  private readonly rssParser: Parser;

  constructor(
    private readonly newsAPIClient: INewsAPIClient,
    private readonly articleRepository: INewsArticleRepository,
    private readonly prisma: PrismaClient,
    private readonly localNewsClient?: INewsAPIClient, // Google News RSS for local city-based ingestion
    private readonly localSourceDiscoveryService?: any // Sprint 24: AI-powered local source discovery
  ) {
    // Sprint 24: RSS parser for direct local source ingestion
    this.rssParser = new Parser({ timeout: 10000 });
  }

  async execute(request: IngestNewsRequest): Promise<IngestNewsResponse> {
    const startTime = new Date();
    let totalFetched = 0;
    let newArticles = 0;
    let duplicates = 0;
    let errors = 0;

    try {
      // Validate input
      this.validateRequest(request);

      // SPRINT 23: Lookup Topic by slug if provided
      let topicId: string | null = null;
      if (request.topicSlug) {
        const topic = await this.prisma.topic.findUnique({
          where: { slug: request.topicSlug },
          select: { id: true, name: true },
        });

        if (topic) {
          topicId = topic.id;
          console.log(`[IngestNewsUseCase] 📌 Topic found: "${topic.name}" (ID: ${topicId})`);
        } else {
          console.warn(`[IngestNewsUseCase] ⚠️ Topic slug "${request.topicSlug}" not found in database`);
        }
      }

      // Normalize category (map English to Spanish if needed)
      const normalizedCategory = this.normalizeCategory(request.category || request.query);

      // Sprint 24: AI-powered local source discovery & multi-source ingestion
      const isLocalCategory = request.category?.toLowerCase() === 'local';
      let allArticles: any[] = [];

      if (isLocalCategory && request.query) {
        // STEP 1: Discover local sources (if not already in DB)
        if (this.localSourceDiscoveryService) {
          try {
            console.log(`[IngestNewsUseCase] 🔍 Discovering local sources for "${request.query}"...`);
            await this.localSourceDiscoveryService.discoverAndSave(request.query);
          } catch (error) {
            console.error(`[IngestNewsUseCase] ⚠️ Source discovery failed for "${request.query}":`, error);
            // Continue with ingestion even if discovery fails
          }
        }

        // STEP 2: Fetch discovered sources from DB
        const localSources = await this.prisma.source.findMany({
          where: {
            location: request.query,
            isActive: true,
          },
        });

        console.log(`[IngestNewsUseCase] 📰 Found ${localSources.length} local sources for "${request.query}"`);

        // STEP 3: Multi-source RSS ingestion (fetch from each discovered source)
        if (localSources.length > 0) {
          console.log(`[IngestNewsUseCase] 📡 Fetching from local RSS sources...`);

          const fetchPromises = localSources.map((source) =>
            this.fetchFromLocalSource(source.url, source.name)
          );

          const sourcesResults = await Promise.all(fetchPromises);
          const localArticles = sourcesResults.flat();

          console.log(`[IngestNewsUseCase] ✅ Fetched ${localArticles.length} articles from ${localSources.length} local sources`);

          // Add local source articles to the pool
          allArticles.push(...localArticles);
        } else {
          console.log(`[IngestNewsUseCase] ⚠️ No local sources found, falling back to Google News RSS`);
        }

        // STEP 4: Hybrid approach - also fetch from Google News RSS for broader coverage
        if (this.localNewsClient) {
          try {
            console.log(`[IngestNewsUseCase] 🌐 Fetching additional articles from Google News RSS...`);
            const googleResult = await this.localNewsClient.fetchTopHeadlines({
              category: request.category,
              language: request.language || 'es',
              query: request.query,
              pageSize: request.pageSize || 20,
              page: 1,
            });

            console.log(`[IngestNewsUseCase] ✅ Fetched ${googleResult.articles.length} articles from Google News`);
            allArticles.push(...googleResult.articles);
          } catch (error) {
            console.error(`[IngestNewsUseCase] ⚠️ Google News RSS fetch failed:`, error);
          }
        }
      } else {
        // Non-local categories: use standard flow
        const activeClient = this.newsAPIClient;
        const searchQuery = this.getSmartQuery(request.category, request.query);

        console.log(`[IngestNewsUseCase] 🔍 Fetching news: category="${request.category}" query="${searchQuery}" client="Primary" topicId="${topicId || 'null'}"`);

        const result = await activeClient.fetchTopHeadlines({
          category: request.category,
          language: request.language || 'es',
          query: searchQuery,
          pageSize: request.pageSize || 20,
          page: 1,
        });

        allArticles = result.articles;
      }

      // OPTIMIZATION: Limit to MAX_ITEMS_PER_SOURCE to reduce database load
      const limitedArticles = allArticles.slice(0, MAX_ITEMS_PER_SOURCE);
      totalFetched = limitedArticles.length;

      console.log(`📥 Ingesta: Recibidos ${allArticles.length} artículos, procesando ${totalFetched} (límite: ${MAX_ITEMS_PER_SOURCE})`);

      if (totalFetched === 0) {
        return this.createResponse(
          true,
          totalFetched,
          newArticles,
          duplicates,
          errors,
          'newsapi',
          startTime
        );
      }

      // OPTIMIZATION: Batch check for existing URLs to track what's new vs updated
      const incomingUrls = limitedArticles.map(a => a.url);
      const existingUrls = await this.getExistingUrls(incomingUrls);
      
      console.log(`🔍 Pre-ingesta: ${existingUrls.size} URLs ya existen, ${totalFetched - existingUrls.size} son nuevas`);
      console.log(`📝 Estrategia: Usar UPSERT para TODAS las URLs (actualiza metadata si existe, crea si es nueva)`);

      // Transform to domain entities - NO FILTRAR duplicados, dejar que upsert maneje todo
      const articlesToSave: NewsArticle[] = [];
      let updatedArticles = 0;

      for (const apiArticle of limitedArticles) {
        try {
          // Trackear si es update o insert (solo para logging/stats)
          const isExisting = existingUrls.has(apiArticle.url);
          if (isExisting) {
            updatedArticles++;
            console.log(`♻️  URL existente (se actualizará): ${apiArticle.url.substring(0, 60)}...`);
          }

          // Create domain entity with normalized category
          // IMPORTANT: Only raw data is saved here, NO AI analysis
          // El mapper decidirá si hacer INSERT (nueva) o UPDATE (existente)
          const article = NewsArticle.create({
            id: randomUUID(), // Si es update, el upsert ignorará este ID
            title: apiArticle.title || 'Untitled',
            description: apiArticle.description,
            content: apiArticle.content,
            url: apiArticle.url,
            urlToImage: apiArticle.urlToImage,
            source: apiArticle.source.name,
            author: apiArticle.author,
            publishedAt: new Date(apiArticle.publishedAt),
            category: normalizedCategory, // Se actualizará si la noticia existe con otra categoría
            topicId: topicId, // Sprint 23: Assign topic if topicSlug was provided
            language: request.language || 'es',
            embedding: null,
            summary: null,
            biasScore: null,
            analysis: null,
            analyzedAt: null,
            internalReasoning: null,
            isFavorite: false,
            fetchedAt: new Date(),
            updatedAt: new Date(),
          });

          articlesToSave.push(article);
        } catch (error) {
          console.error(`Failed to process article ${apiArticle.url}:`, error);
          errors++;
        }
      }

      // Save/Update articles in batch with UPSERT
      if (articlesToSave.length > 0) {
        await this.articleRepository.saveMany(articlesToSave);
        newArticles = articlesToSave.length - updatedArticles; // Solo contar las NUEVAS
        duplicates = updatedArticles; // Las "duplicadas" ahora son "actualizadas"
        
        console.log(`✅ Ingesta completada:`);
        console.log(`   📝 Nuevas: ${newArticles} | ♻️  Actualizadas: ${updatedArticles} | ❌ Errores: ${errors}`);
        console.log(`   📂 Categoría aplicada: "${normalizedCategory}"`);
      } else {
        console.log(`⚠️ Ingesta completada: No se procesaron artículos.`);
      }

      // Record ingestion metadata
      const sourceName = isLocalCategory ? 'google-news-local' : 'newsapi';
      await this.recordIngestionMetadata(
        sourceName,
        newArticles,
        errors > 0 ? 'partial_success' : 'success',
        errors > 0 ? `${errors} articles failed to process` : null
      );

      return this.createResponse(
        true,
        totalFetched,
        newArticles,
        duplicates,
        errors,
        sourceName,
        startTime
      );
    } catch (error) {
      // Record failed ingestion
      await this.recordIngestionMetadata(
        'newsapi',
        0,
        'error',
        (error as Error).message
      );

      throw error;
    }
  }

  /**
   * OPTIMIZATION: Batch check for existing URLs
   * Fetches all matching URLs in a single query instead of N queries
   */
  private async getExistingUrls(urls: string[]): Promise<Set<string>> {
    const existingArticles = await this.prisma.article.findMany({
      where: {
        url: {
          in: urls
        }
      },
      select: {
        url: true
      }
    });

    return new Set(existingArticles.map(a => a.url));
  }

  /**
   * SPRINT 22: Get smart search query for a topic
   * Uses keyword mapping to improve search results from external API
   *
   * @param category - The category/topic slug
   * @param fallbackQuery - Optional fallback query if topic not in dictionary
   * @returns Smart query string with keywords, or fallback/undefined
   */
  private getSmartQuery(category: string | undefined, fallbackQuery: string | undefined): string | undefined {
    if (!category) {
      return fallbackQuery;
    }

    const lower = category.toLowerCase();

    // Check if we have a smart query for this topic
    if (TOPIC_QUERIES[lower]) {
      console.log(`[IngestNewsUseCase] 💡 Using smart query for topic "${lower}": "${TOPIC_QUERIES[lower]}"`);
      return TOPIC_QUERIES[lower];
    }

    // Fallback to provided query or undefined (will use category filter only)
    if (fallbackQuery) {
      console.log(`[IngestNewsUseCase] 📝 Using fallback query: "${fallbackQuery}"`);
      return fallbackQuery;
    }

    console.log(`[IngestNewsUseCase] 🏷️ No smart query for "${lower}", using category filter only`);
    return undefined;
  }

  /**
   * Normalize category to Spanish (maps English categories for backwards compatibility)
   */
  private normalizeCategory(category: string | undefined): string | null {
    if (!category) return null;

    const lower = category.toLowerCase();

    // If it's already a valid Spanish category, return it
    if (VALID_CATEGORIES.includes(lower as any)) {
      return lower;
    }

    // Try to map from English
    if (CATEGORY_MAPPING[lower]) {
      return CATEGORY_MAPPING[lower];
    }

    // Return original if can't map (will be stored as-is)
    return category;
  }

  private validateRequest(request: IngestNewsRequest): void {
    if (request.pageSize !== undefined && (request.pageSize < 1 || request.pageSize > 100)) {
      throw new ValidationError('pageSize must be between 1 and 100');
    }

    if (request.language && !/^[a-z]{2}$/.test(request.language)) {
      throw new ValidationError('language must be a 2-letter ISO code');
    }

    // Accept both Spanish and English categories (will be normalized later)
    const allValidCategories = [
      ...VALID_CATEGORIES,
      'business',
      'entertainment',
      'health',
      'science',
      'sports',
      'technology',
    ];

    if (request.category && !allValidCategories.includes(request.category.toLowerCase() as any)) {
      throw new ValidationError(
        `category must be one of: ${VALID_CATEGORIES.join(', ')}`
      );
    }
  }

  /**
   * Sprint 24: Fetch and parse articles from a local RSS source
   * Transforms RSS items to NewsAPIArticle format for uniform processing
   */
  private async fetchFromLocalSource(
    sourceUrl: string,
    sourceName: string
  ): Promise<any[]> {
    try {
      const feed = await this.rssParser.parseURL(sourceUrl);

      return (feed.items || []).map((item: any) => ({
        title: item.title || 'Sin título',
        description: item.contentSnippet || item.description || null,
        content: item.content || item.contentSnippet || null,
        url: item.link || sourceUrl,
        urlToImage: item.enclosure?.url || null,
        source: {
          id: sourceName.toLowerCase().replace(/\s+/g, '-'),
          name: sourceName,
        },
        author: item.creator || item.author || null,
        publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
      }));
    } catch (error) {
      console.error(`[IngestNewsUseCase] ⚠️ Failed to fetch from "${sourceName}" (${sourceUrl}):`, error);
      return []; // Return empty array on failure, don't break entire ingestion
    }
  }

  private async recordIngestionMetadata(
    source: string,
    articlesCount: number,
    status: string,
    errorMessage: string | null = null
  ): Promise<void> {
    try {
      await this.prisma.ingestMetadata.create({
        data: {
          id: randomUUID(),
          source,
          lastFetch: new Date(),
          articlesCount,
          status,
          errorMessage,
        },
      });
    } catch (error) {
      console.error('Failed to record ingestion metadata:', error);
    }
  }

  /**
   * Global Ingest: Ingest news for ALL valid categories
   *
   * Optimization: Runs in batches to avoid overloading RSS sources or DB.
   * Batches of 3 categories run in parallel.
   *
   * @returns Summary with total processed and errors
   */
  async ingestAll(): Promise<{ processed: number; errors: number; results: Record<string, IngestNewsResponse> }> {
    console.log('🌍 [IngestAll] Starting global ingestion for all categories...\n');

    // Filter out 'local' (requires specific city query)
    const categoriesToIngest = VALID_CATEGORIES.filter(cat => cat !== 'local');

    const BATCH_SIZE = 3; // Concurrency limit to avoid rate limiting
    const results: Record<string, IngestNewsResponse> = {};
    let processed = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < categoriesToIngest.length; i += BATCH_SIZE) {
      const batch = categoriesToIngest.slice(i, i + BATCH_SIZE);

      console.log(`📦 [IngestAll] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.join(', ')}`);

      // Run batch in parallel
      const batchPromises = batch.map(async (category) => {
        try {
          console.log(`   🔄 Ingesting: ${category}`);

          const result = await this.execute({
            category,
            topicSlug: category, // Use category as topicSlug
            language: 'es',
            pageSize: 20,
          });

          results[category] = result;
          processed++;

          console.log(`   ✅ ${category}: ${result.newArticles} new, ${result.duplicates} duplicates`);

          return { category, success: true, result };
        } catch (error) {
          console.error(`   ❌ ${category}: Failed -`, (error as Error).message);
          errors++;
          return { category, success: false, error };
        }
      });

      await Promise.all(batchPromises);

      // Small delay between batches to be nice to RSS sources
      if (i + BATCH_SIZE < categoriesToIngest.length) {
        console.log(`   ⏳ Waiting 2s before next batch...\n`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n🎉 [IngestAll] Global ingestion completed!');
    console.log(`   ✅ Processed: ${processed}/${categoriesToIngest.length} categories`);
    console.log(`   ❌ Errors: ${errors}`);

    return { processed, errors, results };
  }

  private createResponse(
    success: boolean,
    totalFetched: number,
    newArticles: number,
    duplicates: number,
    errors: number,
    source: string,
    timestamp: Date
  ): IngestNewsResponse {
    return {
      success,
      totalFetched,
      newArticles,
      duplicates,
      errors,
      source,
      timestamp,
    };
  }
}
