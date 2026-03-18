import { describe, expect, it, vi } from 'vitest';
import { ListOutletsByCountryUseCase } from '../../src/application/useCases/ListOutletsByCountryUseCase';
import { IdeologyLabel } from '../../src/domain/entities/ArticleBiasAnalysis';

describe('ListOutletsByCountryUseCase', () => {
  it('enriquece el listado con biasSummary reutilizable por outlet', async () => {
    const outletRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByCountryId: vi.fn().mockResolvedValue([
        {
          id: 'outlet-1',
          countryId: 'country-1',
          name: 'Atlas Diario',
          description: null,
          websiteUrl: 'https://atlas.example.com',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    };

    const countryRepo = {
      findAll: vi.fn(),
      findByCode: vi.fn().mockResolvedValue({
        id: 'country-1',
        code: 'ES',
        name: 'España',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };

    const articleRepo = {
      saveManySkipDuplicates: vi.fn(),
      findByFeedId: vi.fn(),
      updateClassification: vi.fn(),
      findById: vi.fn(),
      getOutletBiasStats: vi.fn().mockResolvedValue({
        totalPoliticalArticles: 12,
        totalCompletedAnalyses: 8,
        distribution: {
          [IdeologyLabel.LEFT]: 1,
          [IdeologyLabel.CENTER_LEFT]: 4,
          [IdeologyLabel.CENTER]: 2,
          [IdeologyLabel.CENTER_RIGHT]: 1,
          [IdeologyLabel.RIGHT]: 0,
          [IdeologyLabel.UNCLEAR]: 0,
        },
      }),
    };

    const useCase = new ListOutletsByCountryUseCase(
      outletRepo as any,
      countryRepo as any,
      articleRepo as any
    );

    const result = await useCase.execute('es');

    expect(countryRepo.findByCode).toHaveBeenCalledWith('ES');
    expect(articleRepo.getOutletBiasStats).toHaveBeenCalledWith('outlet-1');
    expect(result[0].biasSummary).toEqual({
      status: 'ANALYZED',
      dominantLabel: IdeologyLabel.CENTER_LEFT,
      totalPoliticalArticles: 12,
      totalCompletedAnalyses: 8,
    });
  });

  it('marca INSUFFICIENT_DATA cuando el outlet todavía no tiene muestra suficiente', async () => {
    const outletRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByCountryId: vi.fn().mockResolvedValue([
        {
          id: 'outlet-2',
          countryId: 'country-1',
          name: 'Sin Muestra',
          description: null,
          websiteUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    };

    const countryRepo = {
      findAll: vi.fn(),
      findByCode: vi.fn().mockResolvedValue({
        id: 'country-1',
        code: 'ES',
        name: 'España',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };

    const articleRepo = {
      saveManySkipDuplicates: vi.fn(),
      findByFeedId: vi.fn(),
      updateClassification: vi.fn(),
      findById: vi.fn(),
      getOutletBiasStats: vi.fn().mockResolvedValue({
        totalPoliticalArticles: 3,
        totalCompletedAnalyses: 2,
        distribution: {
          [IdeologyLabel.LEFT]: 1,
          [IdeologyLabel.CENTER_LEFT]: 0,
          [IdeologyLabel.CENTER]: 0,
          [IdeologyLabel.CENTER_RIGHT]: 0,
          [IdeologyLabel.RIGHT]: 0,
          [IdeologyLabel.UNCLEAR]: 1,
        },
      }),
    };

    const useCase = new ListOutletsByCountryUseCase(
      outletRepo as any,
      countryRepo as any,
      articleRepo as any
    );

    const result = await useCase.execute('ES');

    expect(result[0].biasSummary).toEqual({
      status: 'INSUFFICIENT_DATA',
      dominantLabel: null,
      totalPoliticalArticles: 3,
      totalCompletedAnalyses: 2,
    });
  });
});
