/**
 * Search Routes (Infrastructure/Presentation Layer)
 * Defines HTTP routes for semantic search endpoints
 */

import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';

export function createSearchRoutes(searchController: SearchController): Router {
  const router = Router();

  // GET /api/search?q=query&limit=10 - Semantic search for news articles
  router.get('/', (req, res) => searchController.search(req, res));

  return router;
}
