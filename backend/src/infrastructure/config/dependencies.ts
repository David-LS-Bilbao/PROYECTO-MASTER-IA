/**
 * Dependency Injection Container
 * Wires up all dependencies following Clean Architecture principles
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { NewsAPIClient } from '../external/newsapi.client';
import { GoogleNewsRssClient } from '../external/google-news-rss.client';
import { GeminiClient } from '../external/gemini.client';
import { JinaReaderClient } from '../external/jina-reader.client';
import { PrismaNewsArticleRepository } from '../persistence/prisma-news-article.repository';
import { IngestNewsUseCase } from '../../application/use-cases/ingest-news.usecase';
import { AnalyzeArticleUseCase } from '../../application/use-cases/analyze-article.usecase';
import { ChatArticleUseCase } from '../../application/use-cases/chat-article.usecase';
import { IngestController } from '../http/controllers/ingest.controller';
import { AnalyzeController } from '../http/controllers/analyze.controller';
import { NewsController } from '../http/controllers/news.controller';
import { ChatController } from '../http/controllers/chat.controller';

export class DependencyContainer {
  private static instance: DependencyContainer;

  public readonly prisma: PrismaClient;
  public readonly ingestController: IngestController;
  public readonly analyzeController: AnalyzeController;
  public readonly newsController: NewsController;
  public readonly chatController: ChatController;

  private constructor() {
    // Infrastructure Layer - Prisma 7 requires adapter for database connection
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    this.prisma = new PrismaClient({ adapter });

    // Use Google News RSS as primary client (free, unlimited, Spanish-focused)
    // Fallback to NewsAPI if needed
    const newsAPIClient =
      process.env.NEWS_CLIENT === 'newsapi'
        ? new NewsAPIClient()
        : new GoogleNewsRssClient();

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

    const chatArticleUseCase = new ChatArticleUseCase(
      articleRepository,
      geminiClient
    );

    // Presentation Layer
    this.ingestController = new IngestController(ingestNewsUseCase);
    this.analyzeController = new AnalyzeController(analyzeArticleUseCase);
    this.newsController = new NewsController(articleRepository);
    this.chatController = new ChatController(chatArticleUseCase);
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
