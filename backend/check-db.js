const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDB() {
  try {
    const total = await prisma.article.count();
    console.log('📊 Total articles in DB:', total);
    
    const recent = await prisma.article.findMany({
      take: 5,
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        source: true,
        publishedAt: true,
      }
    });
    
    console.log('\n📰 Last 5 articles:');
    recent.forEach((a, i) => {
      console.log(`${i+1}. [${a.source}] ${a.title.substring(0, 60)}...`);
      console.log(`   Published: ${a.publishedAt}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDB();
