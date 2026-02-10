/**
 * SubscriptionController Unit Tests
 * Focus: Promo code redemption flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';

// ============================================================================
// TYPE EXTENSIONS
// ============================================================================

/**
 * Extiende Request para incluir la propiedad user del middleware de autenticación
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email: string;
        name: string | null;
        picture: string | null;
        subscriptionPlan: 'FREE' | 'PREMIUM';
      };
    }
  }
}

// ============================================================================
// MOCKS (hoisted)
// ============================================================================

const { mockUserUpdate } = vi.hoisted(() => ({
  mockUserUpdate: vi.fn(),
}));

vi.mock('../../../../src/infrastructure/persistence/prisma.client', () => ({
  getPrismaClient: () => ({
    user: {
      update: mockUserUpdate,
    },
  }),
}));

import { SubscriptionController } from '../../../../src/infrastructure/http/controllers/subscription.controller';

// ============================================================================
// TEST SUITE
// ============================================================================

describe('SubscriptionController - Redeem Promo Code', () => {
  let controller: SubscriptionController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    controller = new SubscriptionController();
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn(() => ({ json: jsonMock }));

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('401 UNAUTHORIZED: should reject when user is not authenticated', async () => {
    mockReq = {
      body: { code: 'VERITY_TEACHER' },
    };

    await controller.redeemCode(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Usuario no autenticado',
      })
    );
  });

  it('400 BAD REQUEST: should reject invalid promo code', async () => {
    mockReq = {
      body: { code: 'INVALID_CODE' },
      user: { uid: 'user-123' } as any,
    };

    await controller.redeemCode(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid code',
      })
    );
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it('200 OK: should upgrade user plan when promo code is valid', async () => {
    mockUserUpdate.mockResolvedValueOnce({ subscriptionPlan: 'PREMIUM' });

    mockReq = {
      body: { code: 'VERITY_ADMIN' },
      user: { uid: 'user-123' } as any,
    };

    await controller.redeemCode(mockReq as Request, mockRes as Response);

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { subscriptionPlan: 'PREMIUM' },
    });

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        plan: 'PREMIUM',
      })
    );
  });

  it('200 OK: should downgrade to FREE when canceling subscription', async () => {
    mockUserUpdate.mockResolvedValueOnce({ subscriptionPlan: 'FREE' });

    mockReq = {
      user: { uid: 'user-123' } as any,
    };

    await controller.cancelSubscription(mockReq as Request, mockRes as Response);

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { subscriptionPlan: 'FREE' },
    });

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        plan: 'FREE',
      })
    );
  });
});
