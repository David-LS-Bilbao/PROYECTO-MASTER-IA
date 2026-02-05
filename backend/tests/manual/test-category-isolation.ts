/**
 * Script de Test Manual: Categorías Independientes
 * 
 * OBJETIVO:
 * Verificar que "General" y "Deportes" están correctamente aisladas
 * 
 * USO:
 * cd backend
 * npx tsx tests/manual/test-category-isolation.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧪 ========== TEST: CATEGORÍAS INDEPENDIENTES ==========\n');

  // =========================================
  // TEST 1: Distribución de categorías
  // =========================================
  console.log('📊 TEST 1: Distribución de artículos por categoría...');
  const distribution = await prisma.$queryRaw<
    Array<{ category: string | null; total_articles: number; unique_urls: number }>
  >`
    SELECT 
      category,
      COUNT(*) as total_articles,
      COUNT(DISTINCT url) as unique_urls
    FROM articles
    WHERE category IN ('general', 'deportes', 'tecnologia', 'ciencia')
    GROUP BY category
    ORDER BY category
  `;

  console.table(distribution);

  const generalCount = distribution.find(d => d.category === 'general')?.total_articles || 0;
  const deportesCount = distribution.find(d => d.category === 'deportes')?.total_articles || 0;

  if (generalCount > 0 && deportesCount > 0) {
    console.log('✅ TEST 1 PASSED: Ambas categorías tienen artículos\n');
  } else {
    console.error('❌ TEST 1 FAILED: Alguna categoría está vacía\n');
  }

  // =========================================
  // TEST 2: Verificar NO hay URLs compartidas
  // =========================================
  console.log('📊 TEST 2: Verificar URLs únicas por categoría...');
  const sharedUrls = await prisma.$queryRaw<
    Array<{ url: string; num_categories: number }>
  >`
    SELECT 
      url,
      COUNT(DISTINCT category) as num_categories
    FROM articles
    GROUP BY url
    HAVING COUNT(DISTINCT category) > 1
  `;

  if (sharedUrls.length === 0) {
    console.log('✅ TEST 2 PASSED: No hay URLs compartidas entre categorías\n');
  } else {
    console.error('❌ TEST 2 FAILED: Encontradas URLs compartidas:');
    console.table(sharedUrls.slice(0, 5));
    console.log('');
  }

  // =========================================
  // TEST 3: Verificar fuentes de "General"
  // =========================================
  console.log('📊 TEST 3: Verificar fuentes de "General" (solo portadas)...');
  const generalSources = await prisma.$queryRaw<
    Array<{ source: string; total: number }>
  >`
    SELECT 
      source,
      COUNT(*) as total
    FROM articles
    WHERE category = 'general'
    GROUP BY source
    ORDER BY total DESC
    LIMIT 10
  `;

  console.table(generalSources);

  const hasSportsSources = generalSources.some(s => 
    s.source.toLowerCase().includes('marca') ||
    s.source.toLowerCase().includes('sport') ||
    s.source.toLowerCase().includes('as.com')
  );

  if (!hasSportsSources) {
    console.log('✅ TEST 3 PASSED: General NO contiene fuentes deportivas\n');
  } else {
    console.error('❌ TEST 3 FAILED: General contiene fuentes deportivas (contaminación)\n');
  }

  // =========================================
  // TEST 4: Verificar fuentes de "Deportes"
  // =========================================
  console.log('📊 TEST 4: Verificar fuentes de "Deportes" (solo medios deportivos)...');
  const deportesSources = await prisma.$queryRaw<
    Array<{ source: string; total: number }>
  >`
    SELECT 
      source,
      COUNT(*) as total
    FROM articles
    WHERE category = 'deportes'
    GROUP BY source
    ORDER BY total DESC
    LIMIT 10
  `;

  console.table(deportesSources);

  const hasOnlySportsSources = deportesSources.every(s =>
    s.source.toLowerCase().includes('marca') ||
    s.source.toLowerCase().includes('sport') ||
    s.source.toLowerCase().includes('as') ||
    s.source.toLowerCase().includes('mundo deportivo') ||
    s.source.toLowerCase().includes('abc')
  );

  if (hasOnlySportsSources) {
    console.log('✅ TEST 4 PASSED: Deportes solo contiene fuentes deportivas\n');
  } else {
    console.log('⚠️  TEST 4 WARNING: Deportes contiene fuentes mixtas (revisar)\n');
  }

  // =========================================
  // TEST 5: Muestra de artículos de cada categoría
  // =========================================
  console.log('📊 TEST 5: Muestra de artículos (primeros 3 de cada categoría)...\n');

  const generalSample = await prisma.article.findMany({
    where: { category: 'general' },
    select: { title: true, source: true, publishedAt: true },
    orderBy: { publishedAt: 'desc' },
    take: 3,
  });

  console.log('🔥 PORTADA (General):');
  generalSample.forEach((a, i) => {
    console.log(`   ${i + 1}. ${a.title.substring(0, 60)}... (${a.source})`);
  });
  console.log('');

  const deportesSample = await prisma.article.findMany({
    where: { category: 'deportes' },
    select: { title: true, source: true, publishedAt: true },
    orderBy: { publishedAt: 'desc' },
    take: 3,
  });

  console.log('⚽ DEPORTES:');
  deportesSample.forEach((a, i) => {
    console.log(`   ${i + 1}. ${a.title.substring(0, 60)}... (${a.source})`);
  });
  console.log('');

  // =========================================
  // RESUMEN
  // =========================================
  console.log('🎯 ========== RESUMEN ==========');
  console.log(`General: ${generalCount} artículos`);
  console.log(`Deportes: ${deportesCount} artículos`);
  console.log(`URLs compartidas: ${sharedUrls.length}`);
  
  const allPassed = 
    generalCount > 0 &&
    deportesCount > 0 &&
    sharedUrls.length === 0 &&
    !hasSportsSources;

  if (allPassed) {
    console.log('\n✅ TODOS LOS TESTS PASADOS: Categorías correctamente aisladas');
  } else {
    console.log('\n⚠️  ALGUNOS TESTS FALLARON: Revisar resultados arriba');
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Error en tests:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
