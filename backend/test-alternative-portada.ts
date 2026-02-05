import Parser from 'rss-parser';

const ALTERNATIVE_PORTADA_FEEDS = [
  // La Vanguardia alternativas
  { name: 'La Vanguardia - Home', url: 'https://www.lavanguardia.com/rss/home.xml' },
  { name: 'La Vanguardia - Feed', url: 'https://www.lavanguardia.com/feed' },
  { name: 'La Vanguardia - Portada', url: 'https://www.lavanguardia.com/rss/portada.xml' },

  // La Razón alternativas
  { name: 'La Razón - Home', url: 'https://www.larazon.es/rss/home.xml' },
  { name: 'La Razón - Feed', url: 'https://www.larazon.es/feed/' },

  // Público alternativas
  { name: 'Público - Feed', url: 'https://www.publico.es/feed' },
  { name: 'Público - Portada', url: 'https://www.publico.es/rss/portada' },

  // Opciones de reemplazo
  { name: 'Europa Press', url: 'https://www.europapress.es/rss/rss.aspx' },
  { name: 'EFE', url: 'https://www.efe.com/efe/espana/1.xml' },
  { name: 'La Sexta', url: 'https://www.lasexta.com/rss/portada' },
];

async function testAlternativePortadaFeeds() {
  const parser = new Parser({ timeout: 10000 });

  console.log('=== TESTING ALTERNATIVE PORTADA FEEDS ===\n');

  const workingFeeds: Array<{name: string; url: string; items: number}> = [];

  for (const feed of ALTERNATIVE_PORTADA_FEEDS) {
    try {
      const result = await parser.parseURL(feed.url);

      if (result.items.length > 0) {
        const latest = result.items[0];
        const pubDate = new Date(latest.isoDate || latest.pubDate || new Date());
        const ageHours = Math.round((Date.now() - pubDate.getTime()) / (1000 * 60 * 60));

        if (ageHours < 48) {
          console.log(`✅ ${feed.name}: ${result.items.length} items, último hace ${ageHours}h`);
          console.log(`   URL: ${feed.url}\n`);
          workingFeeds.push({ name: feed.name, url: feed.url, items: result.items.length });
        }
      }
    } catch (error) {
      console.log(`❌ ${feed.name}: ${(error as Error).message}`);
    }
  }

  if (workingFeeds.length > 0) {
    console.log(`\n✅ FEEDS FUNCIONANDO (${workingFeeds.length}):`);
    workingFeeds.forEach(f => console.log(`  - ${f.name}: ${f.url}`));
  }
}

testAlternativePortadaFeeds().catch(console.error);
