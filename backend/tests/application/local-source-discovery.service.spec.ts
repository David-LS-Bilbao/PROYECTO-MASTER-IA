/**
 * LocalSourceDiscoveryService Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalSourceDiscoveryService } from '../../src/application/services/local-source-discovery.service';
import { SecurityError } from '../../src/domain/errors/domain.error';

// ============================================================================
// MOCKS (hoisted)
// ============================================================================

const { mockValidate, mockQuickCheck } = vi.hoisted(() => ({
  mockValidate: vi.fn(),
  mockQuickCheck: vi.fn(),
}));

vi.mock('../../src/shared/utils/url-validator', () => ({
  UrlValidator: {
    validate: mockValidate,
    quickCheck: mockQuickCheck,
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

function makeFetchResponse(ok: boolean, contentType: string) {
  return {
    ok,
    headers: {
      get: () => contentType,
    },
  } as any;
}

// ============================================================================
// TESTS
// ============================================================================

describe('LocalSourceDiscoveryService', () => {
  let prisma: any;
  let gemini: any;
  let service: LocalSourceDiscoveryService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      source: {
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
    };
    gemini = {
      discoverLocalSources: vi.fn(),
    };
    service = new LocalSourceDiscoveryService(prisma as any, gemini as any);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('retorna si ya existen fuentes en BD', async () => {
    prisma.source.findMany.mockResolvedValueOnce([{ id: 's1', name: 'Local' }]);

    await service.discoverAndSave('Madrid');

    expect(gemini.discoverLocalSources).not.toHaveBeenCalled();
    expect(prisma.source.upsert).not.toHaveBeenCalled();
  });

  it('guarda RSS encontrado con probing', async () => {
    prisma.source.findMany.mockResolvedValueOnce([]);
    gemini.discoverLocalSources.mockResolvedValueOnce(
      JSON.stringify([
        { name: 'Local', domain: 'https://example.com', media_group: 'X', reliability: 'high' },
      ])
    );

    mockQuickCheck.mockReturnValue(true);
    mockValidate.mockResolvedValue(true);

    global.fetch = vi.fn().mockResolvedValue(makeFetchResponse(true, 'application/rss+xml')) as any;

    await service.discoverAndSave('Valencia');

    expect(prisma.source.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { url: 'https://example.com/rss' },
        create: expect.objectContaining({ url: 'https://example.com/rss' }),
      })
    );
  });

  it('usa homepage si el dominio es bloqueado por seguridad', async () => {
    prisma.source.findMany.mockResolvedValueOnce([]);
    gemini.discoverLocalSources.mockResolvedValueOnce(
      JSON.stringify([
        { name: 'Local', domain: 'https://blocked.local', media_group: 'X', reliability: 'high' },
      ])
    );

    mockValidate.mockRejectedValueOnce(new SecurityError('Blocked'));

    await service.discoverAndSave('Bilbao');

    expect(prisma.source.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { url: 'https://blocked.local' },
        create: expect.objectContaining({ url: 'https://blocked.local' }),
      })
    );
  });

  it('lanza error si JSON invalido', async () => {
    prisma.source.findMany.mockResolvedValueOnce([]);
    gemini.discoverLocalSources.mockResolvedValueOnce('not-json');

    await expect(service.discoverAndSave('Sevilla')).rejects.toThrow('Invalid JSON from AI');
  });

  it('lanza error si Gemini falla', async () => {
    prisma.source.findMany.mockResolvedValueOnce([]);
    gemini.discoverLocalSources.mockRejectedValueOnce(new Error('Gemini down'));

    await expect(service.discoverAndSave('Malaga')).rejects.toThrow('Failed to query Gemini for local sources');
  });

  it('limpia markdown y retorna si la lista viene vacia', async () => {
    prisma.source.findMany.mockResolvedValueOnce([]);
    gemini.discoverLocalSources.mockResolvedValueOnce('```json\n[]\n```');

    await service.discoverAndSave('Alicante');

    expect(prisma.source.upsert).not.toHaveBeenCalled();
  });

  it('limpia markdown generico y retorna si la lista viene vacia', async () => {
    prisma.source.findMany.mockResolvedValueOnce([]);
    gemini.discoverLocalSources.mockResolvedValueOnce('```\n[]\n```');

    await service.discoverAndSave('Granada');

    expect(prisma.source.upsert).not.toHaveBeenCalled();
  });

  it('lanza error si la estructura de sugerencia es invalida', async () => {
    prisma.source.findMany.mockResolvedValueOnce([]);
    gemini.discoverLocalSources.mockResolvedValueOnce(
      JSON.stringify([{ name: 'Local', domain: '', media_group: 'X', reliability: 'high' }])
    );

    await expect(service.discoverAndSave('Zaragoza')).rejects.toThrow('Invalid JSON from AI');
  });

  it('no imprime fuentes si no se guardo ninguna', async () => {
    prisma.source.findMany.mockResolvedValueOnce([]);
    gemini.discoverLocalSources.mockResolvedValueOnce(
      JSON.stringify([{ name: 'Local', domain: 'https://example.com', media_group: 'X', reliability: 'high' }])
    );
    mockValidate.mockRejectedValue(new SecurityError('Blocked'));
    prisma.source.upsert.mockRejectedValue(new Error('DB error'));

    await service.discoverAndSave('Toledo');

    expect(prisma.source.upsert).toHaveBeenCalled();
  });

  it('imprime sufijo cuando hay mas de 3 fuentes', async () => {
    prisma.source.findMany.mockResolvedValueOnce([]);
    gemini.discoverLocalSources.mockResolvedValueOnce(
      JSON.stringify([
        { name: 'S1', domain: 'https://s1.com', media_group: 'X', reliability: 'high' },
        { name: 'S2', domain: 'https://s2.com', media_group: 'X', reliability: 'high' },
        { name: 'S3', domain: 'https://s3.com', media_group: 'X', reliability: 'high' },
        { name: 'S4', domain: 'https://s4.com', media_group: 'X', reliability: 'high' },
      ])
    );
    mockValidate.mockRejectedValue(new SecurityError('Blocked'));
    prisma.source.upsert.mockResolvedValue({});

    await service.discoverAndSave('Murcia');

    expect(prisma.source.upsert).toHaveBeenCalledTimes(4);
  });

  it('probeRssUrl retorna null si validate falla con error no SecurityError', async () => {
    mockValidate.mockRejectedValueOnce(new Error('DNS fail'));

    const result = await (service as any).probeRssUrl('https://example.com');

    expect(result).toBeNull();
  });

  it('probeRssUrl salta candidatos si quickCheck bloquea', async () => {
    mockValidate.mockResolvedValueOnce(true);
    mockQuickCheck.mockReturnValue(false);

    const result = await (service as any).probeRssUrl('https://example.com/');

    expect(result).toBeNull();
    expect(mockQuickCheck).toHaveBeenCalled();
  });

  it('probeRssUrl continua si validate candidato lanza SecurityError', async () => {
    mockValidate
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new SecurityError('Blocked candidate'));
    mockQuickCheck.mockImplementationOnce(() => true).mockReturnValue(false);

    const result = await (service as any).probeRssUrl('https://example.com');

    expect(result).toBeNull();
  });

  it('probeRssUrl retorna RSS cuando el contenido es valido', async () => {
    mockValidate.mockResolvedValue(true);
    mockQuickCheck.mockReturnValue(true);
    global.fetch = vi.fn().mockResolvedValue(makeFetchResponse(true, 'application/rss+xml')) as any;

    const result = await (service as any).probeRssUrl('https://example.com/');

    expect(result).toBe('https://example.com/rss');
  });

  it('probeRssUrl retorna null si no hay content-type', async () => {
    mockValidate.mockResolvedValue(true);
    mockQuickCheck.mockReturnValue(true);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
    }) as any;

    const result = await (service as any).probeRssUrl('https://example.com');

    expect(result).toBeNull();
  });

  it('probeRssUrl acepta content-type con rss sin xml', async () => {
    mockValidate.mockResolvedValue(true);
    mockQuickCheck.mockReturnValue(true);
    global.fetch = vi.fn().mockResolvedValue(makeFetchResponse(true, 'application/rss')) as any;

    const result = await (service as any).probeRssUrl('https://example.com');

    expect(result).toBe('https://example.com/rss');
  });

  it('probeRssUrl acepta content-type con atom sin xml', async () => {
    mockValidate.mockResolvedValue(true);
    mockQuickCheck.mockReturnValue(true);
    global.fetch = vi.fn().mockResolvedValue(makeFetchResponse(true, 'application/atom')) as any;

    const result = await (service as any).probeRssUrl('https://example.com');

    expect(result).toBe('https://example.com/rss');
  });

  it('probeRssUrl continua si fetch falla con error generico', async () => {
    mockValidate.mockResolvedValue(true);
    mockQuickCheck.mockImplementationOnce(() => true).mockReturnValue(false);
    global.fetch = vi.fn().mockRejectedValue(new Error('timeout')) as any;

    const result = await (service as any).probeRssUrl('https://example.com');

    expect(result).toBeNull();
  });
});
