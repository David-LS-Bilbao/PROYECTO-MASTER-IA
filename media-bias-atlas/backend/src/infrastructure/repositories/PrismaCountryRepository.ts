import { ICountryRepository } from '../../domain/repositories/ICountryRepository';
import { Country } from '../../domain/entities/Country';
import { prisma } from '../database/prismaClient';

export class PrismaCountryRepository implements ICountryRepository {
  async findAll(): Promise<Country[]> {
    return prisma.country.findMany();
  }

  async findByCode(code: string): Promise<Country | null> {
    return prisma.country.findUnique({
      where: { code },
    });
  }
}
