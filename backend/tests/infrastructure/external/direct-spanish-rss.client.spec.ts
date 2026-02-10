/**
 * DirectSpanishRssClient Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DirectSpanishRssClient } from '../../../src/infrastructure/external/direct-spanish-rss.client';

describe('DirectSpanishRssClient', () => {
  let client: DirectSpanishRssClient;

  beforeEach(() => {
    client = new DirectSpanishRssClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolveCategory maneja match directo, keywords y fallback', () => {
    const resolveCategory = (client as any).resolveCategory.bind(client);

    expect(resolveCategory()).toBe('general');
    expect(resolveCategory('deportes')).toBe('deportes');
    expect(resolveCategory('entretenimiento')).toBe('cultura');
    expect(resolveCategory('entertainment')).toBe('cultura');
    expect(resolveCategory('futbol y liga')).toBe('deportes');
    expect(resolveCategory('tema-desconocido')).toBe('general');
  });

  it('cleanDescription elimina HTML, decodifica entidades y trunca', () => {
    const cleanDescription = (client as any).cleanDescription.bind(client);

    const cleaned = cleanDescription('<p>Hola &quot;Mundo&quot; &amp; test</p>');
    expect(cleaned).toBe('Hola \"Mundo\" & test');

    const long = 'a'.repeat(305);
    const truncated = cleanDescription(long);
    expect(truncated?.length).toBe(300);
    expect(truncated).toMatch(/\.{3}$/);
  });

  it('transformRssItemToArticle extrae imagen de enclosure', () => {
    const transform = (client as any).transformRssItemToArticle.bind(client);
    const article = transform(
      {
        title: 'T1',
        description: '<b>Desc</b>',
        link: 'https://example.com',
        isoDate: '2026-02-01T00:00:00.000Z',
        enclosure: { url: 'https://img.com/1.jpg', type: 'image/jpeg' },
      },
      'Source',
      'source'
    );

    expect(article.urlToImage).toBe('https://img.com/1.jpg');
    expect(article.description).toBe('Desc');
  });

  it('transformRssItemToArticle usa mediaContent y mediaThumbnail como fallback', () => {
    const transform = (client as any).transformRssItemToArticle.bind(client);

    const articleMediaContent = transform(
      {
        title: 'T2',
        link: 'https://example.com/2',
        isoDate: '2026-02-01T00:00:00.000Z',
        mediaContent: [{ $: { url: 'https://img.com/2.jpg' } }],
      },
      'Source',
      'source'
    );

    const articleMediaThumb = transform(
      {
        title: 'T3',
        link: 'https://example.com/3',
        isoDate: '2026-02-01T00:00:00.000Z',
        mediaThumbnail: { $: { url: 'https://img.com/3.jpg' } },
      },
      'Source',
      'source'
    );

    expect(articleMediaContent.urlToImage).toBe('https://img.com/2.jpg');
    expect(articleMediaThumb.urlToImage).toBe('https://img.com/3.jpg');
  });

  it('fetchTopHeadlines agrega y balancea articulos por fuente', async () => {
    const fetchSingleFeed = vi
      .spyOn(client as any, 'fetchSingleFeed')
      .mockImplementation(async () => [
        {
          title: 'A',
          description: null,
          content: null,
          url: 'https://a.com',
          urlToImage: null,
          source: { id: 's', name: 'S' },
          author: null,
          publishedAt: '2026-02-01T00:00:00.000Z',
        },
        {
          title: 'B',
          description: null,
          content: null,
          url: 'https://b.com',
          urlToImage: null,
          source: { id: 's', name: 'S' },
          author: null,
          publishedAt: '2026-02-02T00:00:00.000Z',
        },
      ]);

    const result = await client.fetchTopHeadlines({ category: 'general', pageSize: 5 });

    expect(fetchSingleFeed).toHaveBeenCalled();
    expect(result.status).toBe('ok');
    expect(result.articles.length).toBe(5);
    expect(result.totalResults).toBe(5);
  });

  it('fetchTopHeadlines lanza error si todas las fuentes fallan', async () => {
    vi.spyOn(client as any, 'fetchSingleFeed').mockRejectedValue(new Error('boom'));

    await expect(client.fetchTopHeadlines({ category: 'general' })).rejects.toThrow(
      'Direct RSS fetch failed'
    );
  });

  it('fetchTopHeadlines cubre multiples categorias', async () => {
    const fetchSingleFeed = vi
      .spyOn(client as any, 'fetchSingleFeed')
      .mockResolvedValue([
        {
          title: 'A',
          description: null,
          content: null,
          url: 'https://a.com',
          urlToImage: null,
          source: { id: 's', name: 'S' },
          author: null,
          publishedAt: '2026-02-01T00:00:00.000Z',
        },
      ]);

    await client.fetchTopHeadlines({ category: 'economia', pageSize: 3 });
    await client.fetchTopHeadlines({ category: 'tecnologia', pageSize: 3 });
    await client.fetchTopHeadlines({ category: 'ciencia', pageSize: 3 });
    await client.fetchTopHeadlines({ category: 'politica', pageSize: 3 });
    await client.fetchTopHeadlines({ category: 'internacional', pageSize: 3 });
    await client.fetchTopHeadlines({ category: 'cultura', pageSize: 3 });

    expect(fetchSingleFeed).toHaveBeenCalled();
  });
});
