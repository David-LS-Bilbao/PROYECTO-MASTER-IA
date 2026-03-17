import { NextFunction, Request, Response } from 'express';
import { ArticleBiasJsonParser } from '../../../application/parsers/ArticleBiasJsonParser';
import { AnalyzeArticleBiasUseCase } from '../../../application/use-cases/bias-analysis/AnalyzeArticleBiasUseCase';
import { AnalyzeFeedBiasUseCase } from '../../../application/use-cases/bias-analysis/AnalyzeFeedBiasUseCase';
import { GetFeedBiasSummaryUseCase } from '../../../application/use-cases/bias-analysis/GetFeedBiasSummaryUseCase';
import { createArticleBiasAIProvider } from '../../ai/createArticleBiasAIProvider';
import { PrismaArticleBiasAnalysisRepository } from '../../database/PrismaArticleBiasAnalysisRepository';
import { PrismaArticleRepository } from '../../database/PrismaArticleRepository';
import { prisma } from '../../database/prismaClient';

const articleRepository = new PrismaArticleRepository(prisma);
const articleBiasAnalysisRepository = new PrismaArticleBiasAnalysisRepository(prisma);
const articleBiasAIProvider = createArticleBiasAIProvider();
const articleBiasJsonParser = new ArticleBiasJsonParser();

const analyzeArticleBiasUseCase = new AnalyzeArticleBiasUseCase(
  articleRepository,
  articleBiasAnalysisRepository,
  articleBiasAIProvider,
  articleBiasJsonParser
);

const analyzeFeedBiasUseCase = new AnalyzeFeedBiasUseCase(
  articleRepository,
  analyzeArticleBiasUseCase
);
const getFeedBiasSummaryUseCase = new GetFeedBiasSummaryUseCase(articleRepository);

export class BiasAnalysisController {
  static async analyzeArticle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { articleId } = req.params;
      const result = await analyzeArticleBiasUseCase.execute(articleId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async analyzeFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { feedId } = req.params;
      const result = await analyzeFeedBiasUseCase.execute(feedId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getArticleBiasAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { articleId } = req.params;
      const analysis = await articleBiasAnalysisRepository.findByArticleId(articleId);

      if (!analysis) {
        res.status(404).json({
          error: 'Domain Error',
          message: `Bias analysis for article ${articleId} not found`,
        });
        return;
      }

      res.json(analysis);
    } catch (error) {
      next(error);
    }
  }

  static async getFeedBiasSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { feedId } = req.params;
      const summary = await getFeedBiasSummaryUseCase.execute(feedId);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  }
}
