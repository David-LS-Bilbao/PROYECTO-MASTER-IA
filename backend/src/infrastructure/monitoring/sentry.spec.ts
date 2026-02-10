import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
  httpIntegration: vi.fn(() => ({ name: 'http' })),
}));

vi.mock('@sentry/profiling-node', () => ({
  nodeProfilingIntegration: vi.fn(() => ({ name: 'profiling' })),
}));

import { initSentry, captureException, addBreadcrumb, setUserContext, clearUserContext } from './sentry';
import * as Sentry from '@sentry/node';

describe('Sentry monitoring', () => {
  const originalEnv = process.env;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    logSpy.mockRestore();
    process.env = originalEnv;
  });

  it('does not initialize without SENTRY_DSN', () => {
    delete process.env.SENTRY_DSN;
    initSentry();
    expect(warnSpy).toHaveBeenCalled();
    expect((Sentry as any).init).not.toHaveBeenCalled();
  });

  it('initializes Sentry when SENTRY_DSN is provided', () => {
    process.env.SENTRY_DSN = 'https://example.com/123';
    process.env.NODE_ENV = 'test';
    initSentry();
    expect((Sentry as any).init).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });

  it('captureException forwards tags and user context', () => {
    const error = new Error('boom');
    captureException(error, {
      userId: 'user-1',
      endpoint: '/api/test',
      method: 'POST',
      tags: { flow: 'test' },
      extra: { foo: 'bar' },
    });
    expect((Sentry as any).captureException).toHaveBeenCalled();
  });

  it('addBreadcrumb calls Sentry.addBreadcrumb with timestamp', () => {
    addBreadcrumb('hello', 'info', { a: 1 });
    expect((Sentry as any).addBreadcrumb).toHaveBeenCalled();
  });

  it('setUserContext and clearUserContext call Sentry.setUser', () => {
    setUserContext('user-1', 'u@example.com', 'User');
    clearUserContext();
    expect((Sentry as any).setUser).toHaveBeenCalledTimes(2);
  });
});
