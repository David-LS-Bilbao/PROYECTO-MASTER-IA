/**
 * GetFavoritesUseCase (Application Layer)
 * Retrieves all favorite articles with pagination
 */

import { INewsArticleRepository } from '../../domain/repositories/news-article.repository';
import { NewsArticle } from '../../domain/entities/news-article.entity';

export interface GetFavoritesInput {
  limit?: number;
  offset?: number;
}

export interface GetFavoritesOutput {
  articles: NewsArticle[];
  count: number;
}

export class GetFavoritesUseCase {
  constructor(private readonly newsArticleRepository: INewsArticleRepository) {}

  async execute(input: GetFavoritesInput): Promise<GetFavoritesOutput> {
    const { limit = 50, offset = 0 } = input;

    // Use unified findAll with onlyFavorites filter
    const articles = await this.newsArticleRepository.findAll({
      limit,
      offset,
      onlyFavorites: true,
    });

    return {
      articles,
      count: articles.length,
    };
  }
}
