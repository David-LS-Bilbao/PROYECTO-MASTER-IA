/**
 * Script de prueba para el endpoint de búsqueda semántica
 * Ejecutar: npx tsx scripts/test-search-endpoint.ts
 */

import 'dotenv/config';
import { ChromaClient } from '../src/infrastructure/external/chroma.client';
import { GeminiClient } from '../src/infrastructure/external/gemini.client';
import { SearchNewsUseCase } from '../src/application/use-cases/search-news.usecase';
import { PrismaNewsArticleRepository } from '../src/infrastructure/persistence/prisma-news-article.repository';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  console.log('=== Test de Búsqueda Semántica ===\n');

  // Setup
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const chromaClient = new ChromaClient();
  const geminiClient = new GeminiClient(process.env.GEMINI_API_KEY || '');
  const articleRepository = new PrismaNewsArticleRepository(prisma);

  // Initialize ChromaDB collection
  console.log('1. Inicializando ChromaDB...');
  await chromaClient.initCollection();

  // Check how many documents are in ChromaDB
  const collection = chromaClient.getCollection();
  const docCount = await collection.count();
  console.log(`   📊 Documentos en ChromaDB: ${docCount}\n`);

  if (docCount === 0) {
    console.log('⚠️ ChromaDB está vacío. Primero ejecuta el análisis de artículos para indexarlos.');
    console.log('   Usa: POST /api/analyze/batch con { "limit": 10 }');
    await prisma.$disconnect();
    return;
  }

  // Create UseCase
  const searchUseCase = new SearchNewsUseCase(
    articleRepository,
    geminiClient,
    chromaClient
  );

  // Test searches
  const testQueries = [
    'política España gobierno',
    'economía inflación precios',
    'deportes fútbol',
  ];

  for (const query of testQueries) {
    console.log(`\n🔍 Buscando: "${query}"`);
    console.log('─'.repeat(50));

    try {
      const result = await searchUseCase.execute({ query, limit: 3 });

      console.log(`   Resultados: ${result.totalFound}`);

      for (let i = 0; i < result.results.length; i++) {
        const article = result.results[i];
        console.log(`\n   ${i + 1}. ${article.title.substring(0, 60)}...`);
        console.log(`      📰 Fuente: ${article.source}`);
        console.log(`      📅 Fecha: ${article.publishedAt.toISOString().split('T')[0]}`);
        if (article.biasScore !== null) {
          console.log(`      📊 Bias: ${article.biasScore.toFixed(2)}`);
        }
      }
    } catch (error) {
      console.error(`   ❌ Error: ${(error as Error).message}`);
    }
  }

  console.log('\n\n=== Test completado ===');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});
