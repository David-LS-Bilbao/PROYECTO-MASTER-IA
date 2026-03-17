import { RssFeed } from '../../../domain/entities/RssFeed';
import { IRssFeedRepository } from '../../../domain/repositories/IRssFeedRepository';

export class ListFeedsByOutletUseCase {
  constructor(private readonly rssFeedRepository: IRssFeedRepository) {}

  async execute(outletId: string): Promise<RssFeed[]> {
    if (!outletId) {
      throw new Error('El ID del Outlet es obligatorio');
    }

    // Retorna los RSS Feeds vinculados al Outlet ordenados por createdAt descendente como base (está en Prisma Repo)
    return this.rssFeedRepository.findAllByOutletId(outletId);
  }
}
