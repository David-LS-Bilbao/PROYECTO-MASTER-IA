/**
 * NewsController (Infrastructure/Presentation Layer)
 * Handles HTTP requests for news articles.
 *
 * PRIVACY: Favorites are per-user (junction table), not global.
 * All favorite operations require authentication.
 */

import { Request, Response } from 'express';
import { INewsArticleRepository } from '../../../domain/repositories/news-article.repository';
import { ToggleFavoriteUseCase } from '../../../application/use-cases/toggle-favorite.usecase';
import { IngestNewsUseCase } from '../../../application/use-cases/ingest-news.usecase';
import { NewsArticle } from '../../../domain/entities/news-article.entity';
import { getPrismaClient } from '../../persistence/prisma.client';
import { ValidationError } from '../../../domain/errors/domain.error';
import { z } from 'zod';

/**
 * Sprint 23: Map category names to Topic slugs
 * Some categories don't have a 1:1 mapping to topics
 */
const CATEGORY_TO_TOPIC_SLUG: Record<string, string> = {
  // Direct mappings
  'espana': 'espana',
  'internacional': 'internacional',
  'local': 'local',
  'economia': 'economia',
  'deportes': 'deportes',
  'salud': 'salud',
  'entretenimiento': 'entretenimiento',
  // Unified category
  'ciencia-tecnologia': 'ciencia-tecnologia',
  'ciencia': 'ciencia-tecnologia', // Map to unified category
  'tecnologia': 'ciencia-tecnologia', // Map to unified category
  // Fallbacks for legacy categories
  'general': 'internacional', // General news → International
  'politica': 'espana', // Politics → Spain
  'cultura': 'entretenimiento', // Culture → Entertainment
};

/**
 * Sprint 24: TTL cache for local ingestion
 * Prevents re-fetching Google News RSS for the same city within 1 hour
 * Key: city name (lowercase), Value: timestamp of last ingestion
 */
const LOCAL_INGEST_TTL = 60 * 60 * 1000; // 1 hour
const localIngestCache = new Map<string, number>();

const newsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  category: z.string().trim().min(1).optional(),
  favorite: z.enum(['true', 'false']).optional(),
}).passthrough();

const newsSearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Query parameter "q" is required'),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
}).passthrough();

function shouldIngestLocal(city: string): boolean {
  const key = city.toLowerCase().trim();
  const lastIngest = localIngestCache.get(key);
  return !lastIngest || Date.now() - lastIngest >= LOCAL_INGEST_TTL;
}

function markLocalIngested(city: string): void {
  localIngestCache.set(city.toLowerCase().trim(), Date.now());
}

/**
 * Transform domain article to HTTP response format
 * Parses the analysis JSON string into an object for frontend consumption
 *
 * PRIVACY ENHANCEMENT (Sprint 18.1):
 * - If user hasn't favorited the article, masks AI analysis fields (analysis, summary, biasScore)
 * - Adds `hasAnalysis` boolean to indicate analysis is available for instant retrieval
 * - This ensures analysis data is "private" or "on-demand" per user
 *
 * @param article - Domain entity
 * @param maskAnalysis - If true, hides AI analysis fields for privacy (user hasn't favorited)
 */
function toHttpResponse(article: NewsArticle, maskAnalysis = false) {
  const json = article.toJSON();

  // Check if analysis exists globally in DB
  const hasAnalysis = json.analyzedAt !== null;

  // PRIVACY: If user hasn't favorited, mask sensitive AI data
  if (maskAnalysis) {
    return {
      ...json,
      // Mask AI fields (null indicates not available to this user)
      analysis: null,
      summary: null,
      biasScore: null,
      // Signal that analysis exists and is ready for instant retrieval
      hasAnalysis,
    };
  }

  // Normal response with full analysis (user has favorited or analysis doesn't exist)
  return {
    ...json,
    analysis: json.analysis ? JSON.parse(json.analysis) : null,
    hasAnalysis,
  };
}

export class NewsController {
  constructor(
    private readonly repository: INewsArticleRepository,
    private readonly toggleFavoriteUseCase: ToggleFavoriteUseCase,
    private readonly ingestNewsUseCase: IngestNewsUseCase
  ) {}

  /**
   * GET /api/news
   * Get all news with pagination and optional filters.
   * Uses optionalAuthenticate: if user is authenticated, enriches with per-user favorites.
   *
   * Sprint 20: Smart topic handling for geolocation and unified categories
   */
  async getNews(req: Request, res: Response): Promise<void> {
    try {
      const parsed = newsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues.map(issue => issue.message).join('; '));
      }

      const { limit, offset, category, favorite } = parsed.data;
      const resolvedLimit = limit ?? 20;
      const resolvedOffset = offset ?? 0;
      let resolvedCategory = category;
      const onlyFavorites = favorite === 'true';

      // Per-user favorites require authentication
      const userId = req.user?.uid;

      if (onlyFavorites && !userId) {
        res.status(401).json({
          success: false,
          error: 'Debes iniciar sesion para ver tus favoritos',
        });
        return;
      }

      // =========================================================================
      // SPRINT 20: SMART TOPIC HANDLING - GEOLOCATION & UNIFIED CATEGORIES
      // =========================================================================

      // SPECIAL CASE 1: 'local' topic requires user location
      if (resolvedCategory === 'local') {
        if (!userId) {
          res.status(401).json({
            success: false,
            error: 'Debes iniciar sesión para ver noticias locales',
          });
          return;
        }

        // Get user's location from database
        const prisma = getPrismaClient();
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { location: true },
        });

        if (!user || !user.location) {
          res.status(400).json({
            success: false,
            error: 'Debes configurar tu ubicación en el perfil para ver noticias locales',
            hint: 'Actualiza tu perfil en /api/user/me con el campo "location"',
          });
          return;
        }

        // Sprint 24: Active Local Ingestion - fetch fresh news about the city via Google News RSS
        console.log(`[NewsController.getNews] 📍 Local news requested for location: ${user.location}`);

        if (shouldIngestLocal(user.location)) {
          console.log(`[NewsController.getNews] 🌐 Triggering local ingestion for "${user.location}" (TTL expired or first request)`);
          try {
            const ingestionResult = await this.ingestNewsUseCase.execute({
              category: 'local',
              topicSlug: 'local',
              query: user.location,
              pageSize: 20,
              language: 'es',
            });
            markLocalIngested(user.location);
            console.log(`[NewsController.getNews] 📍 Local ingestion: ${ingestionResult.newArticles} new articles for "${user.location}"`);
          } catch (ingestionError) {
            console.error(`[NewsController.getNews] ❌ Local ingestion failed for "${user.location}":`, ingestionError);
          }
        } else {
          console.log(`[NewsController.getNews] 💰 Local ingestion skipped for "${user.location}" (TTL active)`);
        }

        // Search DB for articles mentioning the location
        const localNews = await this.repository.searchArticles(user.location, resolvedLimit, userId);

        // If no results, suggest fallback
        if (localNews.length === 0) {
          res.json({
            success: true,
            data: [],
            pagination: { total: 0, limit: resolvedLimit, offset: resolvedOffset, hasMore: false },
            meta: {
              message: `No hay noticias recientes sobre ${user.location}. Intenta con una búsqueda manual.`,
            },
          });
          return;
        }

        // Mask analysis for articles user hasn't unlocked
        let unlockedIds = new Set<string>();
        const articleIds = localNews.map(a => a.id);
        unlockedIds = await this.repository.getUserUnlockedArticleIds(userId, articleIds);

        const data = localNews.map(article => {
          const shouldMask = !unlockedIds.has(article.id);
          return toHttpResponse(article, shouldMask);
        });

        res.json({
          success: true,
          data,
          pagination: {
            total: localNews.length,
            limit: resolvedLimit,
            offset: resolvedOffset,
            hasMore: localNews.length >= resolvedLimit, // Si devolvió el límite completo, puede haber más
          },
          meta: {
            location: user.location,
            message: `Noticias locales para ${user.location}`,
          },
        });
        return;
      }

      // SPECIAL CASE 2: 'ciencia-tecnologia' topic (unified category)
      // Search for both 'ciencia' AND 'tecnologia' articles
      if (resolvedCategory === 'ciencia-tecnologia') {
        // Normalize to search both categories (will be handled by repository if supported)
        // For now, we'll search for 'ciencia' and 'tecnologia' separately and merge
        let cienciaNews = await this.repository.findAll({
          limit: Math.ceil(resolvedLimit / 2),
          offset: Math.floor(resolvedOffset / 2),
          category: 'ciencia',
          onlyFavorites,
          userId,
        });

        let tecnologiaNews = await this.repository.findAll({
          limit: Math.ceil(resolvedLimit / 2),
          offset: Math.floor(resolvedOffset / 2),
          category: 'tecnologia',
          onlyFavorites,
          userId,
        });

        // Sprint 22 FIX: Auto-fill if both categories are empty
        if (cienciaNews.length === 0 && tecnologiaNews.length === 0 && !onlyFavorites && resolvedOffset === 0) {
          console.log(`[NewsController.getNews] 📭 Ciencia-Tecnologia categories empty - triggering auto-ingestion`);

          try {
            // Ingest both categories in parallel
            // Sprint 23: Pass topicSlug to assign articles to correct Topic
            await Promise.all([
              this.ingestNewsUseCase.execute({ category: 'ciencia', topicSlug: 'ciencia-tecnologia', pageSize: 15, language: 'es' }),
              this.ingestNewsUseCase.execute({ category: 'tecnologia', topicSlug: 'ciencia-tecnologia', pageSize: 15, language: 'es' }),
            ]);

            console.log(`[NewsController.getNews] ✅ Auto-ingestion completed for ciencia-tecnologia`);

            // Re-query both categories
            cienciaNews = await this.repository.findAll({
              limit: Math.ceil(resolvedLimit / 2),
              offset: Math.floor(resolvedOffset / 2),
              category: 'ciencia',
              onlyFavorites,
              userId,
            });

            tecnologiaNews = await this.repository.findAll({
              limit: Math.ceil(resolvedLimit / 2),
              offset: Math.floor(resolvedOffset / 2),
              category: 'tecnologia',
              onlyFavorites,
              userId,
            });

            console.log(`[NewsController.getNews] 📰 Re-queried: ${cienciaNews.length} ciencia + ${tecnologiaNews.length} tecnologia`);
          } catch (ingestionError) {
            console.error(`[NewsController.getNews] ❌ Auto-ingestion failed for ciencia-tecnologia:`, ingestionError);
          }
        }

        // Merge and interleave results
        const mergedNews: NewsArticle[] = [];
        const maxLength = Math.max(cienciaNews.length, tecnologiaNews.length);
        for (let i = 0; i < maxLength; i++) {
          if (i < cienciaNews.length) mergedNews.push(cienciaNews[i]);
          if (i < tecnologiaNews.length) mergedNews.push(tecnologiaNews[i]);
          if (mergedNews.length >= resolvedLimit) break;
        }

        const news = mergedNews.slice(0, resolvedLimit);

        // Get total count (sum of both categories)
        const cienciaCount = await this.repository.countFiltered({ category: 'ciencia', onlyFavorites, userId });
        const tecnologiaCount = await this.repository.countFiltered({ category: 'tecnologia', onlyFavorites, userId });
        const total = cienciaCount + tecnologiaCount;

        // Mask analysis for articles user hasn't unlocked
        let unlockedIds = new Set<string>();
        if (userId) {
          const articleIds = news.map(a => a.id);
          unlockedIds = await this.repository.getUserUnlockedArticleIds(userId, articleIds);
        }

        const data = news.map(article => {
          const shouldMask = !unlockedIds.has(article.id);
          return toHttpResponse(article, shouldMask);
        });

        res.json({
          success: true,
          data,
          pagination: {
            total,
            limit: resolvedLimit,
            offset: resolvedOffset,
            hasMore: resolvedOffset + news.length < total,
          },
          meta: {
            message: 'Noticias de Ciencia y Tecnología',
          },
        });
        return;
      }

      // NORMAL CASE: Standard category or no category
      // Fetch articles with per-user favorite enrichment
      let news = await this.repository.findAll({
        limit: resolvedLimit,
        offset: resolvedOffset,
        category: resolvedCategory,
        onlyFavorites,
        userId,
      });

      // =========================================================================
      // SPRINT 22 FIX: AUTO-FILL EMPTY CATEGORIES
      // If category is specified but DB is empty, trigger automatic ingestion
      // =========================================================================
      if (news.length === 0 && resolvedCategory && !onlyFavorites && resolvedOffset === 0) {
        console.log(`[NewsController.getNews] 📭 Category "${resolvedCategory}" is empty - triggering auto-ingestion`);

        try {
          // Trigger ingestion for this category
          // Sprint 23: Pass topicSlug to assign articles to correct Topic
          const topicSlug = CATEGORY_TO_TOPIC_SLUG[resolvedCategory.toLowerCase()] || resolvedCategory;
          const ingestionResult = await this.ingestNewsUseCase.execute({
            category: resolvedCategory,
            topicSlug, // Sprint 23: Map category to topic slug
            pageSize: 30, // Fetch 30 articles to populate category
            language: 'es',
          });

          console.log(`[NewsController.getNews] ✅ Auto-ingestion completed: ${ingestionResult.newArticles} new articles`);

          // Re-query the database after ingestion
          if (ingestionResult.newArticles > 0) {
            news = await this.repository.findAll({
              limit: resolvedLimit,
              offset: resolvedOffset,
              category: resolvedCategory,
              onlyFavorites,
              userId,
            });
            console.log(`[NewsController.getNews] 📰 Re-queried DB: Found ${news.length} articles`);
          }
        } catch (ingestionError) {
          // Log error but don't break the request - return empty array with helpful message
          console.error(`[NewsController.getNews] ❌ Auto-ingestion failed:`, ingestionError);
        }
      }

      // Get count for pagination
      const total = resolvedCategory || onlyFavorites
        ? await this.repository.countFiltered({ category: resolvedCategory, onlyFavorites, userId })
        : await this.repository.count();

      // Sprint 18.2: PRIVACY - Mask analysis for articles user hasn't UNLOCKED
      // (user can favorite ❤️ without unlocking analysis ✨)
      let unlockedIds = new Set<string>();
      if (userId) {
        const articleIds = news.map(a => a.id);
        unlockedIds = await this.repository.getUserUnlockedArticleIds(userId, articleIds);
      }

      const data = news.map(article => {
        const shouldMask = !unlockedIds.has(article.id); // If not unlocked, hide analysis
        return toHttpResponse(article, shouldMask);
      });

      res.json({
        success: true,
        data,
        pagination: {
          total,
          limit: resolvedLimit,
          offset: resolvedOffset,
          hasMore: resolvedOffset + news.length < total,
        },
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: error.message,
        });
        return;
      }

      console.error('Error fetching news:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * GET /api/news/:id
   * Get a single news article by ID.
   * If user is authenticated, enriches with per-user favorite status.
   */
  async getNewsById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      console.log(`\n[NewsController] 🔵 GET /api/news/${id.substring(0, 8)}...`);
      console.log(`[NewsController]    User: ${req.user?.email || 'anonymous'}`);

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Missing article ID',
        });
        return;
      }

      const article = await this.repository.findById(id);

      if (!article) {
        console.log(`[NewsController]    ❌ Article not found in DB`);
        res.status(404).json({
          success: false,
          error: 'Article not found',
        });
        return;
      }

      console.log(`[NewsController]    ✅ Article found:`, {
        title: article.title.substring(0, 40),
        analyzedAt: article.analyzedAt ? 'YES' : 'NO',
        biasScore: article.biasScore,
        summary: article.summary ? `${article.summary.substring(0, 30)}...` : 'NO',
      });

      // Enrich with per-user favorite status
      const userId = req.user?.uid;
      let enrichedArticle = article;

      if (userId) {
        const favoriteIds = await this.repository.getUserFavoriteArticleIds(userId, [id]);
        const isFav = favoriteIds.has(id);
        console.log(`[NewsController]    🔍 Per-user favorite check: ${isFav ? 'YES' : 'NO'}`);
        enrichedArticle = NewsArticle.reconstitute({
          ...article.toJSON(),
          isFavorite: isFav,
        });
      } else {
        enrichedArticle = NewsArticle.reconstitute({
          ...article.toJSON(),
          isFavorite: false,
        });
      }

      console.log(`[NewsController]    📤 Sending enriched article (isFavorite: ${enrichedArticle.isFavorite})`);

      // Sprint 18.2: PRIVACY - Mask analysis if user hasn't UNLOCKED it
      // (user can favorite ❤️ without unlocking analysis ✨)
      let shouldMask = true;
      if (userId) {
        const unlockedIds = await this.repository.getUserUnlockedArticleIds(userId, [id]);
        shouldMask = !unlockedIds.has(id);
        console.log(`[NewsController]    🔒 Analysis unlocked: ${!shouldMask ? 'YES' : 'NO'}`);
      } else {
        console.log(`[NewsController]    🔒 Analysis masking: YES (no user)`);
      }

      res.json({
        success: true,
        data: toHttpResponse(enrichedArticle, shouldMask),
      });
    } catch (error) {
      console.error('Error fetching article:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * PATCH /api/news/:id/favorite
   * Toggle favorite status of an article FOR THE AUTHENTICATED USER.
   * Requires authentication (authenticate middleware).
   */
  async toggleFavorite(req: Request, res: Response): Promise<void> {
    try {
      const articleId = req.params.id as string;
      const userId = req.user?.uid;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Debes iniciar sesion para gestionar favoritos',
        });
        return;
      }

      if (!articleId) {
        res.status(400).json({
          success: false,
          error: 'Missing article ID',
        });
        return;
      }

      console.log(`[Favorites] Toggle: user=${userId.substring(0, 8)}... article=${articleId.substring(0, 8)}...`);

      const result = await this.toggleFavoriteUseCase.execute({ articleId, userId });

      res.json({
        success: true,
        data: {
          id: articleId,
          isFavorite: result.isFavorite,
        },
        isFavorite: result.isFavorite,
      });
    } catch (error: unknown) {
      console.error('Error toggling favorite:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Internal server error';

      if (errorMessage.includes('not found')) {
        res.status(404).json({
          success: false,
          error: errorMessage,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  // =========================================================================
  // SPRINT 19: WATERFALL SEARCH ENGINE
  // =========================================================================

  /**
   * GET /api/news/search
   * Search news articles using Waterfall strategy:
   * LEVEL 1: Quick DB search (Full-Text Search)
   * LEVEL 2: If no results, trigger reactive ingestion (deep search) + retry DB
   * LEVEL 3: If still no results, return fallback with Google News suggestion
   *
   * Uses optionalAuthenticate: enriches results with per-user favorites if authenticated
   */
  async search(req: Request, res: Response): Promise<void> {
    try {
      const parsed = newsSearchQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues.map(issue => issue.message).join('; '));
      }

      const { q, limit, offset } = parsed.data;
      const resolvedLimit = limit ?? 20;
      const resolvedOffset = offset ?? 0;
      const userId = req.user?.uid;

      console.log(`\n========================================`);
      console.log(`🔍 SEARCH REQUEST:`, {
        query: q,
        limit: resolvedLimit,
        offset: resolvedOffset,
        userId: userId ? userId.substring(0, 8) + '...' : 'anonymous',
        timestamp: new Date().toISOString(),
      });
      console.log(`========================================`);

      // =====================================================================
      // LEVEL 1: QUICK DB SEARCH (Full-Text Search)
      // =====================================================================
      console.log(`[NewsController.search]    📊 LEVEL 1: Quick DB Search...`);

      let results = await this.repository.searchArticles(q, resolvedLimit, userId);

      console.log(`[NewsController.search]    📊 LEVEL 1: Found ${results.length} results`);

      // If NO results, log warning
      if (results.length === 0) {
        console.warn(`⚠️ LEVEL 1: Search returned 0 results for query: "${q}"`);
      }

      // If results found, return immediately
      if (results.length > 0) {
        // Sprint 18.2: Mask analysis for articles user hasn't unlocked
        let unlockedIds = new Set<string>();
        if (userId) {
          const articleIds = results.map(a => a.id);
          unlockedIds = await this.repository.getUserUnlockedArticleIds(userId, articleIds);
        }

        const data = results.map(article => {
          const shouldMask = !unlockedIds.has(article.id);
          return toHttpResponse(article, shouldMask);
        });

        res.json({
          success: true,
          data,
          meta: {
            total: results.length,
            query: q,
            level: 1,
            message: 'Results from database',
          },
        });
        return;
      }

      // =====================================================================
      // LEVEL 2: REACTIVE INGESTION ("Deep Search")
      // =====================================================================
      console.log(`[NewsController.search]    📡 LEVEL 2: No results, triggering reactive ingestion...`);

      try {
        // Trigger quick RSS ingestion (limited to general category)
        // Timeout: 8 seconds maximum
        const INGESTION_TIMEOUT = 8000;

        const ingestionPromise = this.ingestNewsUseCase.execute({
          category: 'general', // Only fetch from general category for speed
        });

        // Race between ingestion and timeout
        await Promise.race([
          ingestionPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Ingestion timeout')), INGESTION_TIMEOUT)
          ),
        ]);

        console.log(`[NewsController.search]    ✅ LEVEL 2: Ingestion completed`);
      } catch (ingestionError) {
        if (ingestionError instanceof Error && ingestionError.message === 'Ingestion timeout') {
          console.warn(`[NewsController.search]    ⏱️ LEVEL 2: Ingestion timed out after 8s`);
        } else {
          console.error(`[NewsController.search]    ❌ LEVEL 2: Ingestion failed:`, ingestionError);
        }
        // Continue to retry search even if ingestion failed/timed out
      }

      // Retry DB search after ingestion
      console.log(`[NewsController.search]    🔄 LEVEL 2: Retrying DB search...`);
      results = await this.repository.searchArticles(q, resolvedLimit, userId);
      console.log(`[NewsController.search]    📊 LEVEL 2: Found ${results.length} results after ingestion`);

      // If results found after ingestion, return with isFresh flag
      if (results.length > 0) {
        // Sprint 18.2: Mask analysis for articles user hasn't unlocked
        let unlockedIds = new Set<string>();
        if (userId) {
          const articleIds = results.map(a => a.id);
          unlockedIds = await this.repository.getUserUnlockedArticleIds(userId, articleIds);
        }

        const data = results.map(article => {
          const shouldMask = !unlockedIds.has(article.id);
          return toHttpResponse(article, shouldMask);
        });

        res.json({
          success: true,
          data,
          meta: {
            total: results.length,
            query: q,
            level: 2,
            message: 'Fresh results after reactive ingestion',
            isFresh: true,
          },
        });
        return;
      }

      // =====================================================================
      // LEVEL 3: FALLBACK WITH EXTERNAL SUGGESTION
      // =====================================================================
      console.log(`[NewsController.search]    🌐 LEVEL 3: No results found, returning fallback`);

      const encodedQuery = encodeURIComponent(q);

      res.json({
        success: true,
        data: [],
        meta: {
          total: 0,
          query: q,
          level: 3,
          message: 'No results found',
        },
        suggestion: {
          message: 'No hemos encontrado noticias recientes sobre este tema en nuestras fuentes.',
          actionText: 'Buscar en Google News',
          externalLink: `https://news.google.com/search?q=${encodedQuery}&hl=es&gl=ES&ceid=ES:es`,
        },
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: error.message,
        });
        return;
      }

      console.error('[NewsController.search] Error:', error);

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}
