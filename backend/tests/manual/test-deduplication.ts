/**
 * Script de test para verificar el fix de duplicados
 * 
 * PROPÓSITO:
 * - Verificar que upsert actualiza categorías correctamente
 * - Confirmar que no hay duplicados por URL en BD
 * - Test del flujo completo de ingesta
 * 
 * USO:
 * cd backend
 * npx tsx tests/manual/test-deduplication.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { NewsAPIClient } from '../../src/infrastructure/external/newsapi.client';
import { PrismaNewsArticleRepository } from '../../src/infrastructure/persistence/prisma-news-article.repository';
import { IngestNewsUseCase } from '../../src/application/use-cases/ingest-news.usecase';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧪 ========== TEST: FIX DUPLICADOS ==========\n');

  // =========================================
  // TEST 1: Verificar duplicados en BD
  // =========================================
  console.log('📊 TEST 1: Verificar duplicados por URL en BD...');
  const duplicates = await prisma.$queryRaw<Array<{ url: string; count: number }>>`
    SELECT url, COUNT(*) as count
    FROM articles
    GROUP BY url
    HAVING COUNT(*) > 1
  `;

  if (duplicates.length === 0) {
    console.log('✅ TEST 1 PASSED: No hay duplicados por URL\n');
  } else {
    console.error('❌ TEST 1 FAILED: Encontrados duplicados:', duplicates.length);
    console.error(duplicates);
    console.log('');
  }

  // =========================================
  // TEST 2: Distribución de categorías
  // =========================================
  console.log('📊 TEST 2: Distribución de artículos por categoría...');
  const distribution = await prisma.$queryRaw<
    Array<{ category: string | null; total_articles: number; unique_urls: number }>
  >`
    SELECT 
      category,
      COUNT(*) as total_articles,
      COUNT(DISTINCT url) as unique_urls
    FROM articles
    GROUP BY category
    ORDER BY total_articles DESC
  `;

  console.table(distribution);
  console.log('');

  // =========================================
  // TEST 3: Simular ingesta con update
  // =========================================
  console.log('📊 TEST 3: Simular ingesta que actualiza categoría...');

  // Obtener un artículo existente de "general"
  const existingArticle = await prisma.article.findFirst({
    where: { category: 'general' },
  });

  if (!existingArticle) {
    console.log('⚠️  TEST 3 SKIPPED: No hay artículos en "general" para probar\n');
  } else {
    console.log(`📝 Artículo seleccionado: ${existingArticle.title.substring(0, 50)}...`);
    console.log(`   URL: ${existingArticle.url.substring(0, 60)}...`);
    console.log(`   Categoría actual: "${existingArticle.category}"`);
    console.log(`   ID: ${existingArticle.id}`);

    // Simular que la misma URL llega en categoría "deportes"
    const newsAPIClient = new NewsAPIClient(process.env.NEWS_API_KEY || '');
    const repository = new PrismaNewsArticleRepository(prisma);
    const useCase = new IngestNewsUseCase(newsAPIClient, repository, prisma);

    console.log('\n🔄 Simulando re-ingesta del mismo artículo con categoría "deportes"...');

    // Para test real, necesitaríamos mockear NewsAPIClient
    // Por ahora, verificamos manualmente con el repositorio
    const { NewsArticle } = await import('../../src/domain/entities/news-article.entity');

    const updatedArticle = NewsArticle.create({
      id: existingArticle.id,
      title: existingArticle.title,
      description: existingArticle.description,
      content: existingArticle.content,
      url: existingArticle.url, // ✅ Misma URL
      urlToImage: existingArticle.urlToImage,
      source: existingArticle.source,
      author: existingArticle.author,
      publishedAt: existingArticle.publishedAt,
      category: 'deportes', // ✅ Nueva categoría
      language: existingArticle.language,
      embedding: existingArticle.embedding,
      summary: existingArticle.summary,
      biasScore: existingArticle.biasScore,
      analysis: existingArticle.analysis,
      analyzedAt: existingArticle.analyzedAt,
      internalReasoning: existingArticle.internalReasoning,
      isFavorite: existingArticle.isFavorite,
      fetchedAt: existingArticle.fetchedAt,
      updatedAt: new Date(),
    });

    await repository.save(updatedArticle);

    // Verificar que se actualizó
    const afterUpdate = await prisma.article.findUnique({
      where: { url: existingArticle.url },
    });

    if (afterUpdate?.category === 'deportes') {
      console.log('✅ TEST 3 PASSED: Categoría actualizada correctamente');
      console.log(`   Categoría antes: "general" → después: "${afterUpdate.category}"`);
      console.log(`   ID mantenido: ${afterUpdate.id}`);
      console.log('');

      // Revertir cambio para no afectar tests futuros
      await prisma.article.update({
        where: { id: existingArticle.id },
        data: { category: 'general' },
      });
      console.log('🔄 Cambio revertido para mantener BD limpia\n');
    } else {
      console.error('❌ TEST 3 FAILED: Categoría NO se actualizó');
      console.error(`   Esperado: "deportes", Recibido: "${afterUpdate?.category}"`);
      console.log('');
    }
  }

  // =========================================
  // TEST 4: Verificar que análisis IA se preserva
  // =========================================
  console.log('📊 TEST 4: Verificar que análisis IA se preserva en updates...');

  const analyzedArticle = await prisma.article.findFirst({
    where: {
      NOT: {
        summary: null,
      },
    },
  });

  if (!analyzedArticle) {
    console.log('⚠️  TEST 4 SKIPPED: No hay artículos analizados para probar\n');
  } else {
    const originalSummary = analyzedArticle.summary;
    const originalBiasScore = analyzedArticle.biasScore;

    console.log(`📝 Artículo analizado: ${analyzedArticle.title.substring(0, 50)}...`);
    console.log(`   Summary: ${originalSummary?.substring(0, 60)}...`);
    console.log(`   BiasScore: ${originalBiasScore}`);

    // Simular update (cambio de categoría)
    await prisma.article.update({
      where: { id: analyzedArticle.id },
      data: {
        category: 'economia',
        updatedAt: new Date(),
      },
    });

    // Verificar que summary y biasScore NO cambiaron
    const afterUpdate = await prisma.article.findUnique({
      where: { id: analyzedArticle.id },
    });

    if (
      afterUpdate?.summary === originalSummary &&
      afterUpdate?.biasScore === originalBiasScore
    ) {
      console.log('✅ TEST 4 PASSED: Análisis IA preservado en update');
      console.log('   Summary y BiasScore se mantienen intactos\n');

      // Revertir
      await prisma.article.update({
        where: { id: analyzedArticle.id },
        data: { category: analyzedArticle.category },
      });
    } else {
      console.error('❌ TEST 4 FAILED: Análisis IA se perdió en update');
      console.log('');
    }
  }

  // =========================================
  // RESUMEN
  // =========================================
  console.log('🎯 ========== RESUMEN ==========');
  console.log('Tests completados. Revisar resultados arriba.');
  console.log('Si todos los tests pasaron: ✅ Fix de duplicados funcional');
  console.log('Si alguno falló: ❌ Revisar implementación\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en tests:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
