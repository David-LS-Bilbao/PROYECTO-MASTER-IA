import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncFeedArticlesUseCase, SyncResult } from '../../../src/application/use-cases/feeds/SyncFeedArticlesUseCase';
import { IRssFeedRepository } from '../../../src/domain/repositories/IRssFeedRepository';
import { IArticleRepository } from '../../../src/domain/repositories/IArticleRepository';
import Parser from 'rss-parser';

// Mocks formales
vi.mock('rss-parser');

const mockFeedRepo: IRssFeedRepository = {
  save: vi.fn(),
  findAllByOutletId: vi.fn(),
  findById: vi.fn(),
  updateLastCheckedAt: vi.fn(),
};

const mockArticleRepo: IArticleRepository = {
  saveManySkipDuplicates: vi.fn(),
};

describe('SyncFeedArticlesUseCase', () => {
  let useCase: SyncFeedArticlesUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new SyncFeedArticlesUseCase(mockFeedRepo, mockArticleRepo);
  });

  it('1. Debe devolver status failed si el RSS Parser lanza error (XML roto / TimeOut)', async () => {
    // Configurar el feed que sí existe
    (mockFeedRepo.findById as any).mockResolvedValue({ id: 'f1', url: 'https://elpais.com/rss' });
    
    // Forzar caída de red en rss-parser simulando timeout o DNS error
    (Parser.prototype.parseURL as any).mockRejectedValue(new Error('Network TimeOut'));

    const result = await useCase.execute('f1');
    
    expect(result.status).toBe('failed');
    expect(result.fetched).toBe(0);
    // Asegurarse de que el DB fue avisada del chequeo aunque haya fallado
    expect(mockFeedRepo.updateLastCheckedAt).toHaveBeenCalled();
  });

  it('2. Debe saltarse artículos sin título o links inválidos', async () => {
    (mockFeedRepo.findById as any).mockResolvedValue({ id: 'f1', url: 'https://fake-feed.com' });
    
    (Parser.prototype.parseURL as any).mockResolvedValue({
      items: [
        { title: 'Noticia Válida', link: 'https://valida.com' },
        { title: 'Sin Link', link: '' },
        { title: 'Protocolo Loco', link: 'ftp://fake.com' },
      ],
    });

    (mockArticleRepo.saveManySkipDuplicates as any).mockResolvedValue({ count: 1 });

    const result = await useCase.execute('f1');

    expect(result.status).toBe('success');
    expect(result.fetched).toBe(3);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(2); 
    
    // Se llamó la capa de persistencia con solo 1 artículo mapeado correctamente
    const passedArticles = (mockArticleRepo.saveManySkipDuplicates as any).mock.calls[0][0];
    expect(passedArticles).toHaveLength(1);
    expect(passedArticles[0].url).toBe('https://valida.com');
  });

});
