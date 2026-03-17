import { Country } from '../entities/Country';

export interface ICountryRepository {
  /**
   * Obtiene todos los países registrados.
   */
  findAll(): Promise<Country[]>;

  /**
   * Busca un país por su código (e.g. 'ES').
   */
  findByCode(code: string): Promise<Country | null>;
}
