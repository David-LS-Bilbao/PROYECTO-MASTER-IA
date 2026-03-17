import { IOutletRepository } from '../../domain/repositories/IOutletRepository';
import { ICountryRepository } from '../../domain/repositories/ICountryRepository';
import { Outlet } from '../../domain/entities/Outlet';
import { createOutletSchema, CreateOutletDTO } from '../dtos/CreateOutletDTO';

export class CreateOutletUseCase {
  constructor(
    private readonly outletRepository: IOutletRepository,
    private readonly countryRepository: ICountryRepository
  ) {}

  async execute(data: CreateOutletDTO): Promise<Outlet> {
    // 1. Validar payload de entrada usando el schema de Zod
    const validData = createOutletSchema.parse(data);

    // 2. Verificar que el país existe usando el respositorio
    const country = await this.countryRepository.findByCode(validData.countryCode);
    if (!country) {
      throw new Error(`Country with code ${validData.countryCode} not found.`);
    }

    // 3. Persistir el medio
    const outlet = await this.outletRepository.save({
      countryId: country.id,
      name: validData.name,
      description: validData.description ?? null,
      websiteUrl: validData.websiteUrl ?? null,
    });

    return outlet;
  }
}
