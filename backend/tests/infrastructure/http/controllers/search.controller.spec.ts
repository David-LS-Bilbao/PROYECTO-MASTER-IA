/**
 * SearchController Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { SearchController } from '../../../../src/infrastructure/http/controllers/search.controller';
import { ValidationError } from '../../../../src/domain/errors/domain.error';
import { ExternalAPIError, DatabaseError } from '../../../../src/domain/errors/infrastructure.error';
import { NewsArticle } from '../../../../src/domain/entities/news-article.entity';

// ============================================================================
// MOCKS (hoisted)
// ============================================================================

const { mockIncrementSearches } = vi.hoisted(() => ({
  mockIncrementSearches: vi.fn(),
}));

vi.mock('../../../../src/infrastructure/monitoring/user-stats-tracker', () => ({
  UserStatsTracker: {
    incrementSearches: mockIncrementSearches,
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

function createRes() {
  const jsonMock = vi.fn();
  const statusMock = vi.fn(() => ({ json: jsonMock }));
  const res = {
    status: statusMock as any,
    json: jsonMock as any,
  } as Partial<Response>;
  return { res, jsonMock, statusMock };
}

function createArticle(overrides: Partial<Record<string, unknown>> = {}): NewsArticle {
  return NewsArticle.reconstitute({
    id: 'article-1',
    title: 'Title',
    description: 'Description',
    content: 'Content',
    url: 'https://example.com/1',
    urlToImage: null,
    source: 'Source',
    author: null,
    publishedAt: new Date('2026-02-01T10:00:00Z'),
    category: 'general',
    topicId: null,
    language: 'es',
    embedding: null,
    summary: 'Summary',
    biasScore: 0.2,
    analysis: JSON.stringify({ summary: 'Summary', biasScore: 0.2 }),
    analyzedAt: new Date('2026-02-01T10:00:00Z'),
    internalReasoning: null,
    isFavorite: false,
    fetchedAt: new Date('2026-02-01T10:00:00Z'),
    updatedAt: new Date('2026-02-01T10:00:00Z'),
    ...overrides,
  });
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('SearchController', () => {
  let controller: SearchController;
  let searchNewsUseCase: { execute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIncrementSearches.mockResolvedValue(undefined);
    searchNewsUseCase = { execute: vi.fn() };
    controller = new SearchController(searchNewsUseCase as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('400 si query es invalida', async () => {
    const { res, statusMock } = createRes();
    const req = { query: {} } as Request;

    await controller.search(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('200 con resultados y parsea analysis', async () => {
    const { res, statusMock, jsonMock } = createRes();

    const article1 = createArticle();
    const article2 = createArticle({
      id: 'article-2',
      url: 'https://example.com/2',
      analysis: 'not-json',
    });

    searchNewsUseCase.execute.mockResolvedValueOnce({
      query: 'ai',
      results: [article1, article2],
      totalFound: 2,
    });

    const req = {
      query: { q: 'ai', limit: '5' },
      user: { uid: 'user-1' },
    } as Request;

    await controller.search(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(mockIncrementSearches).toHaveBeenCalledWith('user-1', 1);

    const payload = jsonMock.mock.calls[0][0];
    expect(payload.data.results[0].analysis).toEqual({ summary: 'Summary', biasScore: 0.2 });
    expect(payload.data.results[1].analysis).toBeNull();
  });

  it('400 si ValidationError', async () => {
    const { res, statusMock } = createRes();
    const req = { query: { q: 'ai' } } as Request;

    searchNewsUseCase.execute.mockRejectedValueOnce(new ValidationError('Invalid'));

    await controller.search(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('503 si ExternalAPIError', async () => {
    const { res, statusMock } = createRes();
    const req = { query: { q: 'ai' } } as Request;

    searchNewsUseCase.execute.mockRejectedValueOnce(new ExternalAPIError('Gemini', 'Down', 503));

    await controller.search(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(503);
  });

  it('500 si DatabaseError', async () => {
    const { res, statusMock } = createRes();
    const req = { query: { q: 'ai' } } as Request;

    searchNewsUseCase.execute.mockRejectedValueOnce(new DatabaseError('DB error'));

    await controller.search(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
  });

  it('500 si error desconocido', async () => {
    const { res, statusMock } = createRes();
    const req = { query: { q: 'ai' } } as Request;

    searchNewsUseCase.execute.mockRejectedValueOnce(new Error('Unknown'));

    await controller.search(req, res as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
  });
});



