/**
 * News Routes (Infrastructure/Presentation Layer)
 * Defines HTTP routes for news article endpoints.
 *
 * PRIVACY: Favorite endpoints require authentication.
 * GET endpoints use optional auth to enrich with per-user data.
 */

import { Router } from 'express';
import { NewsController } from '../controllers/news.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';

export class NewsRoutes {
  static get routes(): Router {
    const router = Router();
    return router;
  }

  static createRoutes(newsController: NewsController): Router {
    const router = Router();

    // PATCH /api/news/:id/favorite - Toggle favorite (REQUIRES AUTH for per-user isolation)
    router.patch('/:id/favorite', authenticate, newsController.toggleFavorite.bind(newsController));

    // GET /api/news/search - Search news with Waterfall strategy (Sprint 19)
    // IMPORTANT: Must be BEFORE /:id route to avoid route collision
    router.get('/search', optionalAuthenticate, newsController.search.bind(newsController));

    // GET /api/news - Get all news (optional auth for per-user favorite enrichment)
    router.get('/', optionalAuthenticate, newsController.getNews.bind(newsController));

    // GET /api/news/:id - Get single article (optional auth for per-user favorite status)
    router.get('/:id', optionalAuthenticate, newsController.getNewsById.bind(newsController));

    return router;
  }
}

// Legacy export for backward compatibility
export function createNewsRoutes(newsController: NewsController): Router {
  return NewsRoutes.createRoutes(newsController);
}
