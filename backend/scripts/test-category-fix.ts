/**
 * Test script: Verify the category fix is working
 */
import 'dotenv/config';
import { DirectSpanishRssClient } from '../src/infrastructure/external/direct-spanish-rss.client';

async function main() {
  const client = new DirectSpanishRssClient();

  console.log('\n=== TEST: Ingesta de DEPORTES ===\n');

  const result = await client.fetchTopHeadlines({
    category: 'deportes',  // <-- This should now work!
    language: 'es',
    pageSize: 5,
    page: 1,
  });

  console.log(`\n📊 Resultado:`);
  console.log(`   Total: ${result.articles.length} artículos`);
  console.log(`   Status: ${result.status}`);

  console.log('\n📰 Primeros 5 artículos:');
  for (const article of result.articles.slice(0, 5)) {
    console.log(`\n   📌 ${article.title.substring(0, 60)}...`);
    console.log(`      Fuente: ${article.source.name}`);
    console.log(`      URL: ${article.url.substring(0, 60)}...`);
  }

  // Verify sources are sports sources (AS, Marca, Mundo Deportivo, Sport, Superdeporte)
  const sportsSources = ['AS', 'Marca', 'Mundo Deportivo', 'Sport', 'Superdeporte'];
  const sourcesFound = [...new Set(result.articles.map(a => a.source.name))];

  console.log(`\n✅ Fuentes encontradas: ${sourcesFound.join(', ')}`);

  const hasSportsSources = sourcesFound.some(s => sportsSources.includes(s));
  if (hasSportsSources) {
    console.log('🎉 ¡FIX EXITOSO! Los artículos vienen de fuentes deportivas.');
  } else {
    console.log('❌ ERROR: Los artículos NO vienen de fuentes deportivas.');
  }
}

main().catch(console.error);
