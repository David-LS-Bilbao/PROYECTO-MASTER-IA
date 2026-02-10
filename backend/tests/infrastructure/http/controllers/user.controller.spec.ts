/**
 * UserController Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';

// ============================================================================
// TYPE EXTENSIONS
// ============================================================================

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        name?: string | null;
        picture?: string | null;
        subscriptionPlan?: 'FREE' | 'PREMIUM';
        usageStats?: {
          currentMonthUsage: number;
        };
      };
    }
  }
}

// ============================================================================
// MOCKS (hoisted)
// ============================================================================

const { mockFindUnique, mockUpdate } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('../../../../src/infrastructure/persistence/prisma.client', () => ({
  getPrismaClient: () => ({
    user: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  }),
}));

import { UserController } from '../../../../src/infrastructure/http/controllers/user.controller';

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

function createUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'user@test.com',
    name: 'Test User',
    picture: null,
    subscriptionPlan: 'FREE',
    location: 'Madrid',
    preferences: { theme: 'dark' },
    usageStats: { articlesAnalyzed: 1, searchesPerformed: 2, chatMessages: 3 },
    _count: { favorites: 1, searchHistory: 2, chats: 3 },
    createdAt: new Date('2026-02-01T10:00:00Z'),
    updatedAt: new Date('2026-02-02T10:00:00Z'),
    ...overrides,
  };
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('UserController', () => {
  let controller: UserController;
  let geminiClient: { getSessionCostReport: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    geminiClient = {
      getSessionCostReport: vi.fn(),
    };
    controller = new UserController(geminiClient as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getProfile', () => {
    it('401 si no hay usuario autenticado', async () => {
      const { res, statusMock } = createRes();
      const req = {} as Request;

      await controller.getProfile(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('404 si el usuario no existe', async () => {
      const { res, statusMock } = createRes();
      const req = { user: { uid: 'user-1' } } as Request;

      mockFindUnique.mockResolvedValueOnce(null);

      await controller.getProfile(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('200 y retorna perfil completo', async () => {
      const { res, jsonMock } = createRes();
      const req = { user: { uid: 'user-1' } } as Request;

      mockFindUnique.mockResolvedValueOnce(createUser());

      await controller.getProfile(req, res as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'user-1',
            plan: 'FREE',
            counts: { favorites: 1, searchHistory: 2, chats: 3 },
          }),
        })
      );
    });

    it('500 si ocurre un error inesperado', async () => {
      const { res, statusMock } = createRes();
      const req = { user: { uid: 'user-1' } } as Request;

      mockFindUnique.mockRejectedValueOnce(new Error('DB error'));

      await controller.getProfile(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('updateProfile', () => {
    it('401 si no hay usuario autenticado', async () => {
      const { res, statusMock } = createRes();
      const req = { body: { name: 'New Name' } } as Request;

      await controller.updateProfile(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('400 si no hay campos para actualizar', async () => {
      const { res, statusMock } = createRes();
      const req = { user: { uid: 'user-1' }, body: {} } as Request;

      await controller.updateProfile(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('200 si actualiza correctamente', async () => {
      const { res, jsonMock } = createRes();
      const req = { user: { uid: 'user-1' }, body: { name: 'Nuevo', location: 'Valencia' } } as Request;

      mockUpdate.mockResolvedValueOnce(createUser({ name: 'Nuevo', location: 'Valencia' }));

      await controller.updateProfile(req, res as Response);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { name: 'Nuevo', location: 'Valencia' },
        })
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            name: 'Nuevo',
            location: 'Valencia',
          }),
        })
      );
    });

    it('500 si ocurre un error inesperado', async () => {
      const { res, statusMock } = createRes();
      const req = { user: { uid: 'user-1' }, body: { name: 'Nuevo' } } as Request;

      mockUpdate.mockRejectedValueOnce(new Error('DB error'));

      await controller.updateProfile(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('getTokenUsage', () => {
    it('401 si no hay usuario autenticado', async () => {
      const { res, statusMock } = createRes();
      const req = {} as Request;

      await controller.getTokenUsage(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('200 si devuelve reporte de sesion', async () => {
      const { res, jsonMock } = createRes();
      const req = { user: { uid: 'user-1' } } as Request;

      geminiClient.getSessionCostReport.mockReturnValueOnce({ totalTokens: 123 });

      await controller.getTokenUsage(req, res as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            session: { totalTokens: 123 },
          }),
        })
      );
    });

    it('500 si ocurre un error inesperado', async () => {
      const { res, statusMock } = createRes();
      const req = { user: { uid: 'user-1' } } as Request;

      geminiClient.getSessionCostReport.mockImplementationOnce(() => {
        throw new Error('Gemini error');
      });

      await controller.getTokenUsage(req, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });
});
