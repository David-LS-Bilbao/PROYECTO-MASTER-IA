import Parser from 'rss-parser';

const PORTADA_FEEDS = [
  { name: 'El País', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada' },
  { name: 'El Mundo', url: 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml' },
  { name: '20 Minutos', url: 'https://www.20minutos.es/rss/' },
  { name: 'ABC', url: 'https://www.abc.es/rss/2.0/portada' },
  { name: 'La Vanguardia', url: 'https://www.lavanguardia.com/mvc/feed/rss/home' },
  { name: 'El Confidencial', url: 'https://rss.elconfidencial.com/espana/' },
  { name: 'El Español', url: 'https://www.elespanol.com/rss/' },
  { name: 'La Razón', url: 'https://www.larazon.es/rss/portada.xml' },
  { name: 'elDiario.es', url: 'https://www.eldiario.es/rss/' },
  { name: 'Público', url: 'https://www.publico.es/rss/' },
];

async function testPortadaFeeds() {
  const parser = new Parser({ timeout: 10000 });

  console.log('=== TESTING PORTADA FEEDS (GENERAL CATEGORY) ===\n');

  const workingFeeds: Array<{name: string; items: number; latestAge: number}> = [];
  const failedFeeds: Array<{name: string; error: string}> = [];

  for (const feed of PORTADA_FEEDS) {
    try {
      const result = await parser.parseURL(feed.url);

      if (result.items.length > 0) {
        const latest = result.items[0];
        const pubDate = new Date(latest.isoDate || latest.pubDate || new Date());
        const ageHours = Math.round((Date.now() - pubDate.getTime()) / (1000 * 60 * 60));

        if (ageHours < 48) {
          console.log(`✅ ${feed.name}: ${result.items.length} items, último hace ${ageHours}h`);
          workingFeeds.push({ name: feed.name, items: result.items.length, latestAge: ageHours });
        } else {
          console.log(`⚠️ ${feed.name}: OBSOLETO (último hace ${ageHours}h)`);
          failedFeeds.push({ name: feed.name, error: `Obsolete (${ageHours}h ago)` });
        }
      } else {
        console.log(`⚠️ ${feed.name}: Sin artículos`);
        failedFeeds.push({ name: feed.name, error: 'No items' });
      }
    } catch (error) {
      console.log(`❌ ${feed.name}: ${(error as Error).message}`);
      failedFeeds.push({ name: feed.name, error: (error as Error).message });
    }
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`✅ Feeds funcionando: ${workingFeeds.length}/10`);
  console.log(`❌ Feeds con problemas: ${failedFeeds.length}/10`);

  if (failedFeeds.length > 0) {
    console.log(`\n⚠️ FEEDS QUE REQUIEREN ATENCIÓN:`);
    failedFeeds.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
  }
}

testPortadaFeeds().catch(console.error);
