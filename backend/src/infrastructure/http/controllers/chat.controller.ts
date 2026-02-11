/**
 * Chat Controller (Infrastructure/Presentation Layer)
 * Handles HTTP requests for article chat conversations
 */

import { Request, Response } from 'express';
import { ChatArticleUseCase } from '../../../application/use-cases/chat-article.usecase';
import { ChatGeneralUseCase } from '../../../application/use-cases/chat-general.usecase';
import { chatArticleSchema, chatGeneralSchema } from '../schemas/chat.schema';
import { ValidationError, EntityNotFoundError } from '../../../domain/errors/domain.error';
import {
  ExternalAPIError,
  DatabaseError,
  InfrastructureError,
} from '../../../domain/errors/infrastructure.error';
import { ZodError } from 'zod';
import { UserStatsTracker } from '../../monitoring/user-stats-tracker';

export class ChatController {
  constructor(
    private readonly chatArticleUseCase: ChatArticleUseCase,
    private readonly chatGeneralUseCase: ChatGeneralUseCase
  ) {}

  /**
   * POST /api/chat/article
   * Send a chat message about an article
   */
  async chatWithArticle(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body with Zod (Shift Left Security)
      const validatedInput = chatArticleSchema.parse(req.body);

      // Execute use case
      const result = await this.chatArticleUseCase.execute(validatedInput);

      // Track user stats (if authenticated)
      if (req.user?.uid) {
        UserStatsTracker.incrementChatMessages(req.user.uid, 1).catch(err =>
          console.error('[ChatController] Failed to track chat message:', err)
        );
      }

      res.status(200).json({
        success: true,
        data: {
          articleId: result.articleId,
          articleTitle: result.articleTitle,
          response: result.response,
        },
        message: 'Chat response generated successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * POST /api/chat/general
   * Send a general chat message about all news
   * Sprint 19.6 - Tarea 3: Chat General
   */
  async chatGeneral(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body with Zod (Shift Left Security)
      const validatedInput = chatGeneralSchema.parse(req.body);

      // Execute use case
      const result = await this.chatGeneralUseCase.execute(validatedInput);

      // Track user stats (if authenticated)
      if (req.user?.uid) {
        UserStatsTracker.incrementChatMessages(req.user.uid, 1).catch(err =>
          console.error('[ChatController] Failed to track chat message:', err)
        );
      }

      res.status(200).json({
        success: true,
        data: {
          response: result.response,
        },
        message: 'General chat response generated successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Centralized error handling
   */
  private handleError(error: unknown, res: Response): void {
    console.error('Chat Controller Error:', error);

    // Zod validation errors
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
      return;
    }

    // Entity not found errors
    if (error instanceof EntityNotFoundError) {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: error.message,
      });
      return;
    }

    // Domain validation errors
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.message,
      });
      return;
    }

    // External API errors (Gemini)
    if (error instanceof ExternalAPIError) {
      res.status(error.statusCode || 502).json({
        success: false,
        error: 'AI Service Error',
        message: error.message,
        service: error.service,
      });
      return;
    }

    // Database errors
    if (error instanceof DatabaseError) {
      res.status(500).json({
        success: false,
        error: 'Database Error',
        message: 'Failed to fetch article data',
      });
      return;
    }

    // Infrastructure errors
    if (error instanceof InfrastructureError) {
      res.status(500).json({
        success: false,
        error: 'Infrastructure Error',
        message: error.message,
      });
      return;
    }

    // Unknown errors
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  }
}
