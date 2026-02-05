import Parser from 'rss-parser';

// Probar URLs alternativas de feeds RSS de deportes españoles
const ALTERNATIVE_FEEDS = [
  // AS - URLs alternativas
  { name: 'AS - Portada', url: 'https://as.com/rss/portada.xml' },
  { name: 'AS - Futbol', url: 'https://as.com/rss/futbol.xml' },

  // Mundo Deportivo - URLs alternativas
  { name: 'Mundo Deportivo - Alt 1', url: 'https://www.mundodeportivo.com/rss/home' },
  { name: 'Mundo Deportivo - Alt 2', url: 'https://www.mundodeportivo.com/feed' },

  // Sport - URLs alternativas
  { name: 'Sport - Alt 1', url: 'https://www.sport.es/es/rss/last-news/news.xml' },
  { name: 'Sport - Alt 2', url: 'https://www.sport.es/feed/' },

  // Otras fuentes reconocidas
  { name: '20 Minutos Deportes', url: 'https://www.20minutos.es/rss/deportes/' },
  { name: 'El Mundo Deportes', url: 'https://e00-elmundo.uecdn.es/elmundo/rss/deportes.xml' },
  { name: 'ABC Deportes', url: 'https://www.abc.es/rss/2.0/deportes/' },
  { name: 'El País Deportes', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/deportes/portada' },
  { name: 'La Vanguardia Deportes', url: 'https://www.lavanguardia.com/rss/deportes.xml' },
  { name: 'El Español Deportes', url: 'https://www.elespanol.com/rss/deportes' },

  // Medios especializados
  { name: 'Relevo', url: 'https://www.relevo.com/rss' },
  { name: 'Diario AS - Directo', url: 'https://as.com/rss/tags/c.html' },
];

async function testAlternativeFeeds() {
  const parser = new Parser({ timeout: 10000 });

  console.log('=== TESTING ALTERNATIVE RSS FEEDS FOR DEPORTES ===\n');

  const workingFeeds: Array<{name: string; url: string; items: number; latestAge: number}> = [];
  const failedFeeds: Array<{name: string; url: string; error: string}> = [];

  for (const feed of ALTERNATIVE_FEEDS) {
    try {
      const result = await parser.parseURL(feed.url);

      if (result.items.length > 0) {
        const latest = result.items[0];
        const pubDate = new Date(latest.isoDate || latest.pubDate || new Date());
        const ageHours = Math.round((Date.now() - pubDate.getTime()) / (1000 * 60 * 60));

        // Solo considerar feed válido si tiene artículos de menos de 48 horas
        if (ageHours < 48) {
          console.log(`✅ ${feed.name}`);
          console.log(`   Items: ${result.items.length} | Latest: ${ageHours}h ago`);
          console.log(`   Title: ${latest.title?.substring(0, 60)}`);
          console.log(`   URL: ${feed.url}\n`);
          workingFeeds.push({ name: feed.name, url: feed.url, items: result.items.length, latestAge: ageHours });
        } else {
          console.log(`⚠️ ${feed.name} - OBSOLETO (último artículo: ${ageHours}h ago)\n`);
          failedFeeds.push({ name: feed.name, url: feed.url, error: `Obsolete (${ageHours}h ago)` });
        }
      } else {
        failedFeeds.push({ name: feed.name, url: feed.url, error: 'No items' });
      }
    } catch (error) {
      console.log(`❌ ${feed.name} - ${(error as Error).message}\n`);
      failedFeeds.push({ name: feed.name, url: feed.url, error: (error as Error).message });
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Working feeds: ${workingFeeds.length}`);
  console.log(`Failed feeds: ${failedFeeds.length}`);

  if (workingFeeds.length > 0) {
    console.log('\n🎯 RECOMMENDED FEEDS TO USE:');
    workingFeeds.forEach(f => {
      console.log(`  - ${f.name}: ${f.url}`);
    });
  }
}

testAlternativeFeeds().catch(console.error);
