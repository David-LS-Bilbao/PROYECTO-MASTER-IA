/**
 * Dependency Injection Container
 * Wires up all dependencies following Clean Architecture principles
 */

import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../persistence/prisma.client';
import { NewsAPIClient } from '../external/newsapi.client';
import { GoogleNewsRssClient } from '../external/google-news-rss.client';
import { DirectSpanishRssClient } from '../external/direct-spanish-rss.client';
import { GeminiClient } from '../external/gemini.client';
import { JinaReaderClient } from '../external/jina-reader.client';
import { MetadataExtractor } from '../external/metadata-extractor';
import { ChromaClient } from '../external/chroma.client';
import { TokenTaximeter } from '../monitoring/token-taximeter';
import { PrismaNewsArticleRepository } from '../persistence/prisma-news-article.repository';
import { IngestNewsUseCase } from '../../application/use-cases/ingest-news.usecase';
import { AnalyzeArticleUseCase } from '../../application/use-cases/analyze-article.usecase';
import { ChatArticleUseCase } from '../../application/use-cases/chat-article.usecase';
import { SearchNewsUseCase } from '../../application/use-cases/search-news.usecase';
import { ToggleFavoriteUseCase } from '../../application/use-cases/toggle-favorite.usecase';
import { QuotaService } from '../../domain/services/quota.service';
import { IngestController } from '../http/controllers/ingest.controller';
import { AnalyzeController } from '../http/controllers/analyze.controller';
import { NewsController } from '../http/controllers/news.controller';
import { ChatController } from '../http/controllers/chat.controller';
import { SearchController } from '../http/controllers/search.controller';
import { SourcesController } from '../http/controllers/sources.controller';
import { UserController } from '../http/controllers/user.controller';
import { HealthController } from '../http/controllers/health.controller';
import { QuotaResetJob } from '../jobs/quota-reset.job';

export class DependencyContainer {
  private static instance: DependencyContainer;

  public readonly prisma: PrismaClient;
  public readonly chromaClient: ChromaClient;
  public readonly geminiClient: GeminiClient;
  public readonly newsRepository: PrismaNewsArticleRepository;
  public readonly ingestController: IngestController;
  public readonly analyzeController: AnalyzeController;
  public readonly newsController: NewsController;
  public readonly chatController: ChatController;
  public readonly searchController: SearchController;
  public readonly sourcesController: SourcesController;
  public readonly userController: UserController;
  public readonly healthController: HealthController;
  public readonly quotaResetJob: QuotaResetJob;

  private constructor() {
    // Use singleton Prisma instance
    this.prisma = getPrismaClient();

    // Use Direct Spanish RSS as primary client (clean URLs, no Google obfuscation)
    // This allows MetadataExtractor to work properly with direct media links
    // Fallback options: 'google-news' or 'newsapi'
    const newsAPIClient =
      process.env.NEWS_CLIENT === 'newsapi'
        ? new NewsAPIClient()
        : process.env.NEWS_CLIENT === 'google-news'
        ? new GoogleNewsRssClient()
        : new DirectSpanishRssClient(); // Default: Direct Spanish RSS

    // BLOQUEANTE #2: TokenTaximeter ahora se inyecta (DI Pattern)
    const tokenTaximeter = new TokenTaximeter();
    this.geminiClient = new GeminiClient(process.env.GEMINI_API_KEY || '', tokenTaximeter);
    const jinaReaderClient = new JinaReaderClient(process.env.JINA_API_KEY || '');
    const metadataExtractor = new MetadataExtractor();
    this.chromaClient = new ChromaClient();
    this.newsRepository = new PrismaNewsArticleRepository(this.prisma);

    // Domain Services
    const quotaService = new QuotaService();

    // Application Layer
    const ingestNewsUseCase = new IngestNewsUseCase(
      newsAPIClient,
      this.newsRepository,
      this.prisma
    );

    const analyzeArticleUseCase = new AnalyzeArticleUseCase(
      this.newsRepository,
      this.geminiClient,
      jinaReaderClient,
      metadataExtractor,
      this.chromaClient,
      quotaService
    );

    const chatArticleUseCase = new ChatArticleUseCase(
      this.newsRepository,
      this.geminiClient,
      this.chromaClient // Añadido para RAG
    );

    const searchNewsUseCase = new SearchNewsUseCase(
      this.newsRepository,
      this.geminiClient,
      this.chromaClient
    );

    const toggleFavoriteUseCase = new ToggleFavoriteUseCase(this.newsRepository);

    // Presentation Layer
    this.ingestController = new IngestController(ingestNewsUseCase);
    this.analyzeController = new AnalyzeController(analyzeArticleUseCase);
    this.newsController = new NewsController(
      this.newsRepository,
      toggleFavoriteUseCase,
      ingestNewsUseCase // Sprint 19: Inject for reactive ingestion in search
    );
    this.chatController = new ChatController(chatArticleUseCase);
    this.searchController = new SearchController(searchNewsUseCase);
    this.userController = new UserController(this.geminiClient);
    this.sourcesController = new SourcesController(this.geminiClient);
    this.healthController = new HealthController(this.prisma);

    // Infrastructure Jobs (Sprint 14 - Paso 2: Automatización de Reset de Cuotas)
    this.quotaResetJob = new QuotaResetJob(this.prisma);
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
