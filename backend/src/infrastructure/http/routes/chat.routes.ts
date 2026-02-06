/**
 * Chat Routes (Infrastructure Layer)
 * Defines HTTP routes for chat functionality
 */

import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';

export function createChatRoutes(chatController: ChatController): Router {
  const router = Router();

  /**
   * POST /api/chat/article
   * Send a chat message about an article
   * Body: { articleId: string, messages: Array<{ role: 'user' | 'assistant', content: string }> }
   */
  router.post('/article', (req, res) => chatController.chatWithArticle(req, res));

  /**
   * POST /api/chat/general
   * Send a general chat message about all news (Sprint 19.6)
   * Body: { messages: Array<{ role: 'user' | 'assistant', content: string }> }
   */
  router.post('/general', (req, res) => chatController.chatGeneral(req, res));

  return router;
}
