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
      topicId: prismaArticle.topicId, // Sprint 23: Topic relation
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
   * 
   * ESTRATEGIA DE UPDATE (Sprint 16 - Fix Duplicados):
   * - Actualiza SOLO metadata que puede cambiar (category, urlToImage, description)
   * - Preserva análisis IA existente (summary, biasScore, analysis, analyzedAt)
   * - Esto evita re-analizar artículos que solo están en otra categoría
   */
  toUpsertData(article: NewsArticle): {
    where: Prisma.ArticleWhereUniqueInput;
    update: Prisma.ArticleUpdateInput;
    create: Prisma.ArticleCreateInput;
  } {
    return {
      where: { url: article.url },
      update: {
        // Actualizar metadata que puede cambiar con el tiempo
        title: article.title,
        description: article.description,
        content: article.content,
        urlToImage: article.urlToImage,
        author: article.author,
        category: article.category, // ✅ CRÍTICO: Actualizar categoría si la noticia aparece en otro feed

        // Sprint 23: Update topic relation if provided
        ...(article.topicId ? { topic: { connect: { id: article.topicId } } } : {}),

        // ✅ FIX Sprint 18: Actualizar análisis IA si el dominio entity lo tiene
        // El domain entity solo tiene análisis cuando se ejecuta analyze-article.usecase
        // Si viene de RSS ingestion, estos campos serán null
        ...(article.analyzedAt && {
          summary: article.summary,
          biasScore: article.biasScore,
          analysis: article.analysis,
          analyzedAt: article.analyzedAt,
          internalReasoning: article.internalReasoning,
        }),

        // isFavorite no se toca (manejado por junction table Favorite)
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

        // Sprint 23: Connect to topic if provided
        ...(article.topicId ? { topic: { connect: { id: article.topicId } } } : {}),
      },
    };
  }
}
