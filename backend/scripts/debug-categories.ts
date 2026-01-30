/**
 * Debug script: Check categories in database
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  console.log('Connecting to database...');

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Total de artículos
    const total = await prisma.article.count();
    console.log(`\n📊 TOTAL ARTÍCULOS: ${total}`);

    // 2. Distribución de categorías
    const categories = await prisma.$queryRaw<Array<{category: string | null, count: bigint}>>`
      SELECT category, COUNT(*) as count
      FROM articles
      GROUP BY category
      ORDER BY count DESC
    `;

    console.log('\n📁 DISTRIBUCIÓN DE CATEGORÍAS:');
    for (const cat of categories) {
      console.log(`  - ${cat.category || '(null)'}: ${cat.count} artículos`);
    }

    // 3. Últimos 10 artículos con categoría
    const recent = await prisma.article.findMany({
      select: {
        id: true,
        title: true,
        category: true,
        source: true,
        fetchedAt: true
      },
      orderBy: { fetchedAt: 'desc' },
      take: 10
    });

    console.log('\n📰 ÚLTIMOS 10 ARTÍCULOS:');
    for (const art of recent) {
      const title = art.title.length > 50 ? art.title.substring(0, 50) + '...' : art.title;
      console.log(`  [${art.category || 'NULL'}] ${title}`);
      console.log(`     Source: ${art.source} | Fetched: ${art.fetchedAt}`);
    }

    // 4. Buscar artículos con categoría "deportes"
    const deportes = await prisma.article.count({
      where: {
        category: {
          equals: 'deportes',
          mode: 'insensitive'
        }
      }
    });
    console.log(`\n⚽ ARTÍCULOS CON category='deportes': ${deportes}`);

    // 5. Buscar con LIKE
    const deportesLike = await prisma.article.count({
      where: {
        category: {
          contains: 'deport',
          mode: 'insensitive'
        }
      }
    });
    console.log(`⚽ ARTÍCULOS CON category LIKE '%deport%': ${deportesLike}`);

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
