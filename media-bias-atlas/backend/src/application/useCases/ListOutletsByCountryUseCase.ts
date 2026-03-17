import { IOutletRepository } from '../../domain/repositories/IOutletRepository';
import { ICountryRepository } from '../../domain/repositories/ICountryRepository';
import { Outlet } from '../../domain/entities/Outlet';

export class ListOutletsByCountryUseCase {
  constructor(
    private readonly outletRepository: IOutletRepository,
    private readonly countryRepository: ICountryRepository
  ) {}

  async execute(countryCode: string): Promise<Outlet[]> {
    const country = await this.countryRepository.findByCode(countryCode.toUpperCase());
    if (!country) {
      throw new Error(`Country with code ${countryCode} not found.`);
    }

    return this.outletRepository.findByCountryId(country.id);
  }
}
