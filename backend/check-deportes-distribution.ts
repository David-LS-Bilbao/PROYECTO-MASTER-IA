import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function checkDeportesDistribution() {
  // Group articles by source and count
  const sourceDistribution = await prisma.article.groupBy({
    by: ['source'],
    where: { category: 'deportes' },
    _count: true,
    orderBy: {
      _count: {
        source: 'desc'
      }
    }
  });

  console.log('=== DISTRIBUCIÓN DE FUENTES EN DEPORTES ===\n');
  sourceDistribution.forEach((src) => {
    console.log(`${src.source}: ${src._count} artículos`);
  });

  // Check recent articles
  const recentArticles = await prisma.article.findMany({
    where: { category: 'deportes' },
    orderBy: { publishedAt: 'desc' },
    take: 20,
    select: {
      title: true,
      source: true,
      publishedAt: true,
      fetchedAt: true
    }
  });

  console.log('\n=== ÚLTIMOS 20 ARTÍCULOS DE DEPORTES ===\n');
  recentArticles.forEach((a, i) => {
    const publishedAge = Math.round((Date.now() - a.publishedAt.getTime()) / (1000 * 60 * 60));
    console.log(`${i+1}. [${a.source}] ${a.title.substring(0, 50)} (${publishedAge}h ago)`);
  });

  const total = await prisma.article.count({ where: { category: 'deportes' } });
  console.log(`\nTotal artículos deportes: ${total}`);

  await prisma.$disconnect();
}

checkDeportesDistribution().catch(console.error);
