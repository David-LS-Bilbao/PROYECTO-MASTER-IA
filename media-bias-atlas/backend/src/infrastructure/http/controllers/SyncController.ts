import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaRssFeedRepository } from '../../database/PrismaRssFeedRepository';
import { PrismaArticleRepository } from '../../database/PrismaArticleRepository';
import { SyncFeedArticlesUseCase } from '../../../application/use-cases/feeds/SyncFeedArticlesUseCase';

const prisma = new PrismaClient();
const rssFeedRepo = new PrismaRssFeedRepository(prisma);
const articleRepo = new PrismaArticleRepository(prisma);

export class SyncController {
  
  static async syncFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { feedId } = req.params;
      
      const useCase = new SyncFeedArticlesUseCase(rssFeedRepo, articleRepo);
      
      const result = await useCase.execute(feedId);
      
      // Responder siempre 200 si llegó al execute sin reventar (aunque el status sea failed por red u 0 iteraciones)
      res.status(200).json(result);
    } catch (error: any) {
      if (error.message?.includes('no encontrado')) {
        res.status(404).json({ error: 'Not Found', message: error.message });
        return;
      }
      next(error);
    }
  }
}
