/**
 * Backfill Embeddings Script
 * Migra artículos analizados de PostgreSQL a ChromaDB
 *
 * Ejecutar: npx tsx scripts/backfill-embeddings.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ChromaClient } from '../src/infrastructure/external/chroma.client';
import { GeminiClient } from '../src/infrastructure/external/gemini.client';

// Rate limit delay (2s para tier gratuito de Gemini - seguro para TFM)
const RATE_LIMIT_DELAY_MS = 2000;

// Utility: sleep function
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       BACKFILL DE EMBEDDINGS - PostgreSQL → ChromaDB       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // 1. Initialize connections
  console.log('1️⃣  Inicializando conexiones...');

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const chromaClient = new ChromaClient();
  const geminiClient = new GeminiClient(process.env.GEMINI_API_KEY || '');

  // 2. Initialize ChromaDB collection
  console.log('2️⃣  Conectando a ChromaDB...');
  await chromaClient.initCollection();
  const collection = chromaClient.getCollection();

  // 3. Fetch analyzed articles with images from PostgreSQL
  console.log('3️⃣  Buscando artículos analizados en PostgreSQL...');

  const articles = await prisma.article.findMany({
    where: {
      analyzedAt: { not: null },
      urlToImage: { not: null },
    },
    orderBy: { publishedAt: 'desc' },
  });

  console.log(`   📊 Encontrados: ${articles.length} artículos analizados con imagen\n`);

  if (articles.length === 0) {
    console.log('⚠️  No hay artículos para indexar. Ejecuta primero:');
    console.log('   POST /api/analyze/batch con { "limit": 20 }');
    await prisma.$disconnect();
    return;
  }

  // 4. Get existing IDs in ChromaDB to avoid duplicates
  console.log('4️⃣  Verificando documentos existentes en ChromaDB...');

  let existingIds: Set<string> = new Set();
  try {
    const existingDocs = await collection.get({
      ids: articles.map(a => a.id),
    });
    existingIds = new Set(existingDocs.ids);
    console.log(`   📋 Ya indexados: ${existingIds.size} documentos\n`);
  } catch {
    console.log('   📋 Colección vacía, indexando todos los artículos\n');
  }

  // 5. Process articles
  console.log('5️⃣  Iniciando indexación...');
  console.log('─'.repeat(60));

  let indexed = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const progress = `[${i + 1}/${articles.length}]`;

    // Skip if already exists
    if (existingIds.has(article.id)) {
      console.log(`${progress} ⏭️  Saltada (Ya existe): "${article.title.substring(0, 40)}..."`);
      skipped++;
      continue;
    }

    try {
      // Build text for embedding
      const textToEmbed = [
        article.title,
        article.description || '',
        article.summary || '',
      ].filter(Boolean).join('. ');

      // Generate embedding
      const embedding = await geminiClient.generateEmbedding(textToEmbed);

      // Store in ChromaDB
      await chromaClient.upsertItem(
        article.id,
        embedding,
        {
          title: article.title,
          source: article.source,
          publishedAt: article.publishedAt.toISOString(),
          biasScore: article.biasScore ?? undefined,
        },
        textToEmbed
      );

      console.log(`${progress} ✅ Indexada: "${article.title.substring(0, 45)}..."`);
      indexed++;

      // Rate limit delay (skip on last item)
      if (i < articles.length - 1) {
        await sleep(RATE_LIMIT_DELAY_MS);
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      console.error(`${progress} ❌ Error: "${article.title.substring(0, 30)}..." - ${errorMsg}`);
      failed++;

      // If rate limited, wait longer
      if (errorMsg.includes('429') || errorMsg.includes('quota')) {
        console.log('   ⏳ Rate limit detectado. Esperando 10 segundos...');
        await sleep(10000);
      }
    }
  }

  // 6. Summary
  console.log('\n' + '─'.repeat(60));
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                      RESUMEN FINAL                         ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Indexadas:  ${indexed.toString().padStart(4)}                                      ║`);
  console.log(`║  ⏭️  Saltadas:   ${skipped.toString().padStart(4)}                                      ║`);
  console.log(`║  ❌ Fallidas:   ${failed.toString().padStart(4)}                                      ║`);
  console.log(`║  📊 Total:      ${articles.length.toString().padStart(4)}                                      ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Verify final count in ChromaDB
  const finalCount = await collection.count();
  console.log(`\n📦 Documentos en ChromaDB: ${finalCount}`);

  await prisma.$disconnect();
  console.log('\n✅ Backfill completado.');
}

main().catch((err) => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});
