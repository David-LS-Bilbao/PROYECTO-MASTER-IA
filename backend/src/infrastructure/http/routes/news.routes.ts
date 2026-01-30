/**
 * News Routes (Infrastructure/Presentation Layer)
 * Defines HTTP routes for news article endpoints
 */

import { Router } from 'express';
import { NewsController } from '../controllers/news.controller';

export class NewsRoutes {
  static get routes(): Router {
    const router = Router();

    // NOTE: This is a placeholder - controller is injected when routes are created
    // The actual controller is provided by the server configuration
    return router;
  }

  static createRoutes(newsController: NewsController): Router {
    const router = Router();

    // PATCH /api/news/:id/favorite - Toggle favorite status (MUST be FIRST for route specificity)
    // Use .bind() to ensure 'this' context is preserved in the controller method
    router.patch('/:id/favorite', newsController.toggleFavorite.bind(newsController));

    // GET /api/news - Get all news articles (paginated)
    router.get('/', newsController.getNews.bind(newsController));

    // GET /api/news/:id - Get a single news article by ID
    router.get('/:id', newsController.getNewsById.bind(newsController));

    return router;
  }
}

// Legacy export for backward compatibility
export function createNewsRoutes(newsController: NewsController): Router {
  return NewsRoutes.createRoutes(newsController);
}
