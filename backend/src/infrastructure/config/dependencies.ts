/**
 * Dependency Injection Container
 * Wires up all dependencies following Clean Architecture principles
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { NewsAPIClient } from '../external/newsapi.client';
import { GeminiClient } from '../external/gemini.client';
import { JinaReaderClient } from '../external/jina-reader.client';
import { PrismaNewsArticleRepository } from '../persistence/prisma-news-article.repository';
import { IngestNewsUseCase } from '../../application/use-cases/ingest-news.usecase';
import { AnalyzeArticleUseCase } from '../../application/use-cases/analyze-article.usecase';
import { IngestController } from '../http/controllers/ingest.controller';
import { AnalyzeController } from '../http/controllers/analyze.controller';

export class DependencyContainer {
  private static instance: DependencyContainer;

  public readonly prisma: PrismaClient;
  public readonly ingestController: IngestController;
  public readonly analyzeController: AnalyzeController;

  private constructor() {
    // Infrastructure Layer - Prisma 7 requires adapter for database connection
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    this.prisma = new PrismaClient({ adapter });
    const newsAPIClient = new NewsAPIClient();
    const geminiClient = new GeminiClient(process.env.GEMINI_API_KEY || '');
    const jinaReaderClient = new JinaReaderClient(process.env.JINA_API_KEY || '');
    const articleRepository = new PrismaNewsArticleRepository(this.prisma);

    // Application Layer
    const ingestNewsUseCase = new IngestNewsUseCase(
      newsAPIClient,
      articleRepository,
      this.prisma
    );

    const analyzeArticleUseCase = new AnalyzeArticleUseCase(
      articleRepository,
      geminiClient,
      jinaReaderClient
    );

    // Presentation Layer
    this.ingestController = new IngestController(ingestNewsUseCase);
    this.analyzeController = new AnalyzeController(analyzeArticleUseCase);
  }

  static getInstance(): DependencyContainer {
    if (!DependencyContainer.instance) {
      DependencyContainer.instance = new DependencyContainer();
    }
    return DependencyContainer.instance;
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
