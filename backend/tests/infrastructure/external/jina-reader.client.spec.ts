/**
 * JinaReaderClient Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JinaReaderClient } from '../../../src/infrastructure/external/jina-reader.client';
import { ExternalAPIError, ConfigurationError } from '../../../src/domain/errors/infrastructure.error';

// ============================================================================
// HELPERS
// ============================================================================

function makeResponse(ok: boolean, status: number, jsonData?: any) {
  return {
    ok,
    status,
    json: async () => jsonData,
  } as any;
}

// ============================================================================
// TESTS
// ============================================================================

describe('JinaReaderClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('lanza ConfigurationError si apiKey vacia', () => {
    expect(() => new JinaReaderClient('')).toThrow(ConfigurationError);
  });

  it('lanza ExternalAPIError si URL invalida', async () => {
    const client = new JinaReaderClient('key');

    await expect(client.scrapeUrl('invalid-url')).rejects.toBeInstanceOf(ExternalAPIError);
  });

  it('maneja status 401/429/404', async () => {
    const client = new JinaReaderClient('key');
    global.fetch = vi.fn().mockResolvedValueOnce(makeResponse(false, 401)) as any;

    await expect(client.scrapeUrl('https://example.com')).rejects.toMatchObject({
      message: expect.stringContaining('Invalid API key'),
    });

    (global.fetch as any).mockResolvedValueOnce(makeResponse(false, 429));
    await expect(client.scrapeUrl('https://example.com')).rejects.toMatchObject({
      message: expect.stringContaining('Rate limit'),
    });

    (global.fetch as any).mockResolvedValueOnce(makeResponse(false, 404));
    await expect(client.scrapeUrl('https://example.com')).rejects.toMatchObject({
      message: expect.stringContaining('URL not found'),
    });
  });

  it('parsea respuesta string (markdown)', async () => {
    const client = new JinaReaderClient('key');
    global.fetch = vi.fn().mockResolvedValueOnce(
      makeResponse(true, 200, '# Title\nContent')
    ) as any;

    const result = await client.scrapeUrl('https://example.com');

    expect(result.title).toBe('Title');
    expect(result.content).toContain('Content');
  });

  it('parsea respuesta estructurada y extrae imagen', async () => {
    const client = new JinaReaderClient('key');
    global.fetch = vi.fn().mockResolvedValueOnce(
      makeResponse(true, 200, {
        title: 'Structured Title',
        content: 'Structured content',
        ogImage: 'https://example.com/og.jpg',
      })
    ) as any;

    const result = await client.scrapeUrl('https://example.com');

    expect(result.title).toBe('Structured Title');
    expect(result.content).toContain('Structured content');
    expect(result.imageUrl).toBe('https://example.com/og.jpg');
  });

  it('lanza error si contenido vacio', async () => {
    const client = new JinaReaderClient('key');
    global.fetch = vi.fn().mockResolvedValueOnce(
      makeResponse(true, 200, { content: '' })
    ) as any;

    await expect(client.scrapeUrl('https://example.com')).rejects.toBeInstanceOf(ExternalAPIError);
  });

  it('isAvailable retorna false si fetch falla', async () => {
    const client = new JinaReaderClient('key');
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('down')) as any;

    const ok = await client.isAvailable();

    expect(ok).toBe(false);
  });
});
