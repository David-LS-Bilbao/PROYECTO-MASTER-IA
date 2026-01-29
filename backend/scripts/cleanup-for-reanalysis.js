require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupArticlesForReanalysis() {
  console.log('🧹 [CLEANUP] Iniciando limpieza de datos...\n');

  try {
    // 1. Contar noticias sin imagen
    const articlesWithoutImage = await prisma.article.count({
      where: {
        OR: [
          { urlToImage: null },
          { urlToImage: '' }
        ]
      }
    });

    console.log(`📊 Encontradas ${articlesWithoutImage} noticias SIN imagen`);

    // 2. Resetear campos de análisis para noticias sin imagen
    const result = await prisma.article.updateMany({
      where: {
        OR: [
          { urlToImage: null },
          { urlToImage: '' }
        ]
      },
      data: {
        summary: null,
        biasScore: null,
        analysis: null,
        analyzedAt: null
      }
    });

    console.log(`✅ Resetadas ${result.count} noticias para re-análisis\n`);

    // 3. Verificar resultado
    const pending = await prisma.article.count({
      where: { analyzedAt: null }
    });

    const analyzed = await prisma.article.count({
      where: { analyzedAt: { not: null } }
    });

    console.log('📋 Estado después de limpieza:');
    console.log(`   ⏳ Pendientes: ${pending}`);
    console.log(`   ✅ Analizadas: ${analyzed}\n`);

    // 4. Mostrar primeras 3 noticias pendientes
    const firstPending = await prisma.article.findMany({
      where: { analyzedAt: null },
      select: {
        id: true,
        title: true,
        urlToImage: true,
        analyzedAt: true
      },
      take: 3
    });

    console.log('📌 Primeras 3 noticias pendientes de análisis:');
    firstPending.forEach((article, i) => {
      console.log(`   ${i + 1}. ${article.title.substring(0, 50)}`);
      console.log(`      URL Imagen: ${article.urlToImage || 'NULL'}`);
      console.log(`      Analizado: ${article.analyzedAt ? 'SÍ' : 'NO'}\n`);
    });

  } catch (error) {
    console.error('❌ ERROR en cleanup:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupArticlesForReanalysis();
