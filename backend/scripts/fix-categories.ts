/**
 * Fix script: Clean up incorrectly categorized articles
 * Run this to reset the category field for testing
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  console.log('Connecting to database...');

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Show current state
    const before = await prisma.$queryRaw<Array<{category: string | null, count: bigint}>>`
      SELECT category, COUNT(*) as count
      FROM articles
      GROUP BY category
      ORDER BY count DESC
    `;
    console.log('\n📊 ANTES del fix:');
    for (const cat of before) {
      console.log(`  - ${cat.category || '(null)'}: ${cat.count} artículos`);
    }

    // 2. Delete articles with wrong categories (deportes articles that aren't really about sports)
    // These were incorrectly tagged due to the bug
    const deleted = await prisma.article.deleteMany({
      where: {
        category: {
          in: ['deportes', 'economia', 'politica', 'tecnologia', 'ciencia', 'cultura', 'internacional']
        }
      }
    });
    console.log(`\n🗑️ Eliminados ${deleted.count} artículos con categorías incorrectas`);

    // 3. Show final state
    const after = await prisma.$queryRaw<Array<{category: string | null, count: bigint}>>`
      SELECT category, COUNT(*) as count
      FROM articles
      GROUP BY category
      ORDER BY count DESC
    `;
    console.log('\n📊 DESPUÉS del fix:');
    for (const cat of after) {
      console.log(`  - ${cat.category || '(null)'}: ${cat.count} artículos`);
    }

    console.log('\n✅ Listo! Ahora reinicia el backend y prueba ingestar categorías de nuevo.');
    console.log('   Los nuevos artículos se descargarán de las fuentes correctas (AS, Marca, etc. para deportes)');

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
