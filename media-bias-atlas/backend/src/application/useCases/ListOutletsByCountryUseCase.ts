import { IOutletRepository } from '../../domain/repositories/IOutletRepository';
import { ICountryRepository } from '../../domain/repositories/ICountryRepository';
import { Outlet } from '../../domain/entities/Outlet';
import { IArticleRepository } from '../../domain/repositories/IArticleRepository';
import { buildOutletBiasSummary } from '../../domain/entities/OutletBiasProfile';

export class ListOutletsByCountryUseCase {
  constructor(
    private readonly outletRepository: IOutletRepository,
    private readonly countryRepository: ICountryRepository,
    private readonly articleRepository: IArticleRepository
  ) {}

  async execute(countryCode: string): Promise<Outlet[]> {
    const country = await this.countryRepository.findByCode(countryCode.toUpperCase());
    if (!country) {
      throw new Error(`Country with code ${countryCode} not found.`);
    }

    const outlets = await this.outletRepository.findByCountryId(country.id);

    return Promise.all(
      outlets.map(async (outlet) => {
        const stats = await this.articleRepository.getOutletBiasStats(outlet.id);
        return {
          ...outlet,
          biasSummary: buildOutletBiasSummary(stats),
        };
      })
    );
  }
}
