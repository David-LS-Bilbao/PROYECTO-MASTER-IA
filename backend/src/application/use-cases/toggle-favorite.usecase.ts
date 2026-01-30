/**
 * ToggleFavoriteUseCase (Application Layer)
 * Toggles the favorite status of a news article
 */

import { INewsArticleRepository } from '../../domain/repositories/news-article.repository';
import { NewsArticle } from '../../domain/entities/news-article.entity';
import { DomainError } from '../../domain/errors/domain.error';

export interface ToggleFavoriteInput {
  id: string;
}

export interface ToggleFavoriteOutput {
  article: NewsArticle;
  isFavorite: boolean;
}

export class ToggleFavoriteUseCase {
  constructor(private readonly newsArticleRepository: INewsArticleRepository) {}

  async execute(input: ToggleFavoriteInput): Promise<ToggleFavoriteOutput> {
    const { id } = input;

    // Validate input
    if (!id || id.trim() === '') {
      throw new DomainError('Article ID is required');
    }

    // Toggle favorite in repository
    const article = await this.newsArticleRepository.toggleFavorite(id);

    if (!article) {
      throw new DomainError(`Article with ID ${id} not found`);
    }

    return {
      article,
      isFavorite: article.isFavorite,
    };
  }
}
