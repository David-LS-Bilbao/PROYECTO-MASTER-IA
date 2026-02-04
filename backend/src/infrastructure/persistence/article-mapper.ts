/**
 * ArticleMapper (Infrastructure Layer)
 *
 * Mapeo bidireccional type-safe entre Prisma Article y NewsArticle domain entity.
 * Extraído de PrismaNewsArticleRepository para cumplir SRP.
 */

import type { Article as PrismaArticle, Prisma } from '@prisma/client';
import { NewsArticle, type NewsArticleProps } from '../../domain/entities/news-article.entity';

export class ArticleMapper {
  /**
   * Prisma Article → NewsArticle domain entity
   */
  toDomain(prismaArticle: PrismaArticle): NewsArticle {
    const props: NewsArticleProps = {
      id: prismaArticle.id,
      title: prismaArticle.title,
      description: prismaArticle.description,
      content: prismaArticle.content,
      url: prismaArticle.url,
      urlToImage: prismaArticle.urlToImage,
      source: prismaArticle.source,
      author: prismaArticle.author,
      publishedAt: prismaArticle.publishedAt,
      category: prismaArticle.category,
      language: prismaArticle.language,
      embedding: prismaArticle.embedding,
      summary: prismaArticle.summary,
      biasScore: prismaArticle.biasScore,
      analysis: prismaArticle.analysis,
      analyzedAt: prismaArticle.analyzedAt,
      internalReasoning: prismaArticle.internalReasoning,
      isFavorite: prismaArticle.isFavorite ?? false,
      fetchedAt: prismaArticle.fetchedAt,
      updatedAt: prismaArticle.updatedAt,
    };

    return NewsArticle.reconstitute(props);
  }

  /**
   * NewsArticle domain entity → Prisma upsert data
   * Usa getters de la entidad (no toJSON) para incluir internalReasoning en persistencia.
   */
  toUpsertData(article: NewsArticle): {
    where: Prisma.ArticleWhereUniqueInput;
    update: Prisma.ArticleUpdateInput;
    create: Prisma.ArticleCreateInput;
  } {
    return {
      where: { url: article.url },
      update: {
        title: article.title,
        description: article.description,
        content: article.content,
        urlToImage: article.urlToImage,
        author: article.author,
        category: article.category,
        embedding: article.embedding,
        summary: article.summary,
        biasScore: article.biasScore,
        analysis: article.analysis,
        analyzedAt: article.analyzedAt,
        internalReasoning: article.internalReasoning,
        isFavorite: article.isFavorite,
        updatedAt: new Date(),
      },
      create: {
        id: article.id,
        title: article.title,
        description: article.description,
        content: article.content,
        url: article.url,
        urlToImage: article.urlToImage,
        source: article.source,
        author: article.author,
        publishedAt: article.publishedAt,
        category: article.category,
        language: article.language,
        embedding: article.embedding,
        summary: article.summary,
        biasScore: article.biasScore,
        analysis: article.analysis,
        analyzedAt: article.analyzedAt,
        internalReasoning: article.internalReasoning,
        isFavorite: article.isFavorite,
        fetchedAt: article.fetchedAt,
        updatedAt: new Date(),
      },
    };
  }
}
