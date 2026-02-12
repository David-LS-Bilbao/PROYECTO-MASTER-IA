/**
 * Chat Controller (Infrastructure/Presentation Layer)
 * Handles HTTP requests for article chat conversations
 *
 * Sprint 30: Premium Chat - Endpoints require PREMIUM subscription (7-day trial for new users)
 */

import { Request, Response } from 'express';
import { ChatArticleUseCase } from '../../../application/use-cases/chat-article.usecase';
import { ChatGeneralUseCase } from '../../../application/use-cases/chat-general.usecase';
import { chatArticleSchema, chatGeneralSchema } from '../schemas/chat.schema';
import { ValidationError, EntityNotFoundError, LowRelevanceError, FeatureLockedError } from '../../../domain/errors/domain.error';
import {
  ExternalAPIError,
  DatabaseError,
  InfrastructureError,
} from '../../../domain/errors/infrastructure.error';
import { ZodError } from 'zod';
import { UserStatsTracker } from '../../monitoring/user-stats-tracker';
import { QuotaService } from '../../../domain/services/quota.service';

export class ChatController {
  constructor(
    private readonly chatArticleUseCase: ChatArticleUseCase,
    private readonly chatGeneralUseCase: ChatGeneralUseCase,
    private readonly quotaService: QuotaService
  ) {}

  /**
   * POST /api/chat/article
   * Send a chat message about an article
   * Sprint 30: PREMIUM-only with 7-day trial for new users
   */
  async chatWithArticle(req: Request, res: Response): Promise<void> {
    try {
      // =========================================================================
      // PREMIUM GATE (Sprint 30): Verify chat access eligibility
      // =========================================================================
      if (!req.user) {
        throw new FeatureLockedError('Chat', 'Debes iniciar sesión para usar el Chat');
      }

      // Check if user can access Chat (throws FeatureLockedError if not eligible)
      this.quotaService.canAccessChat({
        id: req.user.uid,
        subscriptionPlan: req.user.subscriptionPlan || 'FREE',
        createdAt: req.user.createdAt ? new Date(req.user.createdAt) : undefined,
      });

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
   * Sprint 30: PREMIUM-only with 7-day trial for new users
   */
  async chatGeneral(req: Request, res: Response): Promise<void> {
    try {
      // =========================================================================
      // PREMIUM GATE (Sprint 30): Verify chat access eligibility
      // =========================================================================
      if (!req.user) {
        throw new FeatureLockedError('Chat', 'Debes iniciar sesión para usar el Chat');
      }

      // Check if user can access Chat (throws FeatureLockedError if not eligible)
      this.quotaService.canAccessChat({
        id: req.user.uid,
        subscriptionPlan: req.user.subscriptionPlan || 'FREE',
        createdAt: req.user.createdAt ? new Date(req.user.createdAt) : undefined,
      });

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

    // =========================================================================
    // GRACEFUL DEGRADATION (Sprint 29): Low Relevance - Fallback to General Chat
    // =========================================================================
    // NOT an error - this is expected behavior for out-of-domain questions
    // Return HTTP 200 with special flag to trigger frontend fallback
    if (error instanceof LowRelevanceError) {
      res.status(200).json({
        success: true,
        data: {
          response: error.message,
        },
        meta: {
          low_context: true, // Flag for frontend to show fallback UI
        },
        message: 'Pregunta fuera del contexto del artículo',
      });
      return;
    }

    // =========================================================================
    // PREMIUM GATE (Sprint 30): Feature Locked - Show Upgrade CTA
    // =========================================================================
    if (error instanceof FeatureLockedError) {
      res.status(403).json({
        success: false,
        error: 'Feature Locked',
        errorCode: error.errorCode, // 'CHAT_FEATURE_LOCKED'
        message: error.message,
        details: error.details, // { feature, reason, trialExpired, daysRemaining }
      });
      return;
    }

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
