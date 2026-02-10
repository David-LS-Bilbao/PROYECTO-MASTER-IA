/**
 * PrismaNewsArticleRepository Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaNewsArticleRepository } from '../../../src/infrastructure/persistence/prisma-news-article.repository';
import { NewsArticle } from '../../../src/domain/entities/news-article.entity';
import { DatabaseError } from '../../../src/domain/errors/infrastructure.error';

// ============================================================================
// HELPERS
// ============================================================================

const baseDate = new Date('2026-01-01T00:00:00Z');

function makePrismaArticle(overrides: Partial<any> = {}) {
  return {
    id: 'a1',
    title: 'Titulo',
    description: 'Desc',
    content: 'Contenido',
    url: 'https://example.com/a1',
    urlToImage: null,
    source: 'SourceA',
    author: null,
    publishedAt: baseDate,
    category: 'general',
    topicId: null,
    language: 'es',
    embedding: null,
    summary: null,
    biasScore: null,
    analysis: null,
    analyzedAt: null,
    internalReasoning: null,
    isFavorite: false,
    fetchedAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

function makeDomainArticle(overrides: Partial<any> = {}) {
  return NewsArticle.reconstitute({
    ...makePrismaArticle(),
    isFavorite: false,
    ...overrides,
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('PrismaNewsArticleRepository', () => {
  let prisma: any;
  let repository: PrismaNewsArticleRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      article: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      favorite: {
        findUnique: vi.fn(),
        delete: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    repository = new PrismaNewsArticleRepository(prisma as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saveMany retorna si no hay articulos', async () => {
    await repository.saveMany([]);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.article.upsert).not.toHaveBeenCalled();
  });

  it('saveMany ejecuta upserts dentro de transaccion', async () => {
    const txUpsert = vi.fn();
    prisma.$transaction.mockImplementation(async (cb: any) => cb({ article: { upsert: txUpsert } }));

    await repository.saveMany([
      makeDomainArticle({ id: 'a1', url: 'https://example.com/a1' }),
      makeDomainArticle({ id: 'a2', url: 'https://example.com/a2' }),
    ]);

    expect(txUpsert).toHaveBeenCalledTimes(2);
  });

  it('findById retorna null si no existe', async () => {
    prisma.article.findUnique.mockResolvedValueOnce(null);

    const result = await repository.findById('a1');

    expect(result).toBeNull();
  });

  it('findById retorna entidad si existe', async () => {
    prisma.article.findUnique.mockResolvedValueOnce(makePrismaArticle({ id: 'a1' }));

    const result = await repository.findById('a1');

    expect(result?.id).toBe('a1');
  });

  it('findByUrl retorna null si no existe', async () => {
    prisma.article.findUnique.mockResolvedValueOnce(null);

    const result = await repository.findByUrl('https://example.com/a1');

    expect(result).toBeNull();
  });

  it('findByUrl retorna entidad si existe', async () => {
    prisma.article.findUnique.mockResolvedValueOnce(makePrismaArticle({ id: 'a1', url: 'https://example.com/a1' }));

    const result = await repository.findByUrl('https://example.com/a1');

    expect(result?.id).toBe('a1');
  });

  it('existsByUrl retorna true si count > 0', async () => {
    prisma.article.count.mockResolvedValueOnce(1);

    const result = await repository.existsByUrl('https://example.com/a1');

    expect(result).toBe(true);
  });

  it('existsByUrl retorna false si count = 0', async () => {
    prisma.article.count.mockResolvedValueOnce(0);

    const result = await repository.existsByUrl('https://example.com/a1');

    expect(result).toBe(false);
  });

  it('countFiltered usa favoritos por usuario cuando aplica', async () => {
    prisma.favorite.count.mockResolvedValueOnce(5);

    const result = await repository.countFiltered({ onlyFavorites: true, userId: 'u1' });

    expect(result).toBe(5);
    expect(prisma.article.count).not.toHaveBeenCalled();
  });

  it('countFiltered usa filtro de categoria cuando no hay favoritos', async () => {
    prisma.article.count.mockResolvedValueOnce(10);

    const result = await repository.countFiltered({ category: 'local', onlyFavorites: true });

    expect(result).toBe(10);
    expect(prisma.article.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      })
    );
  });

  it('findAll delega a favoritos por usuario si aplica', async () => {
    const spy = vi
      .spyOn(repository as any, 'findFavoritesByUser')
      .mockResolvedValueOnce([makeDomainArticle({ id: 'fav1', isFavorite: true })]);

    const result = await repository.findAll({
      limit: 5,
      offset: 0,
      onlyFavorites: true,
      userId: 'u1',
    });

    expect(spy).toHaveBeenCalledWith('u1', 5, 0);
    expect(result[0].id).toBe('fav1');
  });

  it('findAll retorna [] si no hay resultados', async () => {
    prisma.article.findMany.mockResolvedValueOnce([]);

    const result = await repository.findAll({
      limit: 5,
      offset: 0,
      category: 'general',
    });

    expect(result).toEqual([]);
  });

  it('findAll interleavea y marca favoritos false sin usuario', async () => {
    prisma.article.findMany.mockResolvedValueOnce([
      makePrismaArticle({ id: 'a1', source: 'S1' }),
      makePrismaArticle({ id: 'a2', source: 'S1' }),
      makePrismaArticle({ id: 'a3', source: 'S2' }),
    ]);

    const result = await repository.findAll({
      limit: 2,
      offset: 0,
    });

    expect(result).toHaveLength(2);
    expect(result.every(article => article.isFavorite === false)).toBe(true);
  });

  it('findAll enriquece favoritos cuando hay usuario', async () => {
    prisma.article.findMany.mockResolvedValueOnce([
      makePrismaArticle({ id: 'a1', source: 'S1' }),
      makePrismaArticle({ id: 'a2', source: 'S2' }),
    ]);
    prisma.favorite.findMany.mockResolvedValueOnce([{ articleId: 'a2' }]);

    const result = await repository.findAll({
      limit: 2,
      offset: 0,
      userId: 'u1',
    });

    const fav = result.find(article => article.id === 'a2');
    const nonFav = result.find(article => article.id === 'a1');

    expect(fav?.isFavorite).toBe(true);
    expect(nonFav?.isFavorite).toBe(false);
  });

  it('findByIds retorna [] si ids vacios', async () => {
    const result = await repository.findByIds([]);

    expect(result).toEqual([]);
    expect(prisma.article.findMany).not.toHaveBeenCalled();
  });

  it('findByIds retorna entidades mapeadas', async () => {
    prisma.article.findMany.mockResolvedValueOnce([
      makePrismaArticle({ id: 'a1' }),
      makePrismaArticle({ id: 'a2', url: 'https://example.com/a2' }),
    ]);

    const result = await repository.findByIds(['a1', 'a2']);

    expect(result.map(a => a.id)).toEqual(['a1', 'a2']);
  });

  it('toggleFavorite retorna null si no existe', async () => {
    prisma.article.findUnique.mockResolvedValueOnce(null);

    const result = await repository.toggleFavorite('a1');

    expect(result).toBeNull();
    expect(prisma.article.update).not.toHaveBeenCalled();
  });

  it('toggleFavorite invierte isFavorite cuando existe', async () => {
    prisma.article.findUnique.mockResolvedValueOnce(makePrismaArticle({ id: 'a1', isFavorite: false }));
    prisma.article.update.mockResolvedValueOnce(makePrismaArticle({ id: 'a1', isFavorite: true }));

    const result = await repository.toggleFavorite('a1');

    expect(result?.isFavorite).toBe(true);
    expect(prisma.article.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isFavorite: true, updatedAt: expect.any(Date) }),
      })
    );
  });

  it('toggleFavoriteForUser elimina favorito si ya existe', async () => {
    prisma.favorite.findUnique.mockResolvedValueOnce({ userId: 'u1', articleId: 'a1' });

    const result = await repository.toggleFavoriteForUser('u1', 'a1');

    expect(result).toBe(false);
    expect(prisma.favorite.delete).toHaveBeenCalled();
  });

  it('toggleFavoriteForUser crea favorito si no existe', async () => {
    prisma.favorite.findUnique.mockResolvedValueOnce(null);

    const result = await repository.toggleFavoriteForUser('u1', 'a1');

    expect(result).toBe(true);
    expect(prisma.favorite.create).toHaveBeenCalled();
  });

  it('addFavoriteForUser soporta desbloqueo', async () => {
    await repository.addFavoriteForUser('u1', 'a1', true);
    await repository.addFavoriteForUser('u1', 'a2', false);

    expect(prisma.favorite.upsert).toHaveBeenCalledTimes(2);
  });

  it('getUserFavoriteArticleIds retorna set vacio si no hay ids', async () => {
    const result = await repository.getUserFavoriteArticleIds('u1', []);

    expect(result.size).toBe(0);
    expect(prisma.favorite.findMany).not.toHaveBeenCalled();
  });

  it('getUserFavoriteArticleIds retorna set con ids', async () => {
    prisma.favorite.findMany.mockResolvedValueOnce([{ articleId: 'a1' }, { articleId: 'a2' }]);

    const result = await repository.getUserFavoriteArticleIds('u1', ['a1', 'a2']);

    expect(result.has('a1')).toBe(true);
    expect(result.has('a2')).toBe(true);
  });

  it('getUserUnlockedArticleIds retorna set vacio si no hay ids', async () => {
    const result = await repository.getUserUnlockedArticleIds('u1', []);

    expect(result.size).toBe(0);
    expect(prisma.favorite.findMany).not.toHaveBeenCalled();
  });

  it('getUserUnlockedArticleIds retorna set con ids', async () => {
    prisma.favorite.findMany.mockResolvedValueOnce([{ articleId: 'a1' }]);

    const result = await repository.getUserUnlockedArticleIds('u1', ['a1']);

    expect(result.has('a1')).toBe(true);
  });

  it('findFavoritesByUser marca isFavorite true', async () => {
    prisma.favorite.findMany.mockResolvedValueOnce([
      { article: makePrismaArticle({ id: 'a1', isFavorite: false }) },
    ]);

    const result = await repository.findFavoritesByUser('u1', 10, 0);

    expect(result[0].isFavorite).toBe(true);
  });

  it('getBiasDistribution usa biasScore null como neutral', async () => {
    prisma.article.findMany.mockResolvedValueOnce([
      { biasScore: null },
    ]);

    const result = await repository.getBiasDistribution();

    expect(result).toEqual({ left: 0, neutral: 1, right: 0 });
  });

  it('searchArticles retorna [] si query vacia', async () => {
    const result = await repository.searchArticles('   ', 10);

    expect(result).toEqual([]);
    expect(prisma.article.findMany).not.toHaveBeenCalled();
  });

  it('searchArticles retorna [] si no hay resultados', async () => {
    prisma.article.findMany.mockResolvedValueOnce([]);

    const result = await repository.searchArticles('andalucia lluvia', 5);

    expect(result).toEqual([]);
  });

  it('searchArticles retorna resultados sin usuario', async () => {
    prisma.article.findMany.mockResolvedValueOnce([
      makePrismaArticle({ id: 'a1', title: 'Andalucia' }),
    ]);

    const result = await repository.searchArticles('andalucia', 5);

    expect(result[0].isFavorite).toBe(false);
  });

  it('searchArticles enriquece favoritos cuando hay usuario', async () => {
    prisma.article.findMany.mockResolvedValueOnce([
      makePrismaArticle({ id: 'a1', title: 'Andalucia' }),
    ]);
    prisma.favorite.findMany.mockResolvedValueOnce([{ articleId: 'a1' }]);

    const result = await repository.searchArticles('andalucia', 5, 'u1');

    expect(result[0].isFavorite).toBe(true);
  });

  it('save lanza DatabaseError si falla', async () => {
    prisma.article.upsert.mockRejectedValueOnce(new Error('DB error'));

    await expect(repository.save(makeDomainArticle())).rejects.toBeInstanceOf(DatabaseError);
  });
});
