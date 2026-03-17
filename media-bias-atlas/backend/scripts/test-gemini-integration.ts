import { PrismaClient } from '@prisma/client';
import { AnalyzeArticleBiasUseCase } from '../src/application/use-cases/bias-analysis/AnalyzeArticleBiasUseCase';
import { PrismaArticleRepository } from '../src/infrastructure/database/PrismaArticleRepository';
import { PrismaArticleBiasAnalysisRepository } from '../src/infrastructure/database/PrismaArticleBiasAnalysisRepository';
import { createArticleBiasAIProvider } from '../src/infrastructure/ai/createArticleBiasAIProvider';
import { ArticleBiasJsonParser } from '../src/application/parsers/ArticleBiasJsonParser';

async function run() {
  const prisma = new PrismaClient();
  const articleRepo = new PrismaArticleRepository(prisma);
  const analysisRepo = new PrismaArticleBiasAnalysisRepository(prisma);
  const aiProvider = createArticleBiasAIProvider();
  const formatParser = new ArticleBiasJsonParser();

  const useCase = new AnalyzeArticleBiasUseCase(articleRepo, analysisRepo, aiProvider, formatParser);

  try {
    console.log('[1] Buscando un articulo politico en BD...');
    const article = await prisma.article.findFirst({
      where: {
        isPolitical: true
      }
    });

    if (!article) {
      console.log('No hay articulos marcados como politicos en la base de datos.');
      console.log('Por favor, sincroniza un feed y marca uno como politico primero.');
      return;
    }

    console.log(`[2] Articulo encontrado: "${article.title}" (ID: ${article.id})`);
    console.log('[3] Ejecutando analisis con:', aiProvider['providerName'] || 'desconocido', 'y modelo', aiProvider['modelName'] || '---');

    const result = await useCase.execute(article.id);
    
    console.log('\n===============================');
    console.log(' RESULTADO DEL ANALISIS');
    console.log('===============================');
    console.log('Estado:', result.analysis.status);
    console.log('Etiqueta Ideologica:', result.analysis.ideologyLabel);
    console.log('Confianza:', result.analysis.confidence);
    console.log('Resumen:', result.analysis.summary);
    console.log('Provider Persistido:', result.analysis.provider);
    if (result.analysis.status === 'FAILED') {
      console.log('Error Message:', result.analysis.errorMessage);
      console.log('Raw JSON:', result.analysis.rawJson);
    }
    console.log('===============================\n');
    console.log('El analisis real con Gemini ha sido un Exito!');
  } catch (err) {
    console.error('ERROR test-gemini-integration:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
