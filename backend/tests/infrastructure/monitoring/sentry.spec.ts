/**
 * Sentry Monitoring Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
  httpIntegration: vi.fn(() => 'http-integration'),
}));

vi.mock('@sentry/profiling-node', () => ({
  nodeProfilingIntegration: vi.fn(() => 'profiling-integration'),
}));

describe('sentry monitoring', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('no inicializa si falta SENTRY_DSN', async () => {
    delete process.env.SENTRY_DSN;
    process.env.NODE_ENV = 'production';

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await import('../../../src/infrastructure/monitoring/sentry');
    const sentry = await import('@sentry/node');

    mod.initSentry();

    expect(warnSpy).toHaveBeenCalled();
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('inicializa con config de produccion y filtra errores 401/403/404', async () => {
    process.env.SENTRY_DSN = 'dsn';
    process.env.NODE_ENV = 'production';
    process.env.SENTRY_TRACES_SAMPLE_RATE = '0.2';
    process.env.SENTRY_PROFILES_SAMPLE_RATE = '0.3';
    process.env.RELEASE_VERSION = '1.2.3';

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mod = await import('../../../src/infrastructure/monitoring/sentry');
    const sentry = await import('@sentry/node');

    mod.initSentry();

    expect(sentry.init).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();

    const config = (sentry.init as any).mock.calls[0][0];
    expect(config.dsn).toBe('dsn');
    expect(config.tracesSampleRate).toBe(0.2);
    expect(config.profilesSampleRate).toBe(0.3);
    expect(config.release).toBe('1.2.3');
    expect(config.integrations).toEqual(['profiling-integration', 'http-integration']);

    const event = { exception: { values: [] } };
    const blocked = config.beforeSend(event, { originalException: new Error('401 Unauthorized') });
    const allowed = config.beforeSend(event, { originalException: new Error('500 Boom') });

    expect(blocked).toBeNull();
    expect(allowed).toBe(event);
  });

  it('helpers llaman a Sentry con contexto', async () => {
    process.env.SENTRY_DSN = 'dsn';
    const mod = await import('../../../src/infrastructure/monitoring/sentry');
    const sentry = await import('@sentry/node');

    mod.captureException(new Error('boom'), {
      userId: 'u1',
      endpoint: '/api/test',
      method: 'GET',
      tags: { feature: 'test' },
      extra: { a: 1 },
    });

    expect(sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { source: 'backend', feature: 'test' },
      user: { id: 'u1' },
      contexts: { http: { url: '/api/test', method: 'GET' } },
      extra: { a: 1 },
    });

    mod.addBreadcrumb('hello', 'warning', { x: 1 });
    expect(sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({
      message: 'hello',
      level: 'warning',
      data: { x: 1 },
    }));

    mod.setUserContext('u2', 'u2@test.com', 'User 2');
    expect(sentry.setUser).toHaveBeenCalledWith({
      id: 'u2',
      email: 'u2@test.com',
      username: 'User 2',
    });

    mod.clearUserContext();
    expect(sentry.setUser).toHaveBeenCalledWith(null);
  });
});
