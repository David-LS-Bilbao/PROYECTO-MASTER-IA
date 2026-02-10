/**
 * Rate Limit Middleware Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type MockMiddleware = ((req: any, res: any, next?: any) => any) & { __options?: any };

const buildRateLimitMock = () => {
  return vi.fn((options: any) => {
    const middleware: MockMiddleware = ((req: any, res: any, next?: any) => {
      if (options.handler) {
        return options.handler(req, res, next);
      }
      return next?.();
    }) as MockMiddleware;
    middleware.__options = options;
    return middleware;
  });
};

describe('rate-limit.middleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unmock('express-rate-limit');
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unmock('express-rate-limit');
  });

  it('configura limites de desarrollo y ejecuta handler global', async () => {
    process.env.NODE_ENV = 'development';
    const rateLimitMock = buildRateLimitMock();
    vi.doMock('express-rate-limit', () => ({ default: rateLimitMock }));

    const mod = await import('../../../../src/infrastructure/http/middleware/rate-limit.middleware');
    const globalLimiter = mod.globalIngestRateLimiter as MockMiddleware;

    expect(rateLimitMock).toHaveBeenCalledTimes(3);
    expect(globalLimiter.__options.max).toBe(100);
    expect(globalLimiter.__options.windowMs).toBe(60 * 60 * 1000);

    const req = { ip: '1.1.1.1', method: 'POST', originalUrl: '/api/ingest/all' };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await globalLimiter(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Too many global refresh requests from this IP, please try again in an hour.',
      hint: 'Use category-specific ingestion (/api/ingest/news) for frequent updates.',
      retryAfter: '1 hour',
      details: {
        limit: 100,
        windowMs: 60 * 60 * 1000,
      },
    });
  });

  it('configura limites de produccion para global y categoria', async () => {
    process.env.NODE_ENV = 'production';
    const rateLimitMock = buildRateLimitMock();
    vi.doMock('express-rate-limit', () => ({ default: rateLimitMock }));

    const mod = await import('../../../../src/infrastructure/http/middleware/rate-limit.middleware');
    const globalLimiter = mod.globalIngestRateLimiter as MockMiddleware;
    const categoryLimiter = mod.categoryIngestRateLimiter as MockMiddleware;

    expect(globalLimiter.__options.max).toBe(5);
    expect(categoryLimiter.__options.max).toBe(30);

    const req = { ip: '2.2.2.2', method: 'POST', originalUrl: '/api/ingest/news' };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await categoryLimiter(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Too many ingestion requests from this IP, please try again in 15 minutes.',
      details: {
        limit: 30,
        windowMs: 15 * 60 * 1000,
      },
    });
  });

  it('configura limites para status check sin handler custom', async () => {
    process.env.NODE_ENV = 'development';
    const rateLimitMock = buildRateLimitMock();
    vi.doMock('express-rate-limit', () => ({ default: rateLimitMock }));

    const mod = await import('../../../../src/infrastructure/http/middleware/rate-limit.middleware');
    const statusLimiter = mod.statusCheckRateLimiter as MockMiddleware;

    expect(statusLimiter.__options.max).toBe(60);
    expect(statusLimiter.__options.windowMs).toBe(60 * 1000);
    expect(statusLimiter.__options.handler).toBeUndefined();
  });
});
