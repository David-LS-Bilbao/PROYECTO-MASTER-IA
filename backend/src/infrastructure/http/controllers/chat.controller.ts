/**
 * Chat Controller (Infrastructure/Presentation Layer)
 * Handles HTTP requests for article chat conversations
 *
 * Sprint 30: Premium Chat - Endpoints require Premium access
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
   * Sprint 30: Premium gate (plan or entitlement)
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
        entitlements: req.user.entitlements,
      });

      // Validate request body with Zod (Shift Left Security)
      const validatedInput = chatArticleSchema.parse(req.body);
      const requestId = this.resolveRequestId(req);
      const correlationId = this.resolveCorrelationId(req, requestId);

      // Execute use case
      const result = await this.chatArticleUseCase.execute({
        ...validatedInput,
        observabilityContext: {
          requestId,
          correlationId,
          endpoint: `${req.method} ${req.originalUrl}`,
          userId: req.user?.uid,
          entityType: 'article',
          entityId: validatedInput.articleId,
          metadata: {
            messagesCount: validatedInput.messages.length,
          },
        },
      });

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
   * Sprint 30: Premium gate (plan or entitlement)
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
        entitlements: req.user.entitlements,
      });

      // Validate request body with Zod (Shift Left Security)
      const validatedInput = chatGeneralSchema.parse(req.body);
      const requestId = this.resolveRequestId(req);
      const correlationId = this.resolveCorrelationId(req, requestId);

      // Execute use case
      const result = await this.chatGeneralUseCase.execute({
        ...validatedInput,
        observabilityContext: {
          requestId,
          correlationId,
          endpoint: `${req.method} ${req.originalUrl}`,
          userId: req.user?.uid,
          entityType: 'chat_general',
          entityId: req.user?.uid,
          metadata: {
            messagesCount: validatedInput.messages.length,
          },
        },
      });

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
      const premiumRequired = error.details?.reason === 'PREMIUM_REQUIRED';
      const errorCode = premiumRequired ? 'PREMIUM_REQUIRED' : error.errorCode;
      const message = premiumRequired ? 'Solo para usuarios Premium' : error.message;

      res.status(403).json({
        success: false,
        error: premiumRequired ? 'Premium Required' : 'Feature Locked',
        code: errorCode,
        errorCode,
        message,
        errorDetails: {
          code: errorCode,
          message,
        },
        details: error.details,
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

  private resolveRequestId(req: Request): string {
    if (typeof req.id === 'string' && req.id.trim().length > 0) {
      return req.id.trim();
    }

    const headerRequestId = this.getHeaderValue(req, 'x-request-id');
    if (headerRequestId && headerRequestId.trim().length > 0) {
      return headerRequestId.trim();
    }

    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private resolveCorrelationId(req: Request, fallbackRequestId: string): string {
    const headerCorrelationId = this.getHeaderValue(req, 'x-correlation-id');
    if (headerCorrelationId && headerCorrelationId.trim().length > 0) {
      return headerCorrelationId.trim();
    }

    return fallbackRequestId;
  }

  private getHeaderValue(req: Request, headerName: string): string | undefined {
    if (typeof req.header === 'function') {
      return req.header(headerName) ?? undefined;
    }

    const candidate = req.headers?.[headerName] ?? req.headers?.[headerName.toLowerCase()];
    return Array.isArray(candidate) ? candidate[0] : candidate;
  }
}
