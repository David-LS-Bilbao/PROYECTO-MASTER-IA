/**
 * EntitlementsController Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { EntitlementsController } from '../../../../src/infrastructure/http/controllers/entitlements.controller';

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

function createRes() {
  const jsonMock = vi.fn();
  const statusMock = vi.fn(() => ({ json: jsonMock }));
  const setHeaderMock = vi.fn();
  const res = {
    status: statusMock as any,
    json: jsonMock as any,
    setHeader: setHeaderMock as any,
  } as Partial<Response>;

  return { res, jsonMock, statusMock, setHeaderMock };
}

describe('EntitlementsController', () => {
  let controller: EntitlementsController;
  const originalPromoCodes = process.env.PROMO_CODES;

  beforeEach(() => {
    controller = new EntitlementsController();
    vi.clearAllMocks();
    process.env.PROMO_CODES = 'VERITY_DEEP,MASTER_AI_2026';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalPromoCodes === undefined) {
      delete process.env.PROMO_CODES;
      return;
    }
    process.env.PROMO_CODES = originalPromoCodes;
  });

  it('GET /api/entitlements devuelve entitlements del usuario autenticado', async () => {
    const { res, jsonMock, statusMock } = createRes();
    const req = {
      user: {
        uid: 'user-1',
        entitlements: {
          deepAnalysis: true,
        },
      },
    } as Request;

    await controller.getEntitlements(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: {
          entitlements: {
            deepAnalysis: true,
          },
        },
      })
    );
  });

  it('POST /api/entitlements/redeem activa deepAnalysis con codigo valido', async () => {
    const { res, jsonMock, statusMock } = createRes();
    const req = {
      body: { code: 'verity_deep' },
      user: {
        uid: 'user-1',
        preferences: {
          theme: 'dark',
          categories: ['politica'],
          entitlements: {
            deepAnalysis: false,
          },
        },
      },
    } as Request;

    mockUserUpdate.mockResolvedValueOnce({});

    await controller.redeemCode(req, res as Response);

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        preferences: expect.objectContaining({
          entitlements: {
            deepAnalysis: true,
          },
        }),
      }),
    });

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: {
          entitlements: {
            deepAnalysis: true,
          },
        },
      })
    );
  });

  it('POST /api/entitlements/redeem responde 400 con codigo invalido', async () => {
    const { res, jsonMock, statusMock } = createRes();
    const req = {
      body: { code: 'INVALID' },
      user: {
        uid: 'user-1',
        preferences: {},
      },
    } as Request;

    await controller.redeemCode(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Invalid code',
      })
    );
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});
