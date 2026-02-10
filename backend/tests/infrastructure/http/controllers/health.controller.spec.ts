/**
 * HealthController Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { HealthController } from '../../../../src/infrastructure/http/controllers/health.controller';

function createRes() {
  const jsonMock = vi.fn();
  const statusMock = vi.fn(() => ({ json: jsonMock }));
  const res = {
    status: statusMock as any,
    json: jsonMock as any,
  } as Partial<Response>;
  return { res, jsonMock, statusMock };
}

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = { $queryRaw: vi.fn() };
    controller = new HealthController(prisma as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('check responde 200', async () => {
    const { res, statusMock } = createRes();

    await controller.check({} as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it('readiness responde 200 si DB ok', async () => {
    const { res, statusMock, jsonMock } = createRes();
    prisma.$queryRaw.mockResolvedValueOnce(1 as any);

    await controller.readiness({} as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ database: 'connected' })
    );
  });

  it('readiness responde 503 si DB falla', async () => {
    const { res, statusMock, jsonMock } = createRes();
    prisma.$queryRaw.mockRejectedValueOnce(new Error('DB down'));

    await controller.readiness({} as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(503);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ database: 'disconnected', error: 'DB down' })
    );
  });

  it('readiness usa mensaje default si error no es Error', async () => {
    const { res, statusMock, jsonMock } = createRes();
    prisma.$queryRaw.mockRejectedValueOnce('boom');

    await controller.readiness({} as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(503);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Unknown error' })
    );
  });
});
