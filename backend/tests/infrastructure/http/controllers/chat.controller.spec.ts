/**
 * ChatController Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { ChatController } from '../../../../src/infrastructure/http/controllers/chat.controller';
import { ValidationError, EntityNotFoundError, FeatureLockedError } from '../../../../src/domain/errors/domain.error';
import { ExternalAPIError, DatabaseError, InfrastructureError } from '../../../../src/domain/errors/infrastructure.error';

// ============================================================================
// MOCKS (hoisted)
// ============================================================================

const { mockIncrementChatMessages } = vi.hoisted(() => ({
  mockIncrementChatMessages: vi.fn(),
}));

vi.mock('../../../../src/infrastructure/monitoring/user-stats-tracker', () => ({
  UserStatsTracker: {
    incrementChatMessages: mockIncrementChatMessages,
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

function createRes() {
  const jsonMock = vi.fn();
  const statusMock = vi.fn(() => ({ json: jsonMock }));
  const res = {
    status: statusMock as any,
    json: jsonMock as any,
  } as Partial<Response>;
  return { res, jsonMock, statusMock };
}

const validArticleBody = {
  articleId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  messages: [{ role: 'user', content: 'Hola' }],
};

const validGeneralBody = {
  messages: [{ role: 'user', content: 'Hola general' }],
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe('ChatController', () => {
  let controller: ChatController;
  let chatArticleUseCase: { execute: ReturnType<typeof vi.fn> };
  let chatGeneralUseCase: { execute: ReturnType<typeof vi.fn> };
  let quotaService: { canAccessChat: ReturnType<typeof vi.fn> };
  const authUser = {
    uid: 'user-1',
    subscriptionPlan: 'PREMIUM' as const,
    entitlements: { deepAnalysis: true },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIncrementChatMessages.mockResolvedValue(undefined);
    chatArticleUseCase = { execute: vi.fn() };
    chatGeneralUseCase = { execute: vi.fn() };
    quotaService = { canAccessChat: vi.fn() };
    controller = new ChatController(chatArticleUseCase as any, chatGeneralUseCase as any, quotaService as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('chatWithArticle', () => {
    it('200 en flujo exitoso', async () => {
      const { res, statusMock, jsonMock } = createRes();
      const req = { body: validArticleBody, user: authUser } as Request;

      chatArticleUseCase.execute.mockResolvedValueOnce({
        articleId: validArticleBody.articleId,
        articleTitle: 'Article Title',
        response: 'Answer',
      });

      await controller.chatWithArticle(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(quotaService.canAccessChat).toHaveBeenCalledWith({
        id: 'user-1',
        subscriptionPlan: 'PREMIUM',
        entitlements: { deepAnalysis: true },
      });
      expect(mockIncrementChatMessages).toHaveBeenCalledWith('user-1', 1);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            articleId: validArticleBody.articleId,
          }),
        })
      );
    });

    it('400 si ZodError', async () => {
      const { res, statusMock } = createRes();
      const req = { body: { messages: [] }, user: authUser } as Request;

      await controller.chatWithArticle(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('404 si EntityNotFoundError', async () => {
      const { res, statusMock } = createRes();
      const req = { body: validArticleBody, user: authUser } as Request;

      chatArticleUseCase.execute.mockRejectedValueOnce(new EntityNotFoundError('Article', 'id'));

      await controller.chatWithArticle(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('400 si ValidationError', async () => {
      const { res, statusMock } = createRes();
      const req = { body: validArticleBody, user: authUser } as Request;

      chatArticleUseCase.execute.mockRejectedValueOnce(new ValidationError('Invalid'));

      await controller.chatWithArticle(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('statusCode de ExternalAPIError', async () => {
      const { res, statusMock } = createRes();
      const req = { body: validArticleBody, user: authUser } as Request;

      chatArticleUseCase.execute.mockRejectedValueOnce(new ExternalAPIError('Gemini', 'Down', 503));

      await controller.chatWithArticle(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(503);
    });

    it('500 si DatabaseError', async () => {
      const { res, statusMock } = createRes();
      const req = { body: validArticleBody, user: authUser } as Request;

      chatArticleUseCase.execute.mockRejectedValueOnce(new DatabaseError('DB error'));

      await controller.chatWithArticle(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it('500 si InfrastructureError', async () => {
      const { res, statusMock } = createRes();
      const req = { body: validArticleBody, user: authUser } as Request;

      chatArticleUseCase.execute.mockRejectedValueOnce(new InfrastructureError('Infra error'));

      await controller.chatWithArticle(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it('403 PREMIUM_REQUIRED para FREE sin acceso premium', async () => {
      const { res, statusMock, jsonMock } = createRes();
      const req = {
        body: validArticleBody,
        user: {
          uid: 'free-user',
          subscriptionPlan: 'FREE',
          entitlements: { deepAnalysis: false },
        },
      } as Request;

      quotaService.canAccessChat.mockImplementationOnce(() => {
        throw new FeatureLockedError('Chat', 'Solo para usuarios Premium', {
          reason: 'PREMIUM_REQUIRED',
        });
      });

      await controller.chatWithArticle(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(chatArticleUseCase.execute).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PREMIUM_REQUIRED',
          errorCode: 'PREMIUM_REQUIRED',
          message: 'Solo para usuarios Premium',
        })
      );
    });
  });

  describe('chatGeneral', () => {
    it('200 en flujo exitoso', async () => {
      const { res, statusMock, jsonMock } = createRes();
      const req = { body: validGeneralBody, user: authUser } as Request;

      chatGeneralUseCase.execute.mockResolvedValueOnce({
        response: 'General answer',
        sourcesCount: 2,
      });

      await controller.chatGeneral(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(mockIncrementChatMessages).toHaveBeenCalledWith('user-1', 1);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ response: 'General answer' }),
        })
      );
    });

    it('400 si ZodError', async () => {
      const { res, statusMock } = createRes();
      const req = { body: { messages: [] }, user: authUser } as Request;

      await controller.chatGeneral(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('200 para FREE con entitlement deepAnalysis', async () => {
      const { res, statusMock } = createRes();
      const req = {
        body: validGeneralBody,
        user: {
          uid: 'free-entitled',
          subscriptionPlan: 'FREE',
          entitlements: { deepAnalysis: true },
        },
      } as Request;

      chatGeneralUseCase.execute.mockResolvedValueOnce({
        response: 'General answer',
      });

      await controller.chatGeneral(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(quotaService.canAccessChat).toHaveBeenCalledWith({
        id: 'free-entitled',
        subscriptionPlan: 'FREE',
        entitlements: { deepAnalysis: true },
      });
    });
  });
});



