/**
 * Dependency Injection Container
 * Wires up all dependencies following Clean Architecture principles
 */

import { PrismaClient } from '@prisma/client';
import { NewsAPIClient } from '../external/newsapi.client';
import { PrismaNewsArticleRepository } from '../persistence/prisma-news-article.repository';
import { IngestNewsUseCase } from '../../application/use-cases/ingest-news.usecase';
import { IngestController } from '../http/controllers/ingest.controller';

export class DependencyContainer {
  private static instance: DependencyContainer;

  public readonly prisma: PrismaClient;
  public readonly ingestController: IngestController;

  private constructor() {
    // Infrastructure Layer
    this.prisma = new PrismaClient();
    const newsAPIClient = new NewsAPIClient();
    const articleRepository = new PrismaNewsArticleRepository(this.prisma);

    // Application Layer
    const ingestNewsUseCase = new IngestNewsUseCase(
      newsAPIClient,
      articleRepository,
      this.prisma
    );

    // Presentation Layer
    this.ingestController = new IngestController(ingestNewsUseCase);
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
