/**
 * ChromaClient Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChromaClient } from '../../../src/infrastructure/external/chroma.client';
import { ExternalAPIError, ConfigurationError } from '../../../src/domain/errors/infrastructure.error';

// ============================================================================
// MOCKS (hoisted)
// ============================================================================

const { mockGetOrCreateCollection, mockHeartbeat } = vi.hoisted(() => ({
  mockGetOrCreateCollection: vi.fn(),
  mockHeartbeat: vi.fn(),
}));

vi.mock('chromadb', () => {
  class MockChromaSDK {
    getOrCreateCollection = mockGetOrCreateCollection;
    heartbeat = mockHeartbeat;
  }

  return { ChromaClient: MockChromaSDK };
});

// ============================================================================
// TESTS
// ============================================================================

describe('ChromaClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lanza ConfigurationError si URL invalida', () => {
    expect(() => new ChromaClient('not-a-url')).toThrow(ConfigurationError);
  });

  it('initCollection crea coleccion y retorna true', async () => {
    const mockCollection = {
      count: vi.fn().mockResolvedValueOnce(3),
    };
    mockGetOrCreateCollection.mockResolvedValueOnce(mockCollection);

    const client = new ChromaClient('http://localhost:8000');
    const result = await client.initCollection();

    expect(result).toBe(true);
    expect(mockGetOrCreateCollection).toHaveBeenCalledWith({
      name: 'verity-news-articles',
      metadata: { 'hnsw:space': 'cosine' },
    });
    expect(client.getCollection()).toBe(mockCollection);
  });

  it('initCollection lanza ExternalAPIError si falla', async () => {
    mockGetOrCreateCollection.mockRejectedValueOnce(new Error('boom'));

    const client = new ChromaClient('http://localhost:8000');

    await expect(client.initCollection()).rejects.toBeInstanceOf(ExternalAPIError);
  });

  it('getCollection lanza error si no inicializada', () => {
    const client = new ChromaClient('http://localhost:8000');

    expect(() => client.getCollection()).toThrow(ExternalAPIError);
  });

  it('upsertItem usa biasScore default 0', async () => {
    const client = new ChromaClient('http://localhost:8000');
    const mockCollection = { upsert: vi.fn() };
    (client as any).collection = mockCollection;

    await client.upsertItem('id-1', [0.1], { title: 'T', source: 'S', publishedAt: '2026-02-01' }, 'doc');

    expect(mockCollection.upsert).toHaveBeenCalledWith({
      ids: ['id-1'],
      embeddings: [[0.1]],
      metadatas: [{
        title: 'T',
        source: 'S',
        publishedAt: '2026-02-01',
        biasScore: 0,
      }],
      documents: ['doc'],
    });
  });

  it('querySimilar retorna IDs', async () => {
    const client = new ChromaClient('http://localhost:8000');
    const mockCollection = {
      query: vi.fn().mockResolvedValueOnce({ ids: [['a', 'b']] }),
    };
    (client as any).collection = mockCollection;

    const result = await client.querySimilar([0.1], 2);

    expect(result).toEqual(['a', 'b']);
  });

  it('querySimilarWithDocuments retorna resultados completos', async () => {
    const client = new ChromaClient('http://localhost:8000');
    const mockCollection = {
      query: vi.fn().mockResolvedValueOnce({
        ids: [['a']],
        documents: [['doc']],
        metadatas: [[{ title: 'T', source: 'S', publishedAt: 'P', biasScore: 0.2 }]],
        distances: [[0.3]],
      }),
    };
    (client as any).collection = mockCollection;

    const result = await client.querySimilarWithDocuments([0.1], 1);

    expect(result).toEqual([
      {
        id: 'a',
        document: 'doc',
        metadata: { title: 'T', source: 'S', publishedAt: 'P', biasScore: 0.2 },
        distance: 0.3,
      },
    ]);
  });

  it('healthCheck retorna false si falla', async () => {
    mockHeartbeat.mockRejectedValueOnce(new Error('down'));
    const client = new ChromaClient('http://localhost:8000');

    const ok = await client.healthCheck();

    expect(ok).toBe(false);
  });
});
