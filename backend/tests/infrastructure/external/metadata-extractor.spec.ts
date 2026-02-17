/**
 * MetadataExtractor Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetadataExtractor } from '../../../src/infrastructure/external/metadata-extractor';
import { ExternalAPIError } from '../../../src/domain/errors/infrastructure.error';

// ============================================================================
// MOCKS (hoisted)
// ============================================================================

const { mockGet, mockIsAxiosError } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockIsAxiosError: vi.fn(),
}));

vi.mock('axios', () => ({
  default: { get: mockGet, isAxiosError: mockIsAxiosError },
  get: mockGet,
  isAxiosError: mockIsAxiosError,
}));

// ============================================================================
// TESTS
// ============================================================================

describe('MetadataExtractor', () => {
  let extractor: MetadataExtractor;

  beforeEach(() => {
    vi.clearAllMocks();
    extractor = new MetadataExtractor();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lanza error si URL invalida', async () => {
    await expect(extractor.extractMetadata('invalid-url')).rejects.toBeInstanceOf(ExternalAPIError);
  });

  it('extrae metadata y normaliza imagen', async () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="//example.com/image.jpg" />
          <meta name="twitter:image" content="https://example.com/tw.jpg" />
          <meta property="og:title" content="OG Title" />
          <meta property="og:description" content="OG Desc" />
          <title>Fallback</title>
        </head>
      </html>
    `;

    mockGet.mockResolvedValueOnce({ data: html });

    const meta = await extractor.extractMetadata('https://example.com');

    expect(meta.ogImage).toBe('https://example.com/image.jpg');
    expect(meta.twitterImage).toBe('https://example.com/tw.jpg');
    expect(meta.title).toBe('OG Title');
    expect(meta.description).toBe('OG Desc');
    expect(extractor.getBestImageUrl(meta)).toBe('https://example.com/image.jpg');
  });

  it('usa twitter y meta description como fallback', async () => {
    const html = `
      <html>
        <head>
          <meta name="twitter:image:src" content="https://example.com/tw2.jpg" />
          <meta name="twitter:title" content="TW Title" />
          <meta name="twitter:description" content="TW Desc" />
          <meta name="description" content="Meta Desc" />
        </head>
      </html>
    `;

    mockGet.mockResolvedValueOnce({ data: html });

    const meta = await extractor.extractMetadata('https://example.com');

    // Sprint 29: extractOgImage ahora usa twitter:image como fallback si og:image no existe
    expect(meta.ogImage).toBe('https://example.com/tw2.jpg'); // Antes era null, ahora fallback
    expect(meta.twitterImage).toBe('https://example.com/tw2.jpg');
    expect(meta.title).toBe('TW Title');
    expect(meta.description).toBe('TW Desc');
    expect(extractor.getBestImageUrl(meta)).toBe('https://example.com/tw2.jpg');
  });

  it('extrae og:image:secure_url y link image_src', async () => {
    const html = `
      <html>
        <head>
          <meta property="og:image:secure_url" content="https://example.com/secure.jpg" />
          <link rel="image_src" href="https://example.com/link.jpg" />
          <title>Title Tag</title>
        </head>
      </html>
    `;

    mockGet.mockResolvedValueOnce({ data: html });

    const meta = await extractor.extractMetadata('https://example.com');

    expect(meta.ogImage).toBe('https://example.com/secure.jpg');
    expect(meta.title).toBe('Title Tag');
  });

  it('mantiene URL relativa si no es http/https', async () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="images/pic.jpg" />
        </head>
      </html>
    `;

    mockGet.mockResolvedValueOnce({ data: html });

    const meta = await extractor.extractMetadata('https://example.com');
    expect(meta.ogImage).toBe('images/pic.jpg');
  });

  it('maneja timeout con 408', async () => {
    const err = { code: 'ECONNABORTED' };
    mockIsAxiosError.mockReturnValueOnce(true);
    mockGet.mockRejectedValueOnce(err);

    await expect(extractor.extractMetadata('https://example.com')).rejects.toMatchObject({
      message: expect.stringContaining('Timeout'),
    });
  });

  it('maneja 403/401', async () => {
    const err = { response: { status: 403 } };
    mockIsAxiosError.mockReturnValueOnce(true);
    mockGet.mockRejectedValueOnce(err);

    await expect(extractor.extractMetadata('https://example.com')).rejects.toMatchObject({
      message: expect.stringContaining('Access forbidden'),
    });
  });

  it('maneja 404', async () => {
    const err = { response: { status: 404 } };
    mockIsAxiosError.mockReturnValueOnce(true);
    mockGet.mockRejectedValueOnce(err);

    await expect(extractor.extractMetadata('https://example.com')).rejects.toMatchObject({
      message: expect.stringContaining('URL not found'),
    });
  });

  it('maneja errores no Axios', async () => {
    mockIsAxiosError.mockReturnValueOnce(false);
    mockGet.mockRejectedValueOnce(new Error('boom'));

    await expect(extractor.extractMetadata('https://example.com')).rejects.toMatchObject({
      message: expect.stringContaining('Failed to extract metadata: boom'),
    });
  });
});
