/**
 * ToggleFavoriteUseCase (Application Layer)
 * Toggles the favorite status of a news article FOR A SPECIFIC USER.
 * Uses the Favorite junction table (userId + articleId) for per-user isolation.
 */

import { INewsArticleRepository } from '../../domain/repositories/news-article.repository';
import { DomainError } from '../../domain/errors/domain.error';

export interface ToggleFavoriteInput {
  articleId: string;
  userId: string;
}

export interface ToggleFavoriteOutput {
  articleId: string;
  isFavorite: boolean;
}

export class ToggleFavoriteUseCase {
  constructor(private readonly newsArticleRepository: INewsArticleRepository) {}

  async execute(input: ToggleFavoriteInput): Promise<ToggleFavoriteOutput> {
    const { articleId, userId } = input;

    if (!articleId || articleId.trim() === '') {
      throw new DomainError('Article ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new DomainError('User ID is required for favorites');
    }

    // Verify article exists
    const article = await this.newsArticleRepository.findById(articleId);
    if (!article) {
      throw new DomainError(`Article with ID ${articleId} not found`);
    }

    // Toggle in per-user junction table
    const isFavorite = await this.newsArticleRepository.toggleFavoriteForUser(userId, articleId);

    return {
      articleId,
      isFavorite,
    };
  }
}
