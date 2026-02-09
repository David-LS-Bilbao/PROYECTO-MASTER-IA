/**
 * Topic Routes
 * Defines HTTP routes for topic/category management
 *
 * Sprint 20: Topics/Categories Management
 */

import { Router } from 'express';
import { TopicController } from '../controllers/topic.controller';

export function createTopicRoutes(controller: TopicController): Router {
  const router = Router();

  /**
   * GET /api/topics
   * Get all topics/categories
   * Public endpoint - no authentication required
   */
  router.get('/', (req, res) => controller.getAllTopics(req, res));

  /**
   * GET /api/topics/:slug
   * Get a single topic by slug
   * Public endpoint - no authentication required
   */
  router.get('/:slug', (req, res) => controller.getTopicBySlug(req, res));

  return router;
}
