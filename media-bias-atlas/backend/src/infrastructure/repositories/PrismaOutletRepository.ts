import { IOutletRepository } from '../../domain/repositories/IOutletRepository';
import { Outlet } from '../../domain/entities/Outlet';
import { prisma } from '../database/prismaClient';

export class PrismaOutletRepository implements IOutletRepository {
  async save(outlet: Omit<Outlet, 'id' | 'createdAt' | 'updatedAt'>): Promise<Outlet> {
    return prisma.outlet.create({
      data: {
        countryId: outlet.countryId,
        name: outlet.name,
        description: outlet.description,
        websiteUrl: outlet.websiteUrl,
      },
    });
  }

  async findById(id: string): Promise<Outlet | null> {
    return prisma.outlet.findUnique({
      where: { id },
    });
  }

  async findByCountryId(countryId: string): Promise<Outlet[]> {
    return prisma.outlet.findMany({
      where: { countryId },
    });
  }
}
