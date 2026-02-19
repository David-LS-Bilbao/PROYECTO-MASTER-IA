/**
 * NewsController (Infrastructure/Presentation Layer)
 * Handles HTTP requests for news articles.
 *
 * PRIVACY: Favorites are per-user (junction table), not global.
 * All favorite operations require authentication.
 */

import { Request, Response } from 'express';
import { INewsArticleRepository, ParsedLocation } from '../../../domain/repositories/news-article.repository';
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
 * Prevents re-fetching Google News RSS for the same city too frequently
 * Key: city name (lowercase), Value: timestamp of last ingestion
 */
const DEFAULT_LOCAL_INGEST_TTL_MINUTES = 15;
const parsedLocalIngestTtlMinutes = Number(
  process.env.LOCAL_INGEST_TTL_MINUTES ?? DEFAULT_LOCAL_INGEST_TTL_MINUTES
);
const LOCAL_INGEST_TTL =
  Number.isFinite(parsedLocalIngestTtlMinutes) && parsedLocalIngestTtlMinutes > 0
    ? parsedLocalIngestTtlMinutes * 60 * 1000
    : DEFAULT_LOCAL_INGEST_TTL_MINUTES * 60 * 1000;
// Sprint 37: increased from 6000 → 12000 (Google News RSS can take 8-10s on cold start)
const DEFAULT_LOCAL_INGEST_TIMEOUT_MS = 12000;
const parsedLocalIngestTimeoutMs = Number(
  process.env.LOCAL_INGEST_TIMEOUT_MS ?? DEFAULT_LOCAL_INGEST_TIMEOUT_MS
);
const LOCAL_INGEST_TIMEOUT_MS =
  Number.isFinite(parsedLocalIngestTimeoutMs) && parsedLocalIngestTimeoutMs > 0
    ? parsedLocalIngestTimeoutMs
    : DEFAULT_LOCAL_INGEST_TIMEOUT_MS;
const DEFAULT_LOCAL_FORCE_REFRESH_TIMEOUT_MS = 20000;
const parsedLocalForceRefreshTimeoutMs = Number(
  process.env.LOCAL_FORCE_REFRESH_TIMEOUT_MS ?? DEFAULT_LOCAL_FORCE_REFRESH_TIMEOUT_MS
);
const LOCAL_FORCE_REFRESH_TIMEOUT_MS =
  Number.isFinite(parsedLocalForceRefreshTimeoutMs) && parsedLocalForceRefreshTimeoutMs > 0
    ? parsedLocalForceRefreshTimeoutMs
    : DEFAULT_LOCAL_FORCE_REFRESH_TIMEOUT_MS;
const localIngestCache = new Map<string, number>();

const newsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  category: z.string().trim().min(1).optional(),
  location: z.string().trim().min(1).optional(),
  refresh: z.enum(['true', 'false']).optional(),
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

function parseLocationInput(input: string): ParsedLocation {
  const trimmed = input.trim();
  if (!trimmed) return { city: 'Madrid' };

  const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);

  return {
    city: parts[0] || 'Madrid',
    province: parts[1],
    region: undefined, // TODO: provincia→región mapping
  };
}

function buildLocalIngestQuery(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  // Expand "City, Region" into "City Region" to broaden RSS matching.
  return trimmed
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .join(' ');
}

function setOptionalHeader(res: Response, name: string, value: string): void {
  if (typeof res.setHeader === 'function') {
    res.setHeader(name, value);
  }
}

function sanitizePotentialMojibake(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact || !/[ÃÂâ]/.test(compact)) {
    return compact;
  }

  try {
    let repaired = compact;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (!/[ÃÂâ]/.test(repaired)) {
        break;
      }
      repaired = Buffer.from(repaired, 'latin1').toString('utf8').trim();
    }
    if (repaired && !repaired.includes('Ã')) {
      return repaired;
    }
  } catch {
    return compact;
  }

  return compact.replace(/Ã/g, '');
}

function sanitizeResponsePayload<T>(value: T): T {
  const sanitize = (entry: unknown): unknown => {
    if (entry instanceof Date) {
      const timestamp = entry.getTime();
      return Number.isNaN(timestamp) ? null : entry.toISOString();
    }

    if (typeof entry === 'string') {
      return sanitizePotentialMojibake(entry);
    }
    if (Array.isArray(entry)) {
      return entry.map((nestedEntry) => sanitize(nestedEntry));
    }
    if (entry && typeof entry === 'object') {
      const prototype = Object.getPrototypeOf(entry);
      if (prototype !== Object.prototype && prototype !== null) {
        return entry;
      }

      const sanitizedRecord: Record<string, unknown> = {};
      for (const [key, nestedValue] of Object.entries(entry as Record<string, unknown>)) {
        sanitizedRecord[key] = sanitize(nestedValue);
      }
      return sanitizedRecord;
    }
    return entry;
  };

  return sanitize(value) as T;
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
  const parsedAnalysis = article.getParsedAnalysis();

  // Check if analysis exists globally in DB
  const hasAnalysis = json.analyzedAt !== null;

  // PRIVACY: If user hasn't favorited, mask sensitive AI data
  if (maskAnalysis) {
    return sanitizeResponsePayload({
      ...json,
      // Mask AI fields (null indicates not available to this user)
      analysis: null,
      summary: null,
      biasScore: null,
      // Signal that analysis exists and is ready for instant retrieval
      hasAnalysis,
    });
  }

  // Normal response with full analysis (user has favorited or analysis doesn't exist)
  return sanitizeResponsePayload({
    ...json,
    analysis: parsedAnalysis,
    hasAnalysis,
  });
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

      const { limit, offset, category, favorite, location, refresh } = parsed.data;
      const resolvedLimit = limit ?? 20;
      const resolvedOffset = offset ?? 0;
      let resolvedCategory = category;
      const onlyFavorites = favorite === 'true';
      const forceRefresh = refresh === 'true';

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

        const requestedInput = location || user?.location || 'Madrid';
        const parsed = parseLocationInput(requestedInput);
        const city = parsed.city; // Para compatibilidad con código existente
        const ingestQuery = requestedInput ? buildLocalIngestQuery(requestedInput) : city;
        const refreshMeta: {
          forced: boolean;
          attempted: boolean;
          status: 'skipped_ttl' | 'completed' | 'timeout' | 'error';
          timeoutMs: number;
          durationMs: number;
          pending: boolean;
          queryUsed: string;
          ingest: null | {
            totalFetched: number;
            newArticles: number;
            duplicates: number;
            errors: number;
            source: string;
            timestamp: string;
          };
        } = {
          forced: forceRefresh,
          attempted: false,
          status: 'skipped_ttl',
          timeoutMs: forceRefresh ? LOCAL_FORCE_REFRESH_TIMEOUT_MS : LOCAL_INGEST_TIMEOUT_MS,
          durationMs: 0,
          pending: false,
          queryUsed: ingestQuery,
          ingest: null,
        };

        // Sprint 24: Active Local Ingestion - fetch fresh news about the city via Google News RSS
        if (forceRefresh || shouldIngestLocal(city)) {
          refreshMeta.attempted = true;
          const ingestStartedAt = Date.now();

          const ingestionPromise = this.ingestNewsUseCase.execute({
            category: 'local',
            topicSlug: 'local',
            query: ingestQuery,
            pageSize: 40, // Sprint 37: increased from 20 → 40 for better local coverage
            language: 'es',
          })
            .then((result) => ({ kind: 'completed' as const, result }))
            .catch((ingestionError) => ({ kind: 'error' as const, error: ingestionError }));

          const timeoutPromise = new Promise<{ kind: 'timeout' }>((resolve) => {
            setTimeout(() => resolve({ kind: 'timeout' }), refreshMeta.timeoutMs);
          });

          const ingestionResult = await Promise.race([ingestionPromise, timeoutPromise]);
          refreshMeta.durationMs = Date.now() - ingestStartedAt;

          if (ingestionResult.kind === 'timeout') {
            refreshMeta.status = 'timeout';
            refreshMeta.pending = true;
            console.warn(
              `[NewsController.getNews] ⏱️ Local ingestion timeout after ${refreshMeta.timeoutMs}ms for "${city}". Returning cached DB data.`
            );
          } else if (ingestionResult.kind === 'error') {
            refreshMeta.status = 'error';
            console.error(`[NewsController.getNews] ❌ Local ingestion failed for "${city}":`, ingestionResult.error);
          } else {
            refreshMeta.status = 'completed';
            const result = ingestionResult.result as Partial<{
              totalFetched: number;
              newArticles: number;
              duplicates: number;
              errors: number;
              source: string;
              timestamp: Date;
            }>;
            refreshMeta.ingest = {
              totalFetched: result.totalFetched ?? 0,
              newArticles: result.newArticles ?? 0,
              duplicates: result.duplicates ?? 0,
              errors: result.errors ?? 0,
              source: result.source ?? 'local',
              timestamp:
                result.timestamp instanceof Date
                  ? result.timestamp.toISOString()
                  : new Date().toISOString(),
            };
            console.log(
              `[NewsController.getNews] ✅ Local ingestion "${city}" (query="${ingestQuery}"): fetched=${refreshMeta.ingest.totalFetched}, new=${refreshMeta.ingest.newArticles}, duplicates=${refreshMeta.ingest.duplicates}, errors=${refreshMeta.ingest.errors}`
            );
          }

          // Avoid repeated blocking attempts during TTL window.
          markLocalIngested(city);
        }

        // Sprint 28 BUG #1 FIX + vNext: searchLocalArticles con fallback progresivo
        const { articles: localNews, scopeUsed } = await this.repository.searchLocalArticles(
          parsed,
          resolvedLimit,
          resolvedOffset,
          userId
        );
        const localTotal = localNews.length; // Total basado en scopeUsed real

        // If no results, suggest fallback
        if (localNews.length === 0) {
          setOptionalHeader(res, 'x-local-refresh-status', refreshMeta.status);
          setOptionalHeader(res, 'x-local-refresh-forced', String(refreshMeta.forced));
          setOptionalHeader(res, 'x-local-refresh-attempted', String(refreshMeta.attempted));
          if (refreshMeta.ingest) {
            setOptionalHeader(res, 'x-local-refresh-new-articles', String(refreshMeta.ingest.newArticles));
          }
          res.json({
            success: true,
            data: [],
            pagination: { total: localTotal, limit: resolvedLimit, offset: resolvedOffset, hasMore: false },
            meta: {
              message: `No hay noticias recientes sobre ${city}. Intenta con una búsqueda manual.`,
              refresh: refreshMeta,
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

        setOptionalHeader(res, 'x-local-refresh-status', refreshMeta.status);
        setOptionalHeader(res, 'x-local-refresh-forced', String(refreshMeta.forced));
        setOptionalHeader(res, 'x-local-refresh-attempted', String(refreshMeta.attempted));
        if (refreshMeta.ingest) {
          setOptionalHeader(res, 'x-local-refresh-new-articles', String(refreshMeta.ingest.newArticles));
        }
        res.json({
          success: true,
          data,
          pagination: {
            total: localTotal,
            limit: resolvedLimit,
            offset: resolvedOffset,
            hasMore: resolvedOffset + localNews.length < localTotal,
          },
          meta: {
            location: city,
            message: scopeUsed === 'city'
              ? `Noticias locales para ${city}`
              : scopeUsed === 'province'
              ? `Noticias de ${parsed.province || 'la provincia'} (cobertura local limitada)`
              : 'Noticias locales de España',
            localMeta: {
              requested: requestedInput,
              resolved: {
                city: parsed.city,
                province: parsed.province,
                region: parsed.region,
              },
              scopeUsed,
              ttlMinutes: Number(process.env.LOCAL_INGEST_TTL_MINUTES) || 15,
              fetchedAt: new Date().toISOString(),
            },
            refresh: refreshMeta,
          },
        });
        return;
      }

      // SPECIAL CASE 2: 'ciencia-tecnologia' topic (unified category)
      // Search for both 'ciencia' AND 'tecnologia' articles
      // Sprint 34 FIX: Only interleave on first page to avoid duplicates
      if (resolvedCategory === 'ciencia-tecnologia') {
        // Normalize to search both categories (will be handled by repository if supported)
        // For now, we'll search for 'ciencia' and 'tecnologia' separately and merge
        const useInterleaving = resolvedOffset === 0;

        let cienciaNews: NewsArticle[] = [];
        let tecnologiaNews: NewsArticle[] = [];

        if (useInterleaving) {
          // FIRST PAGE: Fetch half from each category and interleave
          cienciaNews = await this.repository.findAll({
            limit: Math.ceil(resolvedLimit / 2),
            offset: 0,
            category: 'ciencia',
            onlyFavorites,
            userId,
          });

          tecnologiaNews = await this.repository.findAll({
            limit: Math.ceil(resolvedLimit / 2),
            offset: 0,
            category: 'tecnologia',
            onlyFavorites,
            userId,
          });

          // Sprint 22 FIX: Auto-fill if both categories are empty
          if (cienciaNews.length === 0 && tecnologiaNews.length === 0 && !onlyFavorites) {
            try {
              // Ingest both categories in parallel
              // Sprint 23: Pass topicSlug to assign articles to correct Topic
              await Promise.all([
                this.ingestNewsUseCase.execute({ category: 'ciencia', topicSlug: 'ciencia-tecnologia', pageSize: 15, language: 'es' }),
                this.ingestNewsUseCase.execute({ category: 'tecnologia', topicSlug: 'ciencia-tecnologia', pageSize: 15, language: 'es' }),
              ]);

              // Re-query both categories
              cienciaNews = await this.repository.findAll({
                limit: Math.ceil(resolvedLimit / 2),
                offset: 0,
                category: 'ciencia',
                onlyFavorites,
                userId,
              });

              tecnologiaNews = await this.repository.findAll({
                limit: Math.ceil(resolvedLimit / 2),
                offset: 0,
                category: 'tecnologia',
                onlyFavorites,
                userId,
              });
            } catch (ingestionError) {
              console.error(`[NewsController.getNews] ❌ Auto-ingestion failed for ciencia-tecnologia:`, ingestionError);
            }
          }
        } else {
          // SUBSEQUENT PAGES: Sequential fetch (first ciencia, then tecnología)
          // Get total count of ciencia articles to know where to split
          const cienciaCount = await this.repository.countFiltered({ category: 'ciencia', onlyFavorites, userId });

          if (resolvedOffset < cienciaCount) {
            // Still fetching from ciencia
            const cienciaRemaining = cienciaCount - resolvedOffset;
            const cienciaToFetch = Math.min(resolvedLimit, cienciaRemaining);

            cienciaNews = await this.repository.findAll({
              limit: cienciaToFetch,
              offset: resolvedOffset,
              category: 'ciencia',
              onlyFavorites,
              userId,
            });

            // If we need more articles, fetch from tecnología
            if (cienciaToFetch < resolvedLimit) {
              tecnologiaNews = await this.repository.findAll({
                limit: resolvedLimit - cienciaToFetch,
                offset: 0, // Start from beginning of tecnología
                category: 'tecnologia',
                onlyFavorites,
                userId,
              });
            }
          } else {
            // Offset beyond ciencia, fetch only from tecnología
            const tecnologiaOffset = resolvedOffset - cienciaCount;
            tecnologiaNews = await this.repository.findAll({
              limit: resolvedLimit,
              offset: tecnologiaOffset,
              category: 'tecnologia',
              onlyFavorites,
              userId,
            });
          }
        }

        // Merge results
        let mergedNews: NewsArticle[];
        if (useInterleaving) {
          // Interleave for first page (diversity)
          mergedNews = [];
          const maxLength = Math.max(cienciaNews.length, tecnologiaNews.length);
          for (let i = 0; i < maxLength; i++) {
            if (i < cienciaNews.length) mergedNews.push(cienciaNews[i]);
            if (i < tecnologiaNews.length) mergedNews.push(tecnologiaNews[i]);
            if (mergedNews.length >= resolvedLimit) break;
          }
        } else {
          // Sequential for subsequent pages (no duplicates)
          mergedNews = [...cienciaNews, ...tecnologiaNews];
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

          // Re-query the database after ingestion
          if (ingestionResult.newArticles > 0) {
            news = await this.repository.findAll({
              limit: resolvedLimit,
              offset: resolvedOffset,
              category: resolvedCategory,
              onlyFavorites,
              userId,
            });
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

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Missing article ID',
        });
        return;
      }

      const article = await this.repository.findById(id);

      if (!article) {
        res.status(404).json({
          success: false,
          error: 'Article not found',
        });
        return;
      }

      // Enrich with per-user favorite status
      const userId = req.user?.uid;
      let enrichedArticle = article;

      if (userId) {
        const favoriteIds = await this.repository.getUserFavoriteArticleIds(userId, [id]);
        const isFav = favoriteIds.has(id);
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

      // Sprint 18.2: PRIVACY - Mask analysis if user hasn't UNLOCKED it
      // (user can favorite ❤️ without unlocking analysis ✨)
      let shouldMask = true;
      if (userId) {
        const unlockedIds = await this.repository.getUserUnlockedArticleIds(userId, [id]);
        shouldMask = !unlockedIds.has(id);
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

      const { q, limit } = parsed.data;
      const resolvedLimit = limit ?? 20;
      const userId = req.user?.uid;

      // =====================================================================
      // LEVEL 1: QUICK DB SEARCH (Full-Text Search)
      // =====================================================================
      let results = await this.repository.searchArticles(q, resolvedLimit, userId);

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
      } catch (ingestionError) {
        if (ingestionError instanceof Error && ingestionError.message === 'Ingestion timeout') {
          console.warn(`[NewsController.search]    ⏱️ LEVEL 2: Ingestion timed out after 8s`);
        } else {
          console.error(`[NewsController.search]    ❌ LEVEL 2: Ingestion failed:`, ingestionError);
        }
        // Continue to retry search even if ingestion failed/timed out
      }

      // Retry DB search after ingestion
      results = await this.repository.searchArticles(q, resolvedLimit, userId);

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
