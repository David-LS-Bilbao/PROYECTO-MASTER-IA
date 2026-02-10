/**
 * Health Routes Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import type { Router } from 'express';

describe('health.routes', () => {
  const getRouteHandler = (router: Router, path: string) => {
    const layer = (router as any).stack.find((item: any) => item.route?.path === path);
    return layer?.route?.stack?.[0]?.handle;
  };

  it('registra rutas de check y readiness', async () => {
    const healthController = {
      check: vi.fn(),
      readiness: vi.fn(),
    };

    const mod = await import('../../../../src/infrastructure/http/routes/health.routes');
    const router = mod.createHealthRoutes(healthController as any);

    const checkHandler = getRouteHandler(router, '/check');
    const readinessHandler = getRouteHandler(router, '/readiness');

    const req = {} as any;
    const res = {} as any;

    checkHandler(req, res);
    readinessHandler(req, res);

    expect(healthController.check).toHaveBeenCalledWith(req, res);
    expect(healthController.readiness).toHaveBeenCalledWith(req, res);
  });

  it('ejecuta handler de test-sentry-breadcrumbs y propaga error', async () => {
    const mod = await import('../../../../src/infrastructure/http/routes/health.routes');
    const { logger } = await import('../../../../src/infrastructure/logger/logger');

    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const router = mod.createHealthRoutes({} as any);
    const handler = getRouteHandler(router, '/test-sentry-breadcrumbs');

    const next = vi.fn();

    handler({}, {}, next);

    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
