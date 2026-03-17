import { z } from 'zod';
import { RssFeed } from '../../../domain/entities/RssFeed';
import { IRssFeedRepository } from '../../../domain/repositories/IRssFeedRepository';

const addRssFeedSchema = z.object({
  url: z.string().url('Debe ser una URL válida HTTP/HTTPS').trim(),
  category: z.string().optional(),
});

export class AddRssFeedUseCase {
  constructor(
    private readonly rssFeedRepository: IRssFeedRepository,
    // Podríamos inyectar IOutletRepository para validar que el outlet existe, pero prisma arrojará un error 404/409 si falla la FK de forma segura para el MVP
  ) {}

  async execute(outletId: string, payload: unknown): Promise<RssFeed> {
    const data = addRssFeedSchema.parse(payload);

    // Guardar el Feed asumiendo que el Outlet existe (Manejo de Foreign Key en Prisma)
    const newFeed = await this.rssFeedRepository.save({
      outletId,
      url: data.url,
      category: data.category || null,
      isActive: true,
    });

    return newFeed;
  }
}
