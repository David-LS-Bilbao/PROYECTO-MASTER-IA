import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function checkDeportesArticles() {
  // Check recent deportes articles
  const articles = await prisma.article.findMany({
    where: { category: 'deportes' },
    orderBy: { publishedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      title: true,
      source: true,
      publishedAt: true,
      fetchedAt: true,
      url: true
    }
  });

  console.log('=== ULTIMOS 10 ARTICULOS DE DEPORTES ===');
  articles.forEach((a, i) => {
    const publishedAge = Math.round((Date.now() - a.publishedAt.getTime()) / (1000 * 60 * 60));
    const fetchedAge = Math.round((Date.now() - a.fetchedAt.getTime()) / (1000 * 60 * 60));
    console.log(`${i+1}. ${a.title.substring(0, 60)}`);
    console.log(`   Source: ${a.source} | Published: ${publishedAge}h ago | Fetched: ${fetchedAge}h ago`);
  });

  // Count total deportes articles
  const total = await prisma.article.count({
    where: { category: 'deportes' }
  });
  console.log(`\nTotal articulos deportes: ${total}`);

  // Check ingestion metadata
  const lastIngestion = await prisma.ingestMetadata.findFirst({
    orderBy: { lastFetch: 'desc' },
    take: 1
  });

  if (lastIngestion) {
    console.log(`\nUltima ingesta: ${lastIngestion.source}`);
    console.log(`Fecha: ${lastIngestion.lastFetch}`);
    console.log(`Status: ${lastIngestion.status}`);
    console.log(`Articulos: ${lastIngestion.articlesCount}`);
  }

  await prisma.$disconnect();
}

checkDeportesArticles().catch(console.error);
