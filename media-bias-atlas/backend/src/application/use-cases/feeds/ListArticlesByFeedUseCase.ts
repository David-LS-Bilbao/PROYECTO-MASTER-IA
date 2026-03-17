import { Article } from '../../../domain/entities/Article';
import { IArticleRepository } from '../../../domain/repositories/IArticleRepository';

export class ListArticlesByFeedUseCase {
  constructor(private readonly articleRepository: IArticleRepository) {}

  async execute(feedId: string, limit: number = 50, isPolitical?: boolean): Promise<Article[]> {
    if (!feedId) {
      throw new Error('El ID del Feed es obligatorio');
    }

    return this.articleRepository.findByFeedId(feedId, limit, isPolitical);
  }
}
