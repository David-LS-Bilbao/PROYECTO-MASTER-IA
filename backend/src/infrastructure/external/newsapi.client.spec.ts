import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NewsAPIClient } from './newsapi.client';
import { ExternalAPIError, ConfigurationError } from '../../domain/errors/infrastructure.error';

// Helper to mock fetch
const mockFetch = vi.fn();

describe('NewsAPIClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
    (globalThis as any).fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws ConfigurationError when API key is missing', () => {
    expect(() => new NewsAPIClient('')).toThrow(ConfigurationError);
  });

  it('fetchTopHeadlines builds query and sanitizes response', async () => {
    const client = new NewsAPIClient('test-key');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'ok',
        totalResults: 1,
        articles: [
          {
            title: '<script>alert(1)</script>Title',
            description: 'Desc',
            content: 'Content',
            url: 'https://example.com/a',
            urlToImage: 'javascript:alert(1)',
            source: { id: '<script>x</script>', name: 'Source' },
            author: 'Author',
            publishedAt: '2026-02-01T10:00:00Z',
          },
        ],
      }),
    });

    const result = await client.fetchTopHeadlines({
      query: 'ai',
      category: 'technology',
      language: 'es',
      pageSize: 5,
      page: 2,
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/top-headlines?');
    expect(calledUrl).toContain('q=ai');
    expect(calledUrl).toContain('category=technology');
    expect(calledUrl).toContain('language=es');
    expect(calledUrl).toContain('pageSize=5');
    expect(calledUrl).toContain('page=2');

    expect(result.status).toBe('ok');
    expect(result.totalResults).toBe(1);
    expect(result.articles[0].title).toBe('Title');
    expect(result.articles[0].urlToImage).toBeNull();
    expect(result.articles[0].source.id).toBe('');
  });

  it('fetchTopHeadlines throws ExternalAPIError on non-ok response', async () => {
    const client = new NewsAPIClient('test-key');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ message: 'Rate limit exceeded' }),
    });

    await expect(client.fetchTopHeadlines({ query: 'ai' })).rejects.toThrow(ExternalAPIError);
  });

  it('fetchEverything builds query and sanitizes response', async () => {
    const client = new NewsAPIClient('test-key');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'ok',
        totalResults: 1,
        articles: [
          {
            title: 'Title',
            description: null,
            content: null,
            url: 'https://example.com/b',
            urlToImage: 'https://example.com/img.jpg',
            source: { id: null, name: null },
            author: null,
            publishedAt: null,
          },
        ],
      }),
    });

    const result = await client.fetchEverything({
      query: 'economia',
      language: 'es',
      pageSize: 20,
      page: 1,
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/everything?');
    expect(calledUrl).toContain('q=economia');
    expect(calledUrl).toContain('language=es');

    expect(result.articles[0].source.name).toBe('Unknown');
    expect(result.articles[0].publishedAt).toBeTypeOf('string');
  });

  it('fetchEverything throws ExternalAPIError on fetch failure', async () => {
    const client = new NewsAPIClient('test-key');
    mockFetch.mockRejectedValueOnce(new Error('Network down'));

    await expect(client.fetchEverything({ query: 'ai' })).rejects.toThrow(ExternalAPIError);
  });
});
