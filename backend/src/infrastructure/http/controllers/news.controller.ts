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
   */
  async getNews(req: Request, res: Response): Promise<void> {
    try {
      const limit = Number(req.query.limit) || 20;
      const offset = Number(req.query.offset) || 0;
      const category = req.query.category as string | undefined;
      const onlyFavorites = req.query.favorite === 'true';

      // Per-user favorites require authentication
      const userId = req.user?.uid;

      if (onlyFavorites && !userId) {
        res.status(401).json({
          success: false,
          error: 'Debes iniciar sesion para ver tus favoritos',
        });
        return;
      }

      // Fetch articles with per-user favorite enrichment
      const news = await this.repository.findAll({
        limit,
        offset,
        category,
        onlyFavorites,
        userId,
      });

      // Get count for pagination
      const total = category || onlyFavorites
        ? await this.repository.countFiltered({ category, onlyFavorites, userId })
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
          limit,
          offset,
          hasMore: offset + news.length < total,
        },
      });
    } catch (error) {
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
    } catch (error: any) {
      console.error('Error toggling favorite:', error);

      if (error.message?.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
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
      const query = req.query.q as string;
      const limit = Number(req.query.limit) || 20;
      const userId = (req.user as any)?.uid;

      console.log(`\n[NewsController.search] 🔍 Query: "${query}", Limit: ${limit}, User: ${userId ? userId.substring(0, 8) + '...' : 'anonymous'}`);

      // Validate query
      if (!query || query.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Query parameter "q" is required',
        });
        return;
      }

      // =====================================================================
      // LEVEL 1: QUICK DB SEARCH (Full-Text Search)
      // =====================================================================
      console.log(`[NewsController.search]    📊 LEVEL 1: Quick DB Search...`);

      let results = await this.repository.searchArticles(query, limit, userId);

      console.log(`[NewsController.search]    📊 LEVEL 1: Found ${results.length} results`);

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
            query,
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
      results = await this.repository.searchArticles(query, limit, userId);
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
            query,
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

      const encodedQuery = encodeURIComponent(query);

      res.json({
        success: true,
        data: [],
        meta: {
          total: 0,
          query,
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
      console.error('[NewsController.search] Error:', error);

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}
