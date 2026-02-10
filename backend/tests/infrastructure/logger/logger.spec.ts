/**
 * Logger Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const buildPinoMock = () => {
  const pinoMock: any = vi.fn(() => ({ child: vi.fn() }));
  pinoMock.transport = vi.fn(() => ({ transport: true }));
  pinoMock.multistream = vi.fn(() => ({ multistream: true }));
  pinoMock.stdSerializers = { err: vi.fn() };
  return pinoMock;
};

describe('logger', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unmock('pino');
    vi.unmock('../../../src/infrastructure/logger/sentry-stream');
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unmock('pino');
    vi.unmock('../../../src/infrastructure/logger/sentry-stream');
  });

  it('usa logger simple con pino-pretty en desarrollo sin Sentry', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SENTRY_DSN;

    const pinoMock = buildPinoMock();
    vi.doMock('pino', () => ({ default: pinoMock }));
    vi.doMock('../../../src/infrastructure/logger/sentry-stream', () => ({
      createSentryStream: vi.fn(() => ({ sentry: true })),
    }));

    const mod = await import('../../../src/infrastructure/logger/logger');

    expect(pinoMock).toHaveBeenCalled();
    const config = pinoMock.mock.calls[0][0];
    expect(config.transport).toBeDefined();
    expect(mod.logger).toBeDefined();
  });

  it('usa multistream cuando Sentry esta habilitado en produccion', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SENTRY_DSN = 'dsn';

    const pinoMock = buildPinoMock();
    const createSentryStream = vi.fn(() => ({ sentry: true }));

    vi.doMock('pino', () => ({ default: pinoMock }));
    vi.doMock('../../../src/infrastructure/logger/sentry-stream', () => ({
      createSentryStream,
    }));

    const mod = await import('../../../src/infrastructure/logger/logger');

    expect(createSentryStream).toHaveBeenCalled();
    expect(pinoMock.multistream).toHaveBeenCalled();
    expect(mod.logger).toBeDefined();
  });

  it('createModuleLogger usa child con contexto', async () => {
    process.env.NODE_ENV = 'test';
    const pinoMock = buildPinoMock();
    const childMock = vi.fn();
    pinoMock.mockImplementation(() => ({ child: childMock }));

    vi.doMock('pino', () => ({ default: pinoMock }));
    vi.doMock('../../../src/infrastructure/logger/sentry-stream', () => ({
      createSentryStream: vi.fn(() => ({ sentry: true })),
    }));

    const mod = await import('../../../src/infrastructure/logger/logger');
    mod.createModuleLogger('module-x');

    expect(childMock).toHaveBeenCalledWith({ module: 'module-x' });
  });
});
