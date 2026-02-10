/**
 * GoogleNewsRssClient Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleNewsRssClient } from '../../../src/infrastructure/external/google-news-rss.client';

describe('GoogleNewsRssClient', () => {
  let client: GoogleNewsRssClient;

  beforeEach(() => {
    client = new GoogleNewsRssClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('buildGoogleNewsUrl aplica query y lenguaje', () => {
    const buildUrl = (client as any).buildGoogleNewsUrl.bind(client);
    const url = buildUrl({ query: 'bitcoin', language: 'en' });

    expect(url).toContain('q=bitcoin');
    expect(url).toContain('hl=en-EN');
    expect(url).toContain('ceid=ES%3Aen');
  });

  it('transformRssItemToArticle extrae source desde description', () => {
    const transform = (client as any).transformRssItemToArticle.bind(client);
    const article = transform({
      title: 'Titulo',
      description: '<a href="https://source.com">Fuente Uno</a> - Algo',
      link: 'https://news.google.com/article',
      isoDate: '2026-02-01T00:00:00.000Z',
    });

    expect(article.source.name).toBe('Fuente Uno');
    expect(article.source.id).toBe('fuente-uno');
    expect(article.url).toBe('https://news.google.com/article');
  });

  it('extractDescription limpia HTML y trunca', () => {
    const extractDescription = (client as any).extractDescription.bind(client);
    const long = '<p>' + 'a'.repeat(600) + '</p>';
    const desc = extractDescription({ description: long });

    expect(desc?.length).toBe(500);
    expect(desc).toMatch(/\.{3}$/);
  });

  it('fetchTopHeadlines retorna articulos y maneja error', async () => {
    const parser = (client as any).parser;
    const parseSpy = vi.spyOn(parser, 'parseURL').mockResolvedValueOnce({
      items: [
        { title: 'T1', description: '<a href="x">Src</a> - D', link: 'https://x' },
      ],
    });

    const result = await client.fetchTopHeadlines({ query: 'ia', pageSize: 1 });

    expect(parseSpy).toHaveBeenCalled();
    expect(result.status).toBe('ok');
    expect(result.articles.length).toBe(1);

    parseSpy.mockRejectedValueOnce(new Error('boom'));

    await expect(client.fetchTopHeadlines({ query: 'ia' })).rejects.toThrow(
      'Google News RSS fetch failed'
    );
  });
});
