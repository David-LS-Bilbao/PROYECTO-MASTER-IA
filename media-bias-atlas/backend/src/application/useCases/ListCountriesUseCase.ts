import { ICountryRepository } from '../../domain/repositories/ICountryRepository';
import { Country } from '../../domain/entities/Country';

export class ListCountriesUseCase {
  constructor(private readonly countryRepository: ICountryRepository) {}

  async execute(): Promise<Country[]> {
    return this.countryRepository.findAll();
  }
}
