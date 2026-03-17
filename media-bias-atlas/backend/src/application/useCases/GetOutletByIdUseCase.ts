import { Outlet } from '../../domain/entities/Outlet';
import { IOutletRepository } from '../../domain/repositories/IOutletRepository';

export class GetOutletByIdUseCase {
  constructor(private readonly outletRepository: IOutletRepository) {}

  async execute(id: string): Promise<Outlet> {
    const outlet = await this.outletRepository.findById(id);

    if (!outlet) {
      throw new Error(`Outlet con id ${id} no encontrado`);
    }

    return outlet;
  }
}
