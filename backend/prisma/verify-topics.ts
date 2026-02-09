/**
 * Verificar Temas en Base de Datos
 * Script temporal para comprobar que los temas se crearon correctamente
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔍 Verificando temas en base de datos...\n');

  const topics = await prisma.topic.findMany({
    orderBy: { order: 'asc' },
  });

  console.log(`📊 Total de temas encontrados: ${topics.length}\n`);

  topics.forEach((topic) => {
    console.log(`✅ ${topic.order}. ${topic.name} (${topic.slug})`);
    console.log(`   📝 ${topic.description}`);
    console.log(`   🆔 ID: ${topic.id}`);
    console.log(`   📅 Creado: ${topic.createdAt.toLocaleString('es-ES')}\n`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
