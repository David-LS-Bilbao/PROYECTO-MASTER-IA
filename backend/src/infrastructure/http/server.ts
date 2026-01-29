import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { DependencyContainer } from '../config/dependencies';
import { createIngestRoutes } from './routes/ingest.routes';
import { createAnalyzeRoutes } from './routes/analyze.routes';
import { createNewsRoutes } from './routes/news.routes';
import { createChatRoutes } from './routes/chat.routes';

export function createServer(): Application {
  const app = express();

  // Initialize dependencies
  const container = DependencyContainer.getInstance();

  // Security middleware
  app.use(helmet());

  // CORS configuration - Allow frontend origins
  app.use(cors({
    origin: process.env.CORS_ORIGIN || ['http://localhost:3001', 'http://localhost:5173'],
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
  app.use('/api/news', createNewsRoutes(container.newsController));
  app.use('/api/ingest', createIngestRoutes(container.ingestController));
  app.use('/api/analyze', createAnalyzeRoutes(container.analyzeController));
  app.use('/api/chat', createChatRoutes(container.chatController));

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
