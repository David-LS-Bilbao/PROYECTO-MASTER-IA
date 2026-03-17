import { Outlet } from '../entities/Outlet';

export interface IOutletRepository {
  /**
   * Guarda un nuevo medio.
   */
  save(outlet: Omit<Outlet, 'id' | 'createdAt' | 'updatedAt'>): Promise<Outlet>;

  /**
   * Busca un medio por su ID.
   */
  findById(id: string): Promise<Outlet | null>;

  /**
   * Lista todos los medios pertenecientes a un país específico.
   */
  findByCountryId(countryId: string): Promise<Outlet[]>;
}
