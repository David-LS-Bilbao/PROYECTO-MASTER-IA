import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { DependencyContainer } from '../config/dependencies';
import { createIngestRoutes } from './routes/ingest.routes';
import { createAnalyzeRoutes } from './routes/analyze.routes';
import { createNewsRoutes } from './routes/news.routes';
import { createChatRoutes } from './routes/chat.routes';
import { createSearchRoutes } from './routes/search.routes';
import { createSourcesRoutes } from './routes/sources.routes';
import { createUserRoutes } from './routes/user.routes';
import { errorHandler } from './middleware/error.handler';
import { requestLogger } from './middleware/request.logger';
import { EntityNotFoundError } from '../../domain/errors/domain.error';

export function createServer(): Application {
  const app = express();

  // Initialize dependencies
  const container = DependencyContainer.getInstance();

  // Request Logger - PRIMERO para capturar todas las peticiones desde el inicio
  app.use(requestLogger);

  // Security middleware
  app.use(helmet());

  // Rate limiting - prevent abuse
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // CORS configuration - Allow frontend origins with explicit methods
  app.use(cors({
    origin: process.env.CORS_ORIGIN || ['http://localhost:3001', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }));

  // Body parser
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check route - shows status of all services
  app.get('/health', async (_req: Request, res: Response) => {
    const services: Record<string, 'healthy' | 'unhealthy' | 'unknown'> = {
      api: 'healthy',
      database: 'unknown',
      chromadb: 'unknown',
      gemini: 'unknown',
    };

    // Check database (Prisma)
    try {
      await container.newsRepository.findAll({ limit: 1, offset: 0 });
      services.database = 'healthy';
    } catch {
      services.database = 'unhealthy';
    }

    // Check ChromaDB
    try {
      const chromaHealthy = await container.chromaClient.healthCheck();
      services.chromadb = chromaHealthy ? 'healthy' : 'unhealthy';
    } catch {
      services.chromadb = 'unhealthy';
    }

    // Check Gemini
    try {
      const geminiHealthy = await container.geminiClient.isAvailable();
      services.gemini = geminiHealthy ? 'healthy' : 'unhealthy';
    } catch {
      services.gemini = 'unhealthy';
    }

    const allHealthy = Object.values(services).every(s => s === 'healthy');

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ok' : 'degraded',
      service: 'Verity News API',
      services,
      timestamp: new Date().toISOString(),
    });
  });

  // API Routes
  console.log('📚 Registrando rutas...');

  app.use('/api/news', createNewsRoutes(container.newsController));
  app.use('/api/ingest', createIngestRoutes(container.ingestController));
  app.use('/api/analyze', createAnalyzeRoutes(container.analyzeController));
  app.use('/api/chat', createChatRoutes(container.chatController));
  app.use('/api/search', createSearchRoutes(container.searchController));
  app.use('/api/sources', createSourcesRoutes(container.sourcesController));
  app.use('/api/user', createUserRoutes(container.userController));

  // 404 handler - Lanza error en lugar de enviar respuesta directa
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new EntityNotFoundError('Route', req.path));
  });

  // Global Error Handler - DEBE IR AL FINAL de todos los middlewares y rutas
  app.use(errorHandler);

  return app;
}
