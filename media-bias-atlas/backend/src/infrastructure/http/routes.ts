import { Application, Router } from 'express';
import { CountryController } from './controllers/CountryController';
import { OutletController } from './controllers/OutletController';
import { RssFeedController } from './controllers/RssFeedController';
import { SyncController } from './controllers/SyncController';
import { ArticleController } from './controllers/ArticleController';
import { BiasAnalysisController } from './controllers/BiasAnalysisController';
import { GetOutletByIdUseCase } from '../../application/useCases/GetOutletByIdUseCase';

// Instanciar repositorios
import { PrismaCountryRepository } from '../repositories/PrismaCountryRepository';
import { PrismaOutletRepository } from '../repositories/PrismaOutletRepository';

// Instanciar Casos de Uso
import { ListCountriesUseCase } from '../../application/useCases/ListCountriesUseCase';
import { ListOutletsByCountryUseCase } from '../../application/useCases/ListOutletsByCountryUseCase';
import { CreateOutletUseCase } from '../../application/useCases/CreateOutletUseCase';
import { CalculateOutletBiasProfileUseCase } from '../../application/use-cases/bias-analysis/CalculateOutletBiasProfileUseCase';
import { PrismaArticleRepository } from '../database/PrismaArticleRepository';
import { prisma } from '../database/prismaClient';

export function setupRoutes(app: Application) {
  const apiRouter = Router();

  // Dependencias
  const countryRepo = new PrismaCountryRepository();
  const outletRepo = new PrismaOutletRepository();
  const articleRepo = new PrismaArticleRepository(prisma);

  const listCountriesUC = new ListCountriesUseCase(countryRepo);
  const listOutletsByCountryUC = new ListOutletsByCountryUseCase(outletRepo, countryRepo, articleRepo);
  const createOutletUC = new CreateOutletUseCase(outletRepo, countryRepo);
  const getOutletByIdUC = new GetOutletByIdUseCase(outletRepo);
  const calculateOutletBiasProfileUC = new CalculateOutletBiasProfileUseCase(articleRepo, outletRepo);

  // Controladores
  const countryController = new CountryController(listCountriesUC, listOutletsByCountryUC);
  const outletController = new OutletController(getOutletByIdUC, createOutletUC, calculateOutletBiasProfileUC);

  // Rutas - Countries
  apiRouter.get('/countries', (req, res, next) => countryController.list(req, res, next));
  apiRouter.get('/countries/:code/outlets', (req, res, next) => countryController.listOutlets(req, res, next));

  // Rutas - Outlets
  apiRouter.get('/outlets/:id', (req, res, next) => outletController.getById(req, res, next));
  apiRouter.post('/outlets', (req, res, next) => outletController.create(req, res, next));
  apiRouter.get('/outlets/:outletId/bias-profile', (req, res, next) => outletController.getBiasProfile(req, res, next));
  apiRouter.get('/outlets/:outletId/feeds', RssFeedController.listFeeds);
  apiRouter.post('/outlets/:outletId/feeds', RssFeedController.addFeed);

  // Rutas - Feeds (Sincronización Manual, Lectura y Clasificación)
  apiRouter.get('/feeds/:feedId/articles', ArticleController.listByFeed);
  apiRouter.get('/feeds/:feedId/bias-summary', BiasAnalysisController.getFeedBiasSummary);
  apiRouter.post('/feeds/:feedId/sync', SyncController.syncFeed);
  apiRouter.post('/feeds/:feedId/classify-political', RssFeedController.classifyFeed);
  apiRouter.post('/feeds/:feedId/analyze-bias', BiasAnalysisController.analyzeFeed);

  // Rutas - Articles
  apiRouter.post('/articles/:articleId/classify-political', ArticleController.classifyArticle);
  apiRouter.post('/articles/:articleId/analyze-bias', BiasAnalysisController.analyzeArticle);
  apiRouter.get('/articles/:articleId/bias-analysis', BiasAnalysisController.getArticleBiasAnalysis);

  app.use('/api', apiRouter);
}
