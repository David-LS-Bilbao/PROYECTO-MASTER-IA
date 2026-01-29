/**
 * News Routes (Infrastructure/Presentation Layer)
 * Defines HTTP routes for news article endpoints
 */

import { Router } from 'express';
import { NewsController } from '../controllers/news.controller';

export function createNewsRoutes(newsController: NewsController): Router {
  const router = Router();

  // GET /api/news - Get all news articles (paginated)
  router.get('/', (req, res) => newsController.getNews(req, res));

  // GET /api/news/:id - Get a single news article by ID
  router.get('/:id', (req, res) => newsController.getNewsById(req, res));

  return router;
}
