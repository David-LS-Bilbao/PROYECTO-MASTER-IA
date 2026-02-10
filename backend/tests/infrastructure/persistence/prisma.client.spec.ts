/**
 * Prisma Client Singleton Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// TESTS
// ============================================================================

describe('prisma.client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.SENTRY_DSN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('crea una sola instancia cuando no existe y reutiliza la misma', async () => {
    let created = 0;
    let lastInstance: any;
    class PrismaClientMock {
      $disconnect = vi.fn();
      constructor() {
        created += 1;
        lastInstance = this;
      }
    }
    class PrismaPgMock {}

    vi.doMock('@prisma/client', () => ({ PrismaClient: PrismaClientMock }));
    vi.doMock('@prisma/adapter-pg', () => ({ PrismaPg: PrismaPgMock }));

    const { getPrismaClient, closePrismaClient } = await import('../../../src/infrastructure/persistence/prisma.client');

    const first = getPrismaClient();
    const second = getPrismaClient();

    expect(created).toBe(1);
    expect(second).toBe(first);

    await closePrismaClient();
    expect(lastInstance.$disconnect).toHaveBeenCalled();
  });

  it('registra tracing cuando SENTRY_DSN esta definido', async () => {
    process.env.SENTRY_DSN = 'dsn';
    class PrismaClientMock {
      $disconnect = vi.fn();
    }
    class PrismaPgMock {}
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    vi.doMock('@prisma/client', () => ({ PrismaClient: PrismaClientMock }));
    vi.doMock('@prisma/adapter-pg', () => ({ PrismaPg: PrismaPgMock }));

    const { getPrismaClient } = await import('../../../src/infrastructure/persistence/prisma.client');

    getPrismaClient();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Sentry database tracing enabled')
    );
  });
});
