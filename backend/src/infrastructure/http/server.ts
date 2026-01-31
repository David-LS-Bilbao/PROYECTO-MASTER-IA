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

export function createServer(): Application {
  const app = express();

  // Initialize dependencies
  const container = DependencyContainer.getInstance();

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

  // Health check route
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'Verity News API',
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

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}
