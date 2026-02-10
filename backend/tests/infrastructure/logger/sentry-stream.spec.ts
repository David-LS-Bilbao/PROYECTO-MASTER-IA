/**
 * SentryStream Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SentryStream } from '../../../src/infrastructure/logger/sentry-stream';

// ============================================================================
// MOCKS (hoisted)
// ============================================================================

const { mockAddBreadcrumb } = vi.hoisted(() => ({
  mockAddBreadcrumb: vi.fn(),
}));

vi.mock('../../../src/infrastructure/monitoring/sentry', () => ({
  addBreadcrumb: mockAddBreadcrumb,
}));

// ============================================================================
// HELPERS
// ============================================================================

function writeAsync(stream: SentryStream, chunk: any): Promise<void> {
  return new Promise((resolve) => {
    (stream as any)._write(chunk, 'utf8', () => resolve());
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('SentryStream', () => {
  let stream: SentryStream;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    stream = new SentryStream();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  it('mapea niveles y agrega breadcrumb con contexto', async () => {
    const log = {
      level: 30,
      msg: 'Hello',
      module: 'test-module',
      userId: 'user-1',
      req: { method: 'GET', url: '/api', remoteAddress: '1.2.3.4' },
      res: { statusCode: 200 },
      customField: 'value',
    };

    await writeAsync(stream, log);

    expect(mockAddBreadcrumb).toHaveBeenCalledTimes(1);
    const [message, level, data] = mockAddBreadcrumb.mock.calls[0];
    expect(message).toBe('Hello');
    expect(level).toBe('info');
    expect(data).toEqual(
      expect.objectContaining({
        module: 'test-module',
        userId: 'user-1',
        method: 'GET',
        url: '/api',
        statusCode: 200,
        remoteAddress: '1.2.3.4',
        customField: 'value',
      })
    );
  });

  it('acepta logs en string JSON', async () => {
    const log = { level: 40, msg: 'Warn log' };

    await writeAsync(stream, JSON.stringify(log));

    expect(mockAddBreadcrumb).toHaveBeenCalledTimes(1);
    const [, level] = mockAddBreadcrumb.mock.calls[0];
    expect(level).toBe('warning');
  });

  it('omite logs de health', async () => {
    const log = { level: 30, msg: 'health', req: { url: '/health/check' } };

    await writeAsync(stream, log);

    expect(mockAddBreadcrumb).not.toHaveBeenCalled();
  });

  it('omite trace en production', async () => {
    process.env.NODE_ENV = 'production';
    const log = { level: 10, msg: 'trace' };

    await writeAsync(stream, log);

    expect(mockAddBreadcrumb).not.toHaveBeenCalled();
  });

  it('maneja errores sin romper el stream', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await writeAsync(stream, '{invalid-json');

    expect(errorSpy).toHaveBeenCalled();
    expect(mockAddBreadcrumb).not.toHaveBeenCalled();
  });
});
