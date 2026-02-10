import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node'; // Sprint 15: Sentry integration (v8+ API)
import { DependencyContainer } from '../config/dependencies';
import { createIngestRoutes } from './routes/ingest.routes';
import { createAnalyzeRoutes } from './routes/analyze.routes';
import { createNewsRoutes } from './routes/news.routes';
import { createChatRoutes } from './routes/chat.routes';
import { createSearchRoutes } from './routes/search.routes';
import { createSourcesRoutes } from './routes/sources.routes';
import { createUserRoutes } from './routes/user.routes';
import { createTopicRoutes } from './routes/topic.routes';
import { createHealthRoutes } from './routes/health.routes';
import { createSubscriptionRoutes } from './routes/subscription.routes';
import { errorHandler } from './middleware/error.handler';
import { requestLogger } from './middleware/request.logger';
import { EntityNotFoundError } from '../../domain/errors/domain.error';

export function createServer(): Application {
  const app = express();
  app.set('trust proxy', 1);

  // Initialize dependencies
  const container = DependencyContainer.getInstance();

  // Request Logger - PRIMERO para capturar todas las peticiones desde el inicio
  app.use(requestLogger);

  // Security middleware
  app.use(helmet());

  // Rate limiting - prevent abuse
  // 🔧 Sprint 16 FIX: Relajar rate limit en desarrollo
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 10000, // 10k en dev, 100 en prod
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // CORS configuration - Allow frontend origins with explicit methods
  const defaultOrigins = ['http://localhost:3001', 'http://localhost:5173'];
  const envOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
    : defaultOrigins;
  const allowedOrigins = envOrigins.length > 0 ? envOrigins : defaultOrigins;

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    // 🔍 Sprint 15 - Paso 3: Allow Sentry trace headers for distributed tracing
    allowedHeaders: ['Content-Type', 'Authorization', 'sentry-trace', 'baggage', 'x-cron-secret'],
    exposedHeaders: ['sentry-trace'],
  }));

  // Body parser
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health Routes - basic health check and readiness probe
  app.use('/health', createHealthRoutes(container.healthController));

  // API Routes
  console.log('📚 Registrando rutas...');

  app.use('/api/news', createNewsRoutes(container.newsController));
  app.use('/api/ingest', createIngestRoutes(container.ingestController));
  app.use('/api/analyze', createAnalyzeRoutes(container.analyzeController));
  app.use('/api/chat', createChatRoutes(container.chatController));
  app.use('/api/search', createSearchRoutes(container.searchController));
  app.use('/api/sources', createSourcesRoutes(container.sourcesController));
  app.use('/api/user', createUserRoutes(container.userController));
  app.use('/api/topics', createTopicRoutes(container.topicController));
  app.use('/api/subscription', createSubscriptionRoutes(container.subscriptionController));

  // 404 handler - Lanza error en lugar de enviar respuesta directa
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new EntityNotFoundError('Route', req.path));
  });

  // 🔍 Sprint 15: Sentry error handler (v10+ API)
  // This captures errors and sends them to Sentry, also handles distributed tracing
  Sentry.setupExpressErrorHandler(app);

  // Global Error Handler - DEBE IR AL FINAL de todos los middlewares y rutas
  app.use(errorHandler);

  return app;
}
