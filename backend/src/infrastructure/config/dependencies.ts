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
import { PgVectorClient } from '../external/pgvector.client';
import { TokenTaximeter } from '../monitoring/token-taximeter';
import { PrismaNewsArticleRepository } from '../persistence/prisma-news-article.repository';
import { PrismaTopicRepository } from '../persistence/prisma-topic.repository';
import { IngestNewsUseCase } from '../../application/use-cases/ingest-news.usecase';
import { AnalyzeArticleUseCase } from '../../application/use-cases/analyze-article.usecase';
import { ChatArticleUseCase } from '../../application/use-cases/chat-article.usecase';
import { ChatGeneralUseCase } from '../../application/use-cases/chat-general.usecase';
import { SearchNewsUseCase } from '../../application/use-cases/search-news.usecase';
import { ToggleFavoriteUseCase } from '../../application/use-cases/toggle-favorite.usecase';
import { QuotaService } from '../../domain/services/quota.service';
import { LocalSourceDiscoveryService } from '../../application/services/local-source-discovery.service';
import { IngestController } from '../http/controllers/ingest.controller';
import { AnalyzeController } from '../http/controllers/analyze.controller';
import { NewsController } from '../http/controllers/news.controller';
import { ChatController } from '../http/controllers/chat.controller';
import { SearchController } from '../http/controllers/search.controller';
import { SourcesController } from '../http/controllers/sources.controller';
import { UserController } from '../http/controllers/user.controller';
import { TopicController } from '../http/controllers/topic.controller';
import { HealthController } from '../http/controllers/health.controller';
import { SubscriptionController } from '../http/controllers/subscription.controller';
import { QuotaResetJob } from '../jobs/quota-reset.job';
import { CleanupNewsJob } from '../jobs/cleanup-news.job';

export class DependencyContainer {
  private static instance: DependencyContainer;

  public readonly prisma: PrismaClient;
  public readonly vectorClient: PgVectorClient;
  public readonly geminiClient: GeminiClient;
  public readonly newsRepository: PrismaNewsArticleRepository;
  public readonly topicRepository: PrismaTopicRepository;
  public readonly ingestController: IngestController;
  public readonly analyzeController: AnalyzeController;
  public readonly newsController: NewsController;
  public readonly chatController: ChatController;
  public readonly searchController: SearchController;
  public readonly sourcesController: SourcesController;
  public readonly userController: UserController;
  public readonly topicController: TopicController;
  public readonly healthController: HealthController;
  public readonly subscriptionController: SubscriptionController;
  public readonly quotaResetJob: QuotaResetJob;
  public readonly cleanupNewsJob: CleanupNewsJob;

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

    // Sprint 24: Dedicated Google News client for local city-based ingestion
    const googleNewsClient = new GoogleNewsRssClient();

    // BLOQUEANTE #2: TokenTaximeter ahora se inyecta (DI Pattern)
    const tokenTaximeter = new TokenTaximeter();
    this.geminiClient = new GeminiClient(process.env.GEMINI_API_KEY || '', tokenTaximeter);
    const jinaReaderClient = new JinaReaderClient(process.env.JINA_API_KEY || '');
    const metadataExtractor = new MetadataExtractor();
    this.vectorClient = new PgVectorClient(this.prisma);
    this.newsRepository = new PrismaNewsArticleRepository(this.prisma);
    this.topicRepository = new PrismaTopicRepository(this.prisma);

    // Domain Services
    const quotaService = new QuotaService();

    // Sprint 24: Local Source Discovery Service (AI-powered RSS discovery)
    const localSourceDiscoveryService = new LocalSourceDiscoveryService(
      this.prisma,
      this.geminiClient
    );

    // Application Layer
    const ingestNewsUseCase = new IngestNewsUseCase(
      newsAPIClient,
      this.newsRepository,
      this.prisma,
      googleNewsClient, // Sprint 24: Google News RSS for local city-based ingestion
      localSourceDiscoveryService // Sprint 24: AI-powered local source discovery
    );

    const analyzeArticleUseCase = new AnalyzeArticleUseCase(
      this.newsRepository,
      this.geminiClient,
      jinaReaderClient,
      metadataExtractor,
      this.vectorClient,
      quotaService
    );

    const chatArticleUseCase = new ChatArticleUseCase(
      this.newsRepository,
      this.geminiClient,
      this.vectorClient // Añadido para RAG
    );

    const chatGeneralUseCase = new ChatGeneralUseCase(
      this.geminiClient // Sprint 27.4: Chat general usa conocimiento completo de Gemini (sin RAG)
    );

    const searchNewsUseCase = new SearchNewsUseCase(
      this.newsRepository,
      this.geminiClient,
      this.vectorClient
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
    this.chatController = new ChatController(chatArticleUseCase, chatGeneralUseCase);
    this.searchController = new SearchController(searchNewsUseCase);
    this.userController = new UserController(this.geminiClient);
    this.topicController = new TopicController(this.topicRepository);
    this.sourcesController = new SourcesController(this.geminiClient);
    this.healthController = new HealthController(this.prisma);
    this.subscriptionController = new SubscriptionController();

    // Infrastructure Jobs (Sprint 14 - Paso 2: Automatización de Reset de Cuotas)
    this.quotaResetJob = new QuotaResetJob(this.prisma);

    // News Cleanup Job (Sprint 19.5 - Tarea 1: Limpieza Automática)
    this.cleanupNewsJob = new CleanupNewsJob(this.prisma);
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
