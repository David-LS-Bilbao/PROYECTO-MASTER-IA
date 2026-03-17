import { PrismaClient } from '@prisma/client';

async function run() {
  const prisma = new PrismaClient();
  try {
    const lastAnalysis = await prisma.articleBiasAnalysis.findFirst({
      orderBy: { analyzedAt: 'desc' },
    });
    console.log('Error Message:\n', lastAnalysis?.errorMessage);
    console.log('Raw JSON:\n', lastAnalysis?.rawJson);
  } finally {
    await prisma.$disconnect();
  }
}
run();
