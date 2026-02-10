/**
 * Sprint 24: End-to-End Test for Local News Discovery + Multi-Source Ingestion
 *
 * Tests the complete flow:
 * 1. AI-powered source discovery (Gemini finds local news sources)
 * 2. RSS validation (checks if feeds are accessible)
 * 3. Multi-source ingestion (fetches articles from discovered sources + Google News)
 * 4. Database persistence (saves articles with proper categorization)
 *
 * Usage: npx tsx scripts/test-local-full-flow.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Explicitly load the .env file from the backend folder
// This handles running the script from the project root
dotenv.config({ path: path.join(__dirname, '../.env') });

// Fail fast if key is missing
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ Error: GEMINI_API_KEY is missing. Check backend/.env file.');
  console.error('   Make sure GEMINI_API_KEY is set in: backend/.env');
  process.exit(1);
}

import { DependencyContainer } from '../src/infrastructure/config/dependencies';
import { IngestNewsUseCase } from '../src/application/use-cases/ingest-news.usecase';

const TEST_CITY = 'Valencia';
const TEST_TOPIC_SLUG = 'local';

interface ContainerWithIngestUseCase {
  ingestController: {
    ingestNewsUseCase: IngestNewsUseCase;
  };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Sprint 24: AI Discovery + Multi-Source Local Ingestion Test  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Initialize dependencies
  console.log('🔧 Initializing dependencies...');
  const container = DependencyContainer.getInstance();
  const { prisma, newsController } = container;

  try {
    // =====================================================================
    // STEP 0: Verify Topic exists
    // =====================================================================
    console.log(`\n📋 Step 0: Verifying Topic "${TEST_TOPIC_SLUG}" exists...`);
    const topic = await prisma.topic.findUnique({
      where: { slug: TEST_TOPIC_SLUG },
    });

    if (!topic) {
      console.error(`❌ Topic "${TEST_TOPIC_SLUG}" not found in database`);
      console.error('   Run this SQL first:');
      console.error(`   INSERT INTO topics (id, name, slug, "order") VALUES (uuid_generate_v4(), 'Local', 'local', 3);`);
      process.exit(1);
    }

    console.log(`✅ Topic found: "${topic.name}" (ID: ${topic.id})`);

    // =====================================================================
    // STEP 1: Clean State - Delete existing sources for test city
    // =====================================================================
    console.log(`\n🧹 Step 1: Cleaning existing sources for "${TEST_CITY}"...`);
    const deletedSources = await prisma.source.deleteMany({
      where: { location: TEST_CITY },
    });

    console.log(`✅ Deleted ${deletedSources.count} existing sources`);

    // Also clean articles to see fresh ingestion
    console.log(`🧹 Cleaning existing articles for "${TEST_CITY}"...`);
    const deletedArticles = await prisma.article.deleteMany({
      where: {
        topicId: topic.id,
        OR: [
          { source: { contains: TEST_CITY } },
          { title: { contains: TEST_CITY } },
        ],
      },
    });

    console.log(`✅ Deleted ${deletedArticles.count} existing articles\n`);

    // =====================================================================
    // STEP 2: Trigger AI Discovery + Multi-Source Ingestion
    // =====================================================================
    console.log(`📡 Step 2: Triggering AI Discovery + Ingestion for "${TEST_CITY}"...`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    const startTime = Date.now();

    // Use the IngestNewsUseCase through the DependencyContainer
    const ingestUseCase = (container as ContainerWithIngestUseCase).ingestController.ingestNewsUseCase;

    const result = await ingestUseCase.execute({
      category: 'local',
      topicSlug: TEST_TOPIC_SLUG,
      query: TEST_CITY,
      language: 'es',
      pageSize: 20,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`✅ Ingestion completed in ${duration}s`);
    console.log(`   Total fetched: ${result.totalFetched}`);
    console.log(`   New articles: ${result.newArticles}`);
    console.log(`   Duplicates: ${result.duplicates}`);
    console.log(`   Errors: ${result.errors}`);
    console.log(`   Source: ${result.source}\n`);

    // =====================================================================
    // STEP 3: Verification 1 - Check Discovered Sources
    // =====================================================================
    console.log(`\n🔍 Step 3: Verification 1 - AI-Discovered Sources`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    const sources = await prisma.source.findMany({
      where: { location: TEST_CITY },
      orderBy: { reliability: 'asc' }, // high first
    });

    if (sources.length === 0) {
      console.log(`⚠️  No sources discovered for "${TEST_CITY}"`);
      console.log('   This might indicate:');
      console.log('   - Gemini API did not find local sources');
      console.log('   - All suggested sources failed validation');
      console.log('   - Discovery service was not triggered');
    } else {
      console.log(`✅ Found ${sources.length} discovered sources:\n`);

      sources.forEach((source, idx) => {
        const reliabilityEmoji = {
          high: '🟢',
          medium: '🟡',
          low: '🟠',
        }[source.reliability as string] || '⚪';

        console.log(`   ${idx + 1}. ${reliabilityEmoji} ${source.name}`);
        console.log(`      URL: ${source.url}`);
        console.log(`      Reliability: ${source.reliability}`);
        console.log(`      Active: ${source.isActive ? 'Yes' : 'No'}`);
        console.log(`      Created: ${source.createdAt.toISOString()}\n`);
      });
    }

    // =====================================================================
    // STEP 4: Verification 2 - Check Ingested Articles
    // =====================================================================
    console.log(`\n📰 Step 4: Verification 2 - Ingested Articles`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    const articles = await prisma.article.findMany({
      where: {
        topicId: topic.id,
        // Only articles from this ingestion (last 5 minutes)
        fetchedAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000),
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 10, // Show first 10
    });

    if (articles.length === 0) {
      console.log(`⚠️  No articles ingested for "${TEST_CITY}"`);
      console.log('   Check logs above for ingestion errors');
    } else {
      console.log(`✅ Found ${articles.length} ingested articles:\n`);

      // Group by source for statistics
      const sourceStats = articles.reduce((acc, article) => {
        acc[article.source] = (acc[article.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('   📊 Articles by source:');
      Object.entries(sourceStats)
        .sort(([, a], [, b]) => b - a)
        .forEach(([source, count]) => {
          console.log(`      - ${source}: ${count} articles`);
        });

      console.log('\n   📄 Sample articles:\n');
      articles.slice(0, 5).forEach((article, idx) => {
        console.log(`   ${idx + 1}. ${article.title.substring(0, 60)}...`);
        console.log(`      Source: ${article.source}`);
        console.log(`      Published: ${article.publishedAt.toISOString()}`);
        console.log(`      URL: ${article.url.substring(0, 70)}...\n`);
      });
    }

    // =====================================================================
    // STEP 5: Summary
    // =====================================================================
    console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║                        Test Summary                            ║`);
    console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

    const sourceEmoji = sources.length > 0 ? '✅' : '⚠️';
    const articleEmoji = articles.length > 0 ? '✅' : '⚠️';

    console.log(`   ${sourceEmoji} AI Discovery: ${sources.length} sources found`);
    console.log(`   ${articleEmoji} Multi-Source Ingestion: ${articles.length} articles saved`);
    console.log(`   ⏱️  Total duration: ${duration}s\n`);

    if (sources.length > 0 && articles.length > 0) {
      console.log('   🎉 All systems operational! Local news flow is working.\n');
    } else {
      console.log('   ⚠️  Some components did not work as expected. Check logs above.\n');
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('\n❌ Error during test:', error);
    console.error('\nStack trace:', (error as Error).stack);
    process.exit(1);
  } finally {
    // Clean up
    await container.close();
  }
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
