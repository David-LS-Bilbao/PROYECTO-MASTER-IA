/**
 * User Routes
 * Defines HTTP routes for user profile management
 */

import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';

export function createUserRoutes(controller: UserController): Router {
  const router = Router();

  /**
   * GET /api/user/me
   * Get current user's complete profile
   * Headers: Authorization: Bearer <firebase-token>
   */
  router.get('/me', authenticate, (req, res) => controller.getProfile(req, res));

  /**
   * PATCH /api/user/me
   * Update current user's profile (name and preferences)
   * Headers: Authorization: Bearer <firebase-token>
   * Body: { name?: string, preferences?: any }
   */
  router.patch('/me', authenticate, (req, res) => controller.updateProfile(req, res));

  /**
   * GET /api/user/token-usage
   * Get Gemini API token usage statistics
   * Headers: Authorization: Bearer <firebase-token>
   */
  router.get('/token-usage', authenticate, (req, res) => controller.getTokenUsage(req, res));

  return router;
}
