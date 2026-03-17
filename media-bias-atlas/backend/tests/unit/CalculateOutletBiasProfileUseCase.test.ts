import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CalculateOutletBiasProfileUseCase } from '../../src/application/use-cases/bias-analysis/CalculateOutletBiasProfileUseCase';
import { IOutletRepository } from '../../src/domain/repositories/IOutletRepository';
import { IArticleRepository } from '../../src/domain/repositories/IArticleRepository';
import { IdeologyLabel } from '../../src/domain/entities/ArticleBiasAnalysis';
import { OutletBiasStatus } from '../../src/domain/entities/OutletBiasProfile';
import { OutletNotFoundError } from '../../src/domain/errors/OutletNotFoundError';

describe('CalculateOutletBiasProfileUseCase', () => {
  let outletRepo: IOutletRepository;
  let articleRepo: IArticleRepository;
  let useCase: CalculateOutletBiasProfileUseCase;

  beforeEach(() => {
    outletRepo = {
      create: vi.fn(),
      findAll: vi.fn(),
      findByCountryId: vi.fn(),
      findById: vi.fn(),
    } as unknown as IOutletRepository;

    articleRepo = {
      saveManySkipDuplicates: vi.fn(),
      findByFeedId: vi.fn(),
      updateClassification: vi.fn(),
      findById: vi.fn(),
      getOutletBiasStats: vi.fn(),
    } as unknown as IArticleRepository;

    useCase = new CalculateOutletBiasProfileUseCase(articleRepo, outletRepo);
  });

  const getEmptyDistribution = () => ({
    [IdeologyLabel.LEFT]: 0,
    [IdeologyLabel.CENTER_LEFT]: 0,
    [IdeologyLabel.CENTER]: 0,
    [IdeologyLabel.CENTER_RIGHT]: 0,
    [IdeologyLabel.RIGHT]: 0,
    [IdeologyLabel.UNCLEAR]: 0,
  });

  it('lanza OutletNotFoundError si el medio no existe', async () => {
    vi.mocked(outletRepo.findById).mockResolvedValue(null);

    await expect(useCase.execute({ outletId: 'invalid-id' })).rejects.toThrow(OutletNotFoundError);
  });

  it('devuelve INSUFFICIENT_DATA si hay menos de 5 analisis', async () => {
    vi.mocked(outletRepo.findById).mockResolvedValue({ id: 'outlet-1' } as any);
    
    vi.mocked(articleRepo.getOutletBiasStats).mockResolvedValue({
      totalPoliticalArticles: 10,
      totalCompletedAnalyses: 4,
      distribution: getEmptyDistribution()
    });

    const result = await useCase.execute({ outletId: 'outlet-1' });

    expect(result.status).toBe(OutletBiasStatus.INSUFFICIENT_DATA);
    expect(result.dominantLabel).toBeNull();
  });

  it('devuelve analisis correcto sin dominantLabel si hay un empate o nadie llega al 40%', async () => {
    vi.mocked(outletRepo.findById).mockResolvedValue({ id: 'outlet-1' } as any);

    const dist = getEmptyDistribution();
    // 10 analyses total: 3 for LEFT, 3 for RIGHT, 2 for CENTER, 2 for UNCLEAR
    // Highest is 3 out of 10 -> 30% (< 40%) -> No dominant label
    dist[IdeologyLabel.LEFT] = 3;
    dist[IdeologyLabel.RIGHT] = 3;
    dist[IdeologyLabel.CENTER] = 2;
    dist[IdeologyLabel.UNCLEAR] = 2;

    vi.mocked(articleRepo.getOutletBiasStats).mockResolvedValue({
      totalPoliticalArticles: 15,
      totalCompletedAnalyses: 10,
      distribution: dist
    });

    const result = await useCase.execute({ outletId: 'outlet-1' });

    expect(result.status).toBe(OutletBiasStatus.ANALYZED);
    expect(result.dominantLabel).toBeNull();
  });

  it('encuentra el dominantLabel si una etiqueta obtiene mas del 40%', async () => {
    vi.mocked(outletRepo.findById).mockResolvedValue({ id: 'outlet-1' } as any);

    const dist = getEmptyDistribution();
    // 10 analyses total: 5 for CENTER_LEFT (50%), 3 for CENTER, 2 for LEFT
    dist[IdeologyLabel.CENTER_LEFT] = 5;
    dist[IdeologyLabel.CENTER] = 3;
    dist[IdeologyLabel.LEFT] = 2;

    vi.mocked(articleRepo.getOutletBiasStats).mockResolvedValue({
      totalPoliticalArticles: 12,
      totalCompletedAnalyses: 10,
      distribution: dist
    });

    const result = await useCase.execute({ outletId: 'outlet-1' });

    expect(result.status).toBe(OutletBiasStatus.ANALYZED);
    expect(result.dominantLabel).toBe(IdeologyLabel.CENTER_LEFT);
  });
});
