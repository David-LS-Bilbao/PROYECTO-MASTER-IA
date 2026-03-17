import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaRssFeedRepository } from '../../database/PrismaRssFeedRepository';
import { PrismaArticleRepository } from '../../database/PrismaArticleRepository';
import { AddRssFeedUseCase } from '../../../application/use-cases/feeds/AddRssFeedUseCase';
import { ListFeedsByOutletUseCase } from '../../../application/use-cases/feeds/ListFeedsByOutletUseCase';
import { ClassifyPoliticalFeedUseCase } from '../../../application/use-cases/classification/ClassifyPoliticalFeedUseCase';
import { ClassifyPoliticalArticleUseCase } from '../../../application/use-cases/classification/ClassifyPoliticalArticleUseCase';

const prisma = new PrismaClient();
const rssFeedRepository = new PrismaRssFeedRepository(prisma);
const articleRepository = new PrismaArticleRepository(prisma);
const classifyArticleUC = new ClassifyPoliticalArticleUseCase(articleRepository);
const classifyFeedUC = new ClassifyPoliticalFeedUseCase(articleRepository, classifyArticleUC);

export class RssFeedController {
  
  static async listFeeds(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { outletId } = req.params;
      const useCase = new ListFeedsByOutletUseCase(rssFeedRepository);
      const feeds = await useCase.execute(outletId);
      res.json(feeds);
    } catch (error) {
      next(error);
    }
  }
  
  static async addFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { outletId } = req.params;
      const useCase = new AddRssFeedUseCase(rssFeedRepository);
      
      const feed = await useCase.execute(outletId, req.body);
      
      res.status(201).json(feed);
    } catch (error: any) {
      if (error.code === 'P2003') { 
        // P2003 es Foreign Key constraint failed (Outlet no existe)
        res.status(404).json({ error: 'Domain Error', message: 'El Outlet especificado no existe.' });
        return;
      }
      next(error);
    }
  }

  static async classifyFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { feedId } = req.params;
      const metrics = await classifyFeedUC.execute(feedId);
      res.json(metrics);
    } catch (error) {
      next(error);
    }
  }
}
