import Parser from 'rss-parser';

const RSS_FEEDS = [
  { name: 'Marca', url: 'https://e00-marca.uecdn.es/rss/portada.xml' },
  { name: 'AS', url: 'https://as.com/rss/tikitakas/portada.xml' },
  { name: 'Mundo Deportivo', url: 'https://www.mundodeportivo.com/mvc/feed/rss/home' },
  { name: 'Sport', url: 'https://www.sport.es/rss/last-news/news.xml' },
  { name: 'Estadio Deportivo', url: 'https://www.estadiodeportivo.com/rss/' },
  { name: 'Superdeporte', url: 'https://www.superdeporte.es/rss/section/2' },
  { name: 'Defensa Central', url: 'https://www.defensacentral.com/rss/' },
  { name: 'Palco23', url: 'https://www.palco23.com/rss' },
  { name: 'Eurosport', url: 'https://espanol.eurosport.com/rss.xml' },
  { name: 'BeSoccer', url: 'https://es.besoccer.com/rss/noticias' },
];

async function testRssFeeds() {
  const parser = new Parser({ timeout: 10000 });

  console.log('=== TESTING RSS FEEDS FOR DEPORTES ===\n');

  for (const feed of RSS_FEEDS) {
    try {
      console.log(`Testing ${feed.name}...`);
      const result = await parser.parseURL(feed.url);

      console.log(`  Total items: ${result.items.length}`);

      if (result.items.length > 0) {
        const latest = result.items[0];
        const pubDate = new Date(latest.isoDate || latest.pubDate || new Date());
        const ageHours = Math.round((Date.now() - pubDate.getTime()) / (1000 * 60 * 60));

        console.log(`  Latest article: ${latest.title?.substring(0, 60)}`);
        console.log(`  Published: ${ageHours}h ago`);
        console.log(`  URL: ${latest.link}`);
      }
      console.log('  ✅ SUCCESS\n');
    } catch (error) {
      console.log(`  ❌ FAILED: ${(error as Error).message}\n`);
    }
  }
}

testRssFeeds().catch(console.error);
