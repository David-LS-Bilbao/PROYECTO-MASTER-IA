import { PrismaClient } from '@prisma/client';
import { AnalyzeFeedBiasUseCase } from '../src/application/use-cases/bias-analysis/AnalyzeFeedBiasUseCase';
import { PrismaArticleRepository } from '../src/infrastructure/database/PrismaArticleRepository';
import { PrismaArticleBiasAnalysisRepository } from '../src/infrastructure/database/PrismaArticleBiasAnalysisRepository';
import { createArticleBiasAIProvider } from '../src/infrastructure/ai/createArticleBiasAIProvider';
import { ArticleBiasJsonParser } from '../src/application/parsers/ArticleBiasJsonParser';
import { AnalyzeArticleBiasUseCase } from '../src/application/use-cases/bias-analysis/AnalyzeArticleBiasUseCase';

async function run() {
  const prisma = new PrismaClient();
  const articleRepo = new PrismaArticleRepository(prisma);
  const analysisRepo = new PrismaArticleBiasAnalysisRepository(prisma);
  const aiProvider = createArticleBiasAIProvider();
  const formatParser = new ArticleBiasJsonParser();

  const articleUseCase = new AnalyzeArticleBiasUseCase(articleRepo, analysisRepo, aiProvider, formatParser);
  const feedUseCase = new AnalyzeFeedBiasUseCase(articleRepo, articleUseCase);

  try {
    const feed = await prisma.rssFeed.findFirst();

    if (!feed) {
      console.log('No hay feeds en la BD.');
      return;
    }

    console.log(`Ejecutando analisis de feed para: "${feed.name}" (ID: ${feed.id})`);

    const result = await feedUseCase.execute(feed.id);
    
    console.log('Total procesados:', result.totalProcessed);
    console.log('Con Exito:', result.successful);
    console.log('Fallidos:', result.failed);
    console.log('Reusados:', result.reusedExisting);
    console.log('El analisis real de feed ha sido un Exito!');
  } catch (err) {
    console.error('ERROR test-feed-integration:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
