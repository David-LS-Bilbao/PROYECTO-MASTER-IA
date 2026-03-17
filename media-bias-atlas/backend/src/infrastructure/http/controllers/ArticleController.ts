import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaArticleRepository } from '../../database/PrismaArticleRepository';
import { ListArticlesByFeedUseCase } from '../../../application/use-cases/feeds/ListArticlesByFeedUseCase';
import { ClassifyPoliticalArticleUseCase } from '../../../application/use-cases/classification/ClassifyPoliticalArticleUseCase';

const prisma = new PrismaClient();
const articleRepository = new PrismaArticleRepository(prisma);
const classifyPoliticalArticleUC = new ClassifyPoliticalArticleUseCase(articleRepository);

export class ArticleController {
  static async listByFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { feedId } = req.params;
      const { political } = req.query;
      
      let isPolitical: boolean | undefined;
      if (political === 'true') isPolitical = true;
      if (political === 'false') isPolitical = false;

      // Por defecto 50 si no existiese limit validado
      const useCase = new ListArticlesByFeedUseCase(articleRepository);
      const articles = await useCase.execute(feedId, 50, isPolitical);
      res.json(articles);
    } catch (error) {
      next(error);
    }
  }

  static async classifyArticle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { articleId } = req.params;
      const updatedArticle = await classifyPoliticalArticleUC.execute(articleId);
      res.json(updatedArticle);
    } catch (error) {
      next(error);
    }
  }
}
