/**
 * PrismaTopicRepository Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaTopicRepository } from '../../../src/infrastructure/persistence/prisma-topic.repository';
import { DatabaseError } from '../../../src/domain/errors/infrastructure.error';

// ============================================================================
// TESTS
// ============================================================================

describe('PrismaTopicRepository', () => {
  let prisma: any;
  let repository: PrismaTopicRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      topic: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
    };
    repository = new PrismaTopicRepository(prisma as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('findAll retorna temas mapeados', async () => {
    prisma.topic.findMany.mockResolvedValueOnce([
      {
        id: 't1',
        name: 'General',
        slug: 'general',
        description: 'Desc',
        order: 1,
        createdAt: new Date('2026-02-01T10:00:00Z'),
      },
    ]);

    const result = await repository.findAll();

    expect(result).toEqual([
      expect.objectContaining({ id: 't1', slug: 'general' }),
    ]);
  });

  it('findAll lanza DatabaseError si falla', async () => {
    prisma.topic.findMany.mockRejectedValueOnce(new Error('DB error'));

    await expect(repository.findAll()).rejects.toBeInstanceOf(DatabaseError);
  });

  it('findBySlug retorna null si no existe', async () => {
    prisma.topic.findUnique.mockResolvedValueOnce(null);

    const result = await repository.findBySlug('general');

    expect(result).toBeNull();
  });

  it('findBySlug retorna tema mapeado', async () => {
    prisma.topic.findUnique.mockResolvedValueOnce({
      id: 't1',
      name: 'General',
      slug: 'general',
      description: 'Desc',
      order: 1,
      createdAt: new Date('2026-02-01T10:00:00Z'),
    });

    const result = await repository.findBySlug('general');

    expect(result).toEqual(expect.objectContaining({ id: 't1', slug: 'general' }));
  });

  it('findBySlug lanza DatabaseError si falla', async () => {
    prisma.topic.findUnique.mockRejectedValueOnce(new Error('DB error'));

    await expect(repository.findBySlug('general')).rejects.toBeInstanceOf(DatabaseError);
  });
});
